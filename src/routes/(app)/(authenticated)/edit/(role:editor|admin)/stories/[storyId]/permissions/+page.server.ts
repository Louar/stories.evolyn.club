import { db } from '$lib/db/database';
import { selectLocalizedField } from '$lib/db/schemas/0-utils';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (async ({ locals, params }) => {
	const clientId = locals.client.id;
	const language = locals.authusr!.language;
	const storyId = params.storyId;

	const story = await db
		.selectFrom('story')
		.where('story.clientId', '=', clientId)
		.where('story.id', '=', storyId)
		.select((eb) => [
			'story.id',
			'story.reference',
			selectLocalizedField(eb, 'story.name', language).as('name'),
			'story.isPublished',
			'story.isPublic'
		])
		.executeTakeFirstOrThrow();

	const permissions = await db
		.selectFrom('storyPermission')
		.innerJoin('story', 'story.id', 'storyPermission.storyId')
		.where('story.clientId', '=', clientId)
		.where('storyPermission.storyId', '=', storyId)
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
		.orderBy('storyPermission.id')
		.execute();

	const users = await db
		.selectFrom('user')
		.where('user.clientId', '=', clientId)
		.select((eb) => [
			'user.id',
			'user.email',
			eb.fn<string | null>('nullif', [
				eb.fn<string>('btrim', [
					eb.fn<string>('concat', [
						'user.firstName',
						eb.cast<string>(eb.val(' '), 'text'),
						'user.lastName'
					])
				]),
				eb.val('')
			]).as('name')
		])
		.orderBy('user.id')
		.execute();

	return { story, permissions, relations: { users } };
});
