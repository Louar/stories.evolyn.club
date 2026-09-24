import { db } from '$lib/db/database';
import { error } from '@sveltejs/kit';
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

	const attributes = await db
		.selectFrom('attribute')
		.where('attribute.taxonomyId', '=', taxonomyId)
		.select([
			'attribute.id',
			'attribute.taxonomyId',
			'attribute.slug',
			'attribute.name',
			'attribute.image',
			'attribute.description',
			'attribute.type',
			'attribute.referencedCategoryId',
			'attribute.schema'
		])
		.orderBy('attribute.slug')
		.execute();

	const categories = await db
		.selectFrom('category')
		.where('category.taxonomyId', '=', taxonomyId)
		.select(['category.id', 'category.name'])
		.orderBy('category.id')
		.execute();

	return { taxonomy, attributes, categories };
};
