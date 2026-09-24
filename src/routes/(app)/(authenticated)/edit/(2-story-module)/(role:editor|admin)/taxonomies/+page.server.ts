import { db } from '$lib/db/database';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const clientId = locals.client.id;

	const taxonomies = await db
		.selectFrom('taxonomy')
		.where('taxonomy.clientId', '=', clientId)
		.select((eb) => [
			'taxonomy.id',
			'taxonomy.clientId',
			'taxonomy.slug',
			'taxonomy.name',
			'taxonomy.description',
			eb
				.selectFrom('category')
				.whereRef('category.taxonomyId', '=', 'taxonomy.id')
				.select(eb.fn.countAll<number>().as('categories'))
				.as('categories'),
			eb
				.selectFrom('attribute')
				.whereRef('attribute.taxonomyId', '=', 'taxonomy.id')
				.select(eb.fn.countAll<number>().as('attributes'))
				.as('attributes'),
			eb
				.selectFrom('item')
				.whereRef('item.taxonomyId', '=', 'taxonomy.id')
				.select(eb.fn.countAll<number>().as('items'))
				.as('items')
		])
		.orderBy('taxonomy.name')
		.execute();

	return { taxonomies };
};
