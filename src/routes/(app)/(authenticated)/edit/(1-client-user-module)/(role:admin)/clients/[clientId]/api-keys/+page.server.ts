import { db } from '$lib/db/database';
import { sql } from 'kysely';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const clientId = params.clientId;

	const apiKeys = await db
		.selectFrom('clientApiKey')
		.where('clientApiKey.clientId', '=', clientId)
		.select((eb) => [
			'clientApiKey.id',
			'clientApiKey.clientId',
			'clientApiKey.name',
			sql<string>`substring(${eb.ref('clientApiKey.secret')} from 1 for 2) || repeat('•', greatest(length(${eb.ref('clientApiKey.secret')}) - 4, 1)) || substring(${eb.ref('clientApiKey.secret')} from greatest(length(${eb.ref('clientApiKey.secret')}) - 1, 1) for 2)`.as('secret'),
			'clientApiKey.scopes',
			'clientApiKey.lastUsedAt',
			'clientApiKey.createdAt',
			'clientApiKey.updatedAt',
			jsonObjectFrom(
				eb
					.selectFrom('client')
					.whereRef('client.id', '=', 'clientApiKey.clientId')
					.select(['client.id', 'client.name as label'])
			).as('client'),
			jsonObjectFrom(
				eb
					.selectFrom('user')
					.whereRef('user.id', '=', 'clientApiKey.createdBy')
					.select((eb) => [
						'user.id',
						eb
							.fn<string | null>('nullif', [
								eb.fn<string>('btrim', [
									eb.fn<string>('concat', [
										'user.firstName',
										eb.cast<string>(eb.val(' '), 'text'),
										'user.lastName'
									])
								]),
								eb.val('')
							])
							.as('label'),
						'user.picture as image'
					])
			).as('createdBy'),
			jsonObjectFrom(
				eb
					.selectFrom('user')
					.whereRef('user.id', '=', 'clientApiKey.updatedBy')
					.select((eb) => [
						'user.id',
						eb
							.fn<string | null>('nullif', [
								eb.fn<string>('btrim', [
									eb.fn<string>('concat', [
										'user.firstName',
										eb.cast<string>(eb.val(' '), 'text'),
										'user.lastName'
									])
								]),
								eb.val('')
							])
							.as('label'),
						'user.picture as image'
					])
			).as('updatedBy')
		])
		.orderBy('clientApiKey.lastUsedAt')
		.execute();

	return { apiKeys };
};
