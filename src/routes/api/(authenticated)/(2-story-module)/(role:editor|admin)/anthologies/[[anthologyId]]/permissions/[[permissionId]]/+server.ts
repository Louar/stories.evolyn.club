import { db } from '$lib/db/database';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { AnthologyPermissionRole } from '$lib/db/schemas/2-story-module.js';
import { hasPermission, isUniqueViolation, parseBody, requireParam } from '$lib/server/utils.server';
import { error, json } from '@sveltejs/kit';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import type { RequestHandler } from './$types.js';
import {
	anthologyPermissionCreateSchema as createSchema,
	anthologyPermissionPatchSchema as patchSchema
} from './schemas.js';

const findOnePermissionById = async (
	clientId: string,
	anthologyId: string,
	permissionId: string
) => {
	const row = await db
		.selectFrom('anthologyPermission')
		.innerJoin('anthology', 'anthology.id', 'anthologyPermission.anthologyId')
		.where('anthology.clientId', '=', clientId)
		.where('anthologyPermission.anthologyId', '=', anthologyId)
		.where('anthologyPermission.id', '=', permissionId)
		.select((eb) => [
			'anthologyPermission.id',
			'anthologyPermission.userId',
			'anthologyPermission.anthologyId',
			'anthologyPermission.role',
			'anthologyPermission.createdAt',
			'anthologyPermission.updatedAt',
			jsonObjectFrom(
				eb.selectFrom('user')
					.whereRef('user.id', '=', 'anthologyPermission.createdBy')
					.select((eb) => [
						'user.id',
						eb.fn<string | null>('nullif', [eb.fn<string>('btrim', [eb.fn<string>('concat', ['user.firstName', eb.cast<string>(eb.val(' '), 'text'), 'user.lastName'])]), eb.val('')]).as('label'),
						'user.picture as image',
					])
			).as('createdBy'),
			jsonObjectFrom(
				eb.selectFrom('user')
					.whereRef('user.id', '=', 'anthologyPermission.updatedBy')
					.select((eb) => [
						'user.id',
						eb.fn<string | null>('nullif', [eb.fn<string>('btrim', [eb.fn<string>('concat', ['user.firstName', eb.cast<string>(eb.val(' '), 'text'), 'user.lastName'])]), eb.val('')]).as('label'),
						'user.picture as image',
					])
			).as('updatedBy'),
		])
		.executeTakeFirst();

	if (!row) throw error(404, 'The anthology permission does not exist');
	return row;
};

const canModify = (locals: App.Locals, anthologyId: string) =>
	hasPermission(locals, {
		elevatedRoles: [UserRole.admin],
		permissionQuery: ({ locals, db }) => {
			const userId = locals.authusr!.id;

			return db
				.selectFrom('anthologyPermission')
				.where('anthologyPermission.anthologyId', '=', anthologyId)
				.where('anthologyPermission.userId', '=', userId)
				.where('anthologyPermission.role', '=', AnthologyPermissionRole.owner)
				.select('anthologyPermission.id');
		}
	});

export const GET: RequestHandler = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const anthologyId = requireParam(params.anthologyId, 'The anthology parameter is required');
	const permissionId = requireParam(params.permissionId, 'The permission parameter is required');

	const row = await findOnePermissionById(clientId, anthologyId, permissionId);
	return json(row);
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const clientId = locals.client.id;
	const anthologyId = requireParam(params.anthologyId, 'The anthology parameter is required');

	const parsed = await parseBody(request, createSchema);
	if (!parsed.ok) return parsed.response;

	if (!await canModify(locals, anthologyId)) throw error(403, 'You are not allowed to create anthology permissions');

	try {
		const authUserId = locals.authusr!.id;
		const { id: permissionId } = await db
			.insertInto('anthologyPermission')
			.values({
				...parsed.data,
				anthologyId,
				createdBy: authUserId,
				updatedBy: authUserId
			})
			.returning('anthologyPermission.id')
			.executeTakeFirstOrThrow();

		const row = await findOnePermissionById(clientId, anthologyId, permissionId);
		return json(row, { status: 201 });
	} catch (e) {
		if (isUniqueViolation(e)) {
			return json(
				{ errors: { userId: ['This user already has permissions for the anthology'] } },
				{ status: 422 }
			);
		}
		throw e;
	}
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const clientId = locals.client.id;
	const anthologyId = requireParam(params.anthologyId, 'The anthology parameter is required');
	const permissionId = requireParam(params.permissionId, 'The permission parameter is required');

	if (!await canModify(locals, anthologyId))
		throw error(403, 'You are not allowed to update this anthology permission');

	const parsed = await parseBody(request, patchSchema);
	if (!parsed.ok) return parsed.response;

	try {
		const authUserId = locals.authusr!.id;
		const updated = await db
			.updateTable('anthologyPermission')
			.where('anthologyPermission.id', '=', permissionId)
			.set({
				...parsed.data,
				updatedAt: new Date(),
				updatedBy: authUserId
			})
			.returning('anthologyPermission.id')
			.executeTakeFirst();

		if (!updated) throw error(404, 'The anthology permission does not exist');

		const row = await findOnePermissionById(clientId, anthologyId, permissionId);
		return json(row, { status: 200 });
	} catch (e) {
		if (isUniqueViolation(e)) {
			return json(
				{ errors: { userId: ['This user already has permissions for the anthology'] } },
				{ status: 422 }
			);
		}
		throw e;
	}
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const anthologyId = requireParam(params.anthologyId, 'The anthology parameter is required');
	const permissionId = requireParam(params.permissionId, 'The permission parameter is required');

	if (!await canModify(locals, anthologyId))
		throw error(403, 'You are not allowed to delete this anthology permission');

	const deleted = await db
		.deleteFrom('anthologyPermission')
		.where('anthologyPermission.id', '=', permissionId)
		.returning('anthologyPermission.id')
		.executeTakeFirst();

	if (!deleted) throw error(404, 'The anthology permission does not exist');

	return new Response(undefined, { status: 204 });
};
