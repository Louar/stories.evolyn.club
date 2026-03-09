import { db } from '$lib/db/database';
import { selectLocalizedField } from '$lib/db/schemas/0-utils';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (async ({ locals, params }) => {
	const clientId = locals.client.id;
	const language = locals.authusr!.language;
	const anthologyId = params.anthologyId;

	const anthology = await db
		.selectFrom('anthology')
		.where('anthology.clientId', '=', clientId)
		.where('anthology.id', '=', anthologyId)
		.select((eb) => [
			'anthology.id',
			'anthology.reference',
			selectLocalizedField(eb, 'anthology.name', language).as('name'),
			'anthology.isPublished',
			'anthology.isPublic'
		])
		.executeTakeFirstOrThrow();

	const permissions = await db
		.selectFrom('anthologyPermission')
		.innerJoin('anthology', 'anthology.id', 'anthologyPermission.anthologyId')
		.where('anthology.clientId', '=', clientId)
		.where('anthologyPermission.anthologyId', '=', anthologyId)
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
		.orderBy('anthologyPermission.id')
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

	return { anthology, permissions, relations: { users } };
});
