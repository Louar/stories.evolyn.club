import { db } from '$lib/db/database';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { AnthologyPermissionRole } from '$lib/db/schemas/2-story-module';
import { canModifyStory, hasPermission, requireParam } from '$lib/server/utils.server';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

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
