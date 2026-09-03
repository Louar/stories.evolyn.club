import { db } from '$lib/db/database';
import type { Schema } from '$lib/db/schema';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { AnthologyPermissionRole } from '$lib/db/schemas/2-story-module';
import {
	canModifyStory,
	hasPermission,
	isUniqueViolation,
	parseBody,
	requireParam
} from '$lib/server/utils.server';
import { error, json } from '@sveltejs/kit';
import type { NotNull, Transaction } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import type { RequestHandler } from './$types';
import {
	anthologyCreateSchema as createSchema,
	anthologyPatchSchema as patchSchema
} from './schemas';

const findOneAnthologyById = async (clientId: string, anthologyId: string) => {
	const row = await db
		.selectFrom('anthology')
		.where('anthology.id', '=', anthologyId)
		.where('anthology.clientId', '=', clientId)
		.select((eb) => [
			'anthology.id',
			'anthology.clientId',
			'anthology.slug',
			'anthology.name',
			'anthology.name as nameRaw',
			'anthology.configuration',
			'anthology.isPublished',
			'anthology.isPublic',
			'anthology.createdAt',
			'anthology.updatedAt',
			jsonArrayFrom(
				eb
					.selectFrom('anthologyPosition')
					.whereRef('anthologyPosition.anthologyId', '=', 'anthology.id')
					.select([
						'anthologyPosition.id',
						'anthologyPosition.order',
						'anthologyPosition.storyId',
						'anthologyPosition.configuration'
					])
					.orderBy('anthologyPosition.order', 'asc')
					.$narrowType<{ id: NotNull; order: NotNull; storyId: NotNull }>()
			).as('positions')
		])
		.executeTakeFirst();

	if (!row) throw error(404, 'The anthology does not exist');
	return row;
};

const canCreateAnthology = (locals: App.Locals) =>
	hasPermission(locals, {
		elevatedRoles: [UserRole.editor, UserRole.admin]
	});

const canModifyAnthology = (locals: App.Locals, anthologyId: string) =>
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

const saveAnthologyPositions = async (
	trx: Transaction<Schema>,
	anthologyId: string,
	positions: Array<{
		id: string;
		order: number;
		storyId: string;
		configuration?: Record<string, unknown> | null;
		isRemoved?: boolean;
	}>
) => {
	const removedPositionIds = positions
		.filter((position) => position.isRemoved)
		.map((position) => position.id)
		.filter((positionId) => !positionId.startsWith('new'));

	if (removedPositionIds.length) {
		await trx
			.deleteFrom('anthologyPosition')
			.where('anthologyId', '=', anthologyId)
			.where('id', 'in', removedPositionIds)
			.execute();
	}

	for (const position of positions.filter((position) => !position.isRemoved)) {
		const { id: positionId, configuration, storyId, order } = position;
		await trx
			.insertInto('anthologyPosition')
			.values({
				id: positionId.startsWith('new') ? undefined : positionId,
				anthologyId,
				configuration: configuration ? JSON.stringify(configuration) : null,
				storyId,
				order
			})
			.onConflict((oc) =>
				oc.columns(['id']).doUpdateSet({
					anthologyId,
					configuration: configuration ? JSON.stringify(configuration) : null,
					storyId,
					order
				})
			)
			.returning('id')
			.executeTakeFirstOrThrow();
	}
};

