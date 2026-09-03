import { db } from '$lib/db/database';
import { selectLocalizedField } from '$lib/db/schemas/0-utils';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { AnthologyPermissionRole, StoryPermissionRole } from '$lib/db/schemas/2-story-module';
import { hasPermission } from '$lib/server/utils.server';
import { error } from '@sveltejs/kit';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const userId = locals.authusr!.id;
	const language = locals.authusr!.language;
	const anthologyId = params.anthologyId;

	const canModify = await hasPermission(locals, {
		elevatedRoles: [UserRole.admin],
		permissionQuery: ({ db }) =>
			db
				.selectFrom('anthologyPermission')
				.where('anthologyId', '=', anthologyId)
				.where('userId', '=', userId)
				.where('role', 'in', [AnthologyPermissionRole.owner, AnthologyPermissionRole.editor])
				.select('id')
	});
	if (!canModify) error(403, 'You are not allowed to edit this anthology');

	const anthology = await db
		.selectFrom('anthology')
		.where('anthology.id', '=', anthologyId)
		.where('anthology.clientId', '=', clientId)
		.select((eb) => [
			'anthology.id',
			'anthology.slug',
			selectLocalizedField(eb, 'anthology.name', language).as('name'),
			jsonArrayFrom(
				eb
					.selectFrom('anthologyPosition')
					.whereRef('anthologyPosition.anthologyId', '=', 'anthology.id')
					.select((eb) => [
						'anthologyPosition.id',
						'anthologyPosition.storyId',
						'anthologyPosition.order',
						eb
							.ref('anthologyPosition.configuration')
							.$castTo<Record<string, unknown> | null>()
							.as('configuration')
					])
					.orderBy('anthologyPosition.order', 'asc')
			).as('positions')
		])
		.executeTakeFirst();
	if (!anthology) error(404, 'The anthology does not exist');

	const isAdmin = locals.authusr?.roles?.includes(UserRole.admin) ?? false;
	let storiesQuery = db.selectFrom('story').where('story.clientId', '=', clientId);
	if (!isAdmin) {
		storiesQuery = storiesQuery
			.innerJoin('storyPermission', 'storyPermission.storyId', 'story.id')
			.where('storyPermission.userId', '=', userId)
			.where('storyPermission.role', 'in', [StoryPermissionRole.owner, StoryPermissionRole.editor]);
	}
	const stories = await storiesQuery
		.select((eb) => [
			'story.id',
			'story.slug',
			selectLocalizedField(eb, 'story.name', language).as('name')
		])
		.orderBy('story.slug', 'asc')
		.execute();

	return { anthology, stories };
};
