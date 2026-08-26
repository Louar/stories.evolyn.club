import { db } from '$lib/db/database';
import { error } from '@sveltejs/kit';
import { sql } from 'kysely';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const language = locals.authusr?.language;
	const taxonomyId = params.taxonomyId;
	const itemId = params.itemId;

	const item = await db
		.selectFrom('item')
		.innerJoin('taxonomy', 'taxonomy.id', 'item.taxonomyId')
		.where('item.id', '=', itemId)
		.where('item.taxonomyId', '=', taxonomyId)
		.where('taxonomy.clientId', '=', clientId)
		.select(['item.id', 'taxonomy.id as taxonomyId', 'taxonomy.name as taxonomyName'])
		.executeTakeFirst();

	if (!item) throw error(404, 'The item does not exist');

	const attributeOptions = await db
		.selectFrom('attribute')
		.innerJoin('attributeOfCategory', 'attributeOfCategory.attributeId', 'attribute.id')
		.innerJoin('itemOfCategory', 'itemOfCategory.categoryId', 'attributeOfCategory.categoryId')
		.where('itemOfCategory.itemId', '=', itemId)
		.where('attribute.taxonomyId', '=', taxonomyId)
		.select([
			'attribute.id',
			'attribute.slug',
			'attribute.name',
			'attribute.type',
			'attribute.referencedCategoryId'
		])
		.distinct()
		.orderBy('attribute.slug')
		.execute();

	const attributes = await db
		.selectFrom('attributeOfItem')
		.innerJoin('attribute', 'attribute.id', 'attributeOfItem.attributeId')
		.where('attributeOfItem.itemId', '=', itemId)
		.where('attribute.taxonomyId', '=', taxonomyId)
		.select([
			'attributeOfItem.itemId',
			'attributeOfItem.attributeId',
			'attributeOfItem.value',
			'attributeOfItem.referencedItemId',
			'attributeOfItem.difficulty',
			'attribute.slug',
			'attribute.name',
			'attribute.type',
			'attribute.referencedCategoryId'
		])
		.orderBy('attribute.slug')
		.execute();

	const referencedItemOptions = await db
		.selectFrom('item as referencedItem')
		.innerJoin('itemOfCategory as membership', 'membership.itemId', 'referencedItem.id')
		.innerJoin('category', 'category.id', 'membership.categoryId')
		.where('referencedItem.taxonomyId', '=', taxonomyId)
		.select((eb) => [
			'referencedItem.id',
			'membership.categoryId',
			'category.name as categoryName',
			sql<string | null>`(
				select nullif(
					string_agg(
						coalesce(
							name_attribute.value->>${language ?? 'default'},
							name_attribute.value->>'default',
							name_attribute.value->>'en'
						),
						' '
						order by default_attribute.order nulls last, default_attribute.attribute_id
					),
					''
				)
				from attribute_of_category as default_attribute
				left join attribute_of_item as name_attribute
					on name_attribute.item_id = ${eb.ref('referencedItem.id')}
					and name_attribute.attribute_id = default_attribute.attribute_id
				where default_attribute.category_id = ${eb.ref('membership.categoryId')}
					and default_attribute.is_default = true
			)`.as('name')
		])
		.orderBy('referencedItem.id')
		.execute();

	return { item, attributes, attributeOptions, referencedItemOptions };
};