/**
 * @openapi
 * summary: Create anthology
 * tags:
 *  - Anthologies
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	const clientId = locals.client.id;
	const authUserId = locals.authusr!.id;

	if (!(await canCreateAnthology(locals))) throw error(403, 'You are not allowed to create anthologies');

	const parsed = await parseBody(request, createSchema, locals.language);
	if (!parsed.ok) return parsed.response;

	const { slug, nameRaw, positions, ...rest } = parsed.data;

	try {
		const anthologyId = await db.transaction().execute(async (trx) => {
			const anthology = await trx
				.insertInto('anthology')
				.values({
					clientId,
					slug,
					name: JSON.stringify(nameRaw),
					createdBy: authUserId,
					updatedBy: authUserId,
					...rest
				})
				.returning('id')
				.executeTakeFirstOrThrow();

			await trx
				.insertInto('anthologyPermission')
				.values({
					anthologyId: anthology.id,
					userId: authUserId,
					role: AnthologyPermissionRole.owner,
					createdBy: authUserId,
					updatedBy: authUserId
				})
				.executeTakeFirstOrThrow();

			await saveAnthologyPositions(trx, anthology.id, positions);
			return anthology.id;
		});

		const row = await findOneAnthologyById(clientId, anthologyId);
		return json(row, { status: 201 });
	} catch (e) {
		if (isUniqueViolation(e)) {
			return json({ errors: { slug: ['Slug already exists'] } }, { status: 422 });
		}
		throw e;
	}
};

/**
 * @openapi
 * summary: Update anthology
 * tags:
 *  - Anthologies
 */
export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const clientId = locals.client.id;
	const authUserId = locals.authusr!.id;
	const anthologyId = requireParam(params.anthologyId, 'The anthology path parameter is required');

	if (!(await canModifyAnthology(locals, anthologyId))) {
		throw error(403, 'You are not allowed to update this anthology');
	}

	const parsed = await parseBody(request, patchSchema, locals.language);
	if (!parsed.ok) return parsed.response;

	const { slug, nameRaw, positions, ...rest } = parsed.data;

	try {
		await db.transaction().execute(async (trx) => {
			const updated = await trx
				.updateTable('anthology')
				.where('anthology.id', '=', anthologyId)
				.where('anthology.clientId', '=', clientId)
				.set({
					slug,
					name: JSON.stringify(nameRaw),
					updatedAt: new Date(),
					updatedBy: authUserId,
					...rest
				})
				.returning('id')
				.executeTakeFirst();

			if (!updated) throw error(404, 'The anthology does not exist');

			await saveAnthologyPositions(trx, anthologyId, positions);
		});

		const row = await findOneAnthologyById(clientId, anthologyId);
		return json(row, { status: 200 });
	} catch (e) {
		if (isUniqueViolation(e)) {
			return json({ errors: { slug: ['Slug already exists'] } }, { status: 422 });
		}
		throw e;
	}
};

/**
 * @openapi
 * summary: Delete anthology
 * tags:
 *  - Anthologies
 */
export const DELETE = (async ({ locals, params, url }) => {
	const clientId = locals.client.id;
	const anthologyId = requireParam(params.anthologyId, 'The anthology path parameter is required');
	const deleteStories = url.searchParams.get('deleteStories') === 'true';

	if (!(await canModifyAnthology(locals, anthologyId))) {
		throw error(403, 'You are not allowed to delete this anthology');
	}

	const anthology = await db
		.selectFrom('anthology')
		.where('anthology.clientId', '=', clientId)
		.where('anthology.id', '=', anthologyId)
		.select('anthology.id')
		.executeTakeFirst();
	if (!anthology) throw error(404, 'The anthology does not exist');

	const stories = deleteStories
		? await db
				.selectFrom('anthologyPosition')
				.innerJoin('story', 'story.id', 'anthologyPosition.storyId')
				.where('anthologyPosition.anthologyId', '=', anthologyId)
				.where('story.clientId', '=', clientId)
				.select('story.id')
				.distinct()
				.execute()
		: [];
	const storyIds = stories.map((story) => story.id);

	for (const storyId of storyIds) await canModifyStory(locals, storyId);

	await db.transaction().execute(async (trx) => {
		await trx
			.deleteFrom('anthology')
			.where('anthology.clientId', '=', clientId)
			.where('anthology.id', '=', anthologyId)
			.executeTakeFirstOrThrow();

		if (storyIds.length) {
			await trx
				.deleteFrom('story')
				.where('story.clientId', '=', clientId)
				.where('story.id', 'in', storyIds)
				.execute();
		}
	});

	return json({ success: true });
}) satisfies RequestHandler;
