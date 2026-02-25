import { db } from '$lib/db/database';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { StoryPermissionRole } from '$lib/db/schemas/2-story-module.js';
import { hasPermission, isUniqueViolation, parseBody, requireParam } from '$lib/server/utils.server';
import { error, json } from '@sveltejs/kit';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import type { RequestHandler } from './$types';
import {
	storyPermissionCreateSchema as createSchema,
	storyPermissionPatchSchema as patchSchema
} from './schemas.js';

const findOnePermissionById = async (
	clientId: string,
	storyId: string,
	permissionId: string
) => {
	const row = await db
		.selectFrom('storyPermission')
		.innerJoin('story', 'story.id', 'storyPermission.storyId')
		.where('story.clientId', '=', clientId)
		.where('storyPermission.storyId', '=', storyId)
		.where('storyPermission.id', '=', permissionId)
		.select((eb) => [
			'storyPermission.id',
			'storyPermission.userId',
			'storyPermission.storyId',
			'storyPermission.role',
			'storyPermission.createdAt',
			'storyPermission.updatedAt',
			jsonObjectFrom(
				eb.selectFrom('user')
					.whereRef('user.id', '=', 'storyPermission.createdBy')
					.select((eb) => [
						'user.id',
						eb.fn<string | null>('nullif', [eb.fn<string>('btrim', [eb.fn<string>('concat', ['user.firstName', eb.cast<string>(eb.val(' '), 'text'), 'user.lastName'])]), eb.val('')]).as('label'),
						'user.picture as image',
					])
			).as('createdBy'),
			jsonObjectFrom(
				eb.selectFrom('user')
					.whereRef('user.id', '=', 'storyPermission.updatedBy')
					.select((eb) => [
						'user.id',
						eb.fn<string | null>('nullif', [eb.fn<string>('btrim', [eb.fn<string>('concat', ['user.firstName', eb.cast<string>(eb.val(' '), 'text'), 'user.lastName'])]), eb.val('')]).as('label'),
						'user.picture as image',
					])
			).as('updatedBy'),
		])
		.executeTakeFirst();

	if (!row) throw error(404, 'The story permission does not exist');
	return row;
};

const canModify = (locals: App.Locals, storyId: string) =>
	hasPermission(locals, {
		elevatedRoles: [UserRole.admin],
		permissionQuery: ({ locals, db }) => {
			const userId = locals.authusr!.id;

			return db
				.selectFrom('storyPermission')
				.where('storyPermission.storyId', '=', storyId)
				.where('storyPermission.userId', '=', userId)
				.where('storyPermission.role', '=', StoryPermissionRole.owner)
				.select('storyPermission.id');
		}
	});

export const GET: RequestHandler = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const storyId = requireParam(params.storyId, 'The story parameter is required');
	const permissionId = requireParam(params.permissionId, 'The permission parameter is required');

	const row = await findOnePermissionById(clientId, storyId, permissionId);
	return json(row);
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const clientId = locals.client.id;
	const storyId = requireParam(params.storyId, 'The story parameter is required');

	const parsed = await parseBody(request, createSchema);
	if (!parsed.ok) return parsed.response;

	if (!await canModify(locals, storyId)) throw error(403, 'You are not allowed to create story permissions');

	try {
		const authUserId = locals.authusr!.id;
		const { id: permissionId } = await db
			.insertInto('storyPermission')
			.values({
				...parsed.data,
				storyId,
				createdBy: authUserId,
				updatedBy: authUserId
			})
			.returning('storyPermission.id')
			.executeTakeFirstOrThrow();

		const row = await findOnePermissionById(clientId, storyId, permissionId);
		return json(row, { status: 201 });
	} catch (e) {
		if (isUniqueViolation(e)) {
			return json(
				{ errors: { userId: ['This user already has permissions for the story'] } },
				{ status: 422 }
			);
		}
		throw e;
	}
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const clientId = locals.client.id;
	const storyId = requireParam(params.storyId, 'The story parameter is required');
	const permissionId = requireParam(params.permissionId, 'The permission parameter is required');

	if (!await canModify(locals, storyId))
		throw error(403, 'You are not allowed to update this story permission');

	const parsed = await parseBody(request, patchSchema);
	if (!parsed.ok) return parsed.response;

	try {
		const authUserId = locals.authusr!.id;
		const updated = await db
			.updateTable('storyPermission')
			.where('storyPermission.id', '=', permissionId)
			.set({
				...parsed.data,
				updatedAt: new Date(),
				updatedBy: authUserId
			})
			.returning('storyPermission.id')
			.executeTakeFirst();

		if (!updated) throw error(404, 'The story permission does not exist');

		const row = await findOnePermissionById(clientId, storyId, permissionId);
		return json(row, { status: 200 });
	} catch (e) {
		if (isUniqueViolation(e)) {
			return json(
				{ errors: { userId: ['This user already has permissions for the story'] } },
				{ status: 422 }
			);
		}
		throw e;
	}
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const storyId = requireParam(params.storyId, 'The story parameter is required');
	const permissionId = requireParam(params.permissionId, 'The permission parameter is required');

	if (!await canModify(locals, storyId))
		throw error(403, 'You are not allowed to delete this story permission');

	const deleted = await db
		.deleteFrom('storyPermission')
		.where('storyPermission.id', '=', permissionId)
		.returning('storyPermission.id')
		.executeTakeFirst();

	if (!deleted) throw error(404, 'The story permission does not exist');

	return new Response(undefined, { status: 204 });
};
