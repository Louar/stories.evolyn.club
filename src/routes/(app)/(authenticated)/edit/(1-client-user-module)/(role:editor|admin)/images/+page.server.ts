import { db } from '$lib/db/database';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	images: await db
		.selectFrom('clientMedia')
		.where('clientMedia.clientId', '=', locals.client.id)
		.where('clientMedia.extension', 'in', ['gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'])
		.select((eb) => [
			'clientMedia.id',
			'clientMedia.name',
			'clientMedia.extension',
			'clientMedia.description',
			'clientMedia.size',
			'clientMedia.createdAt',
			'clientMedia.updatedAt',
			jsonObjectFrom(
				eb
					.selectFrom('user')
					.whereRef('user.id', '=', 'clientMedia.updatedBy')
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
		.orderBy('clientMedia.updatedAt', 'desc')
		.execute()
});
