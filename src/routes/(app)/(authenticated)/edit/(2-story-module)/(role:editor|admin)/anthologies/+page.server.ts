import { db } from '$lib/db/database';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import type { NotNull } from 'kysely';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const clientId = locals.client.id;
	const userId = locals.authusr!.id;
	const isAdmin = locals.authusr?.roles?.includes(UserRole.admin) ?? false;
	let anthologyQuery = db.selectFrom('anthology').where('anthology.clientId', '=', clientId);
	if (!isAdmin) {
		anthologyQuery = anthologyQuery
			.innerJoin('anthologyPermission', 'anthologyPermission.anthologyId', 'anthology.id')
			.where('anthologyPermission.userId', '=', userId)
			.where('anthologyPermission.role', 'in', ['owner', 'editor']);
	}

	const anthologies = await anthologyQuery
		.select((eb) => [
			'anthology.id',
			'anthology.clientId',
			'anthology.slug',
			'anthology.name',
			'anthology.name as nameRaw',
			'anthology.configuration',
			'anthology.isPublic',
			'anthology.isPublished',
			'anthology.createdAt',
			'anthology.updatedAt',
			eb
				.selectFrom('anthologyPermission')
				.whereRef('anthologyPermission.anthologyId', '=', 'anthology.id')
				.select(eb.fn.countAll<number>().as('permissions'))
				.as('permissions'),
			jsonObjectFrom(
				eb
					.selectFrom('user')
					.whereRef('user.id', '=', 'anthology.createdBy')
					.select(['user.id', 'user.firstName as label', 'user.picture as image'])
			).as('createdBy'),
			jsonObjectFrom(
				eb
					.selectFrom('user')
					.whereRef('user.id', '=', 'anthology.updatedBy')
					.select(['user.id', 'user.firstName as label', 'user.picture as image'])
			).as('updatedBy'),
			jsonArrayFrom(
				eb
					.selectFrom('anthologyPosition')
					.whereRef('anthologyPosition.anthologyId', '=', 'anthology.id')
					.leftJoin('story', 'story.id', 'anthologyPosition.storyId')
					.select((eb) => [
						'anthologyPosition.id',
						'anthologyPosition.order',
						'story.id as storyId',
						eb
							.ref('anthologyPosition.configuration')
							.$castTo<Record<string, unknown> | null>()
							.as('configuration')
					])
					.orderBy('anthologyPosition.order', 'asc')
					.$narrowType<{ id: NotNull; order: NotNull; storyId: NotNull }>()
			).as('positions')
		])
		.execute();

	return { anthologies };
};
