import { db } from '$lib/db/database';
import { error } from '@sveltejs/kit';
import { sql } from 'kysely';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const language = locals.authusr?.language;
	const taxonomyId = params.taxonomyId;

	const taxonomy = await db
		.selectFrom('taxonomy')
		.where('taxonomy.id', '=', taxonomyId)
		.where('taxonomy.clientId', '=', clientId)
		.select(['taxonomy.id', 'taxonomy.name'])
		.executeTakeFirst();

	if (!taxonomy) throw error(404, 'The taxonomy does not exist');

	const items = await db
		.selectFrom('item')
		.where('item.taxonomyId', '=', taxonomyId)
		.select((eb) => [
			'item.id',
			'item.taxonomyId',
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
				from item_of_category
				inner join attribute_of_category as default_attribute
					on default_attribute.category_id = item_of_category.category_id
					and default_attribute.is_default = true
				left join attribute_of_item as name_attribute
					on name_attribute.item_id = ${eb.ref('item.id')}
					and name_attribute.attribute_id = default_attribute.attribute_id
				where item_of_category.item_id = ${eb.ref('item.id')}
			)`.as('name'),
			sql<string[]>`coalesce((
				select jsonb_agg(item_of_category.category_id)
				from item_of_category
				where item_of_category.item_id = ${eb.ref('item.id')}
			), '[]'::jsonb)`.as('categories'),
			eb
				.selectFrom('attributeOfItem')
				.whereRef('attributeOfItem.itemId', '=', 'item.id')
				.select(eb.fn.countAll<number>().as('attributes'))
				.as('attributes')
		])
		.orderBy('item.id')
		.execute();

	const categories = await db
		.selectFrom('category')
		.where('category.taxonomyId', '=', taxonomyId)
		.select(['category.id', 'category.name'])
		.orderBy('category.id')
		.execute();

	return { taxonomy, items, categories };
};
