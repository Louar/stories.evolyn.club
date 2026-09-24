import { db } from '$lib/db/database';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { error } from '@sveltejs/kit';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.authusr?.roles.includes(UserRole.admin)) {
		error(403, 'You are not allowed to edit policies');
	}

	const clientId = locals.client.id;

	const policies = await db
		.selectFrom('license')
		.where('license.clientId', '=', clientId)
		.select((eb) => [
			'license.id',
			'license.name',
			'license.version',
			'license.termsOfUse',
			'license.privacyPolicy',
			'license.createdAt',
			'license.updatedAt',
			eb
				.selectFrom('licenseAgreement')
				.whereRef('licenseAgreement.licenseId', '=', 'license.id')
				.select(eb.fn.countAll<number>().as('agreements'))
				.as('agreements'),
			jsonObjectFrom(
				eb
					.selectFrom('user')
					.whereRef('user.id', '=', 'license.createdBy')
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
					.whereRef('user.id', '=', 'license.updatedBy')
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
		.orderBy('license.updatedAt', 'desc')
		.orderBy('license.id', 'desc')
		.execute();

	return { policies };
};
