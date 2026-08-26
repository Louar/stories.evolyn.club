import { db } from '$lib/db/database';
import { error } from '@sveltejs/kit';
import { sql } from 'kysely';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const taxonomyId = params.taxonomyId;

	const taxonomy = await db
		.selectFrom('taxonomy')
		.where('taxonomy.id', '=', taxonomyId)
		.where('taxonomy.clientId', '=', clientId)
		.select(['taxonomy.id', 'taxonomy.name'])
		.executeTakeFirst();

	if (!taxonomy) throw error(404, 'The taxonomy does not exist');

	const categories = await db
		.selectFrom('category')
		.where('category.taxonomyId', '=', taxonomyId)
		.select((eb) => [
			'category.id',
			'category.taxonomyId',
			'category.name',
			'category.image',
			'category.description',
			'category.map',
			sql<number>`(
				select count(*)::int
				from attribute_of_category
				where attribute_of_category.category_id = ${eb.ref('category.id')}
			)`.as('attributes')
		])
		.orderBy('category.id')
		.execute();

	return { taxonomy, categories };
};
