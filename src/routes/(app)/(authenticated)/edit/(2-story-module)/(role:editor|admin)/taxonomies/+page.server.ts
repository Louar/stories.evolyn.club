import { db } from '$lib/db/database';
import { sql } from 'kysely';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const clientId = locals.client.id;

	const taxonomies = await db
		.selectFrom('taxonomy')
		.where('taxonomy.clientId', '=', clientId)
		.select((eb) => [
			'taxonomy.id',
			'taxonomy.clientId',
			'taxonomy.name',
			'taxonomy.description',
			sql<number>`(
				select count(*)::int
				from category
				where category.taxonomy_id = ${eb.ref('taxonomy.id')}
			)`.as('categories'),
			sql<number>`(
				select count(*)::int
				from attribute
				where attribute.taxonomy_id = ${eb.ref('taxonomy.id')}
			)`.as('attributes'),
			sql<number>`(
				select count(*)::int
				from item
				where item.taxonomy_id = ${eb.ref('taxonomy.id')}
			)`.as('items'),
		])
		.orderBy('taxonomy.name')
		.execute();

	return { taxonomies };
};
