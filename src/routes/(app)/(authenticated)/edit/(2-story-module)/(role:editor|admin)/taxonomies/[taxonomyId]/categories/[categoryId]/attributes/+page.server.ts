import { db } from '$lib/db/database';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const taxonomyId = params.taxonomyId;
	const categoryId = params.categoryId;

	const category = await db
		.selectFrom('category')
		.innerJoin('taxonomy', 'taxonomy.id', 'category.taxonomyId')
		.where('category.id', '=', categoryId)
		.where('category.taxonomyId', '=', taxonomyId)
		.where('taxonomy.clientId', '=', clientId)
		.select(['category.id', 'category.name', 'taxonomy.id as taxonomyId', 'taxonomy.name as taxonomyName'])
		.executeTakeFirst();

	if (!category) throw error(404, 'The category does not exist');

	const attributeOptions = await db
		.selectFrom('attribute')
		.where('attribute.taxonomyId', '=', taxonomyId)
		.select(['attribute.id', 'attribute.slug', 'attribute.name'])
		.orderBy('attribute.slug')
		.execute();

	const attributes = await db
		.selectFrom('attributeOfCategory')
		.innerJoin('attribute', 'attribute.id', 'attributeOfCategory.attributeId')
		.where('attributeOfCategory.categoryId', '=', categoryId)
		.where('attribute.taxonomyId', '=', taxonomyId)
		.select([
			'attributeOfCategory.categoryId',
			'attributeOfCategory.attributeId',
			'attributeOfCategory.order',
			'attributeOfCategory.isRequired',
			'attributeOfCategory.isDefault',
			'attribute.slug',
			'attribute.name'
		])
		.orderBy('attributeOfCategory.order')
		.orderBy('attribute.slug')
		.execute();

	return { category, attributes, attributeOptions };
};
