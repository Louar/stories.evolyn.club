import type { TaxonomyRound } from '$lib/components/app/player/taxonomy/types';
import { db } from '$lib/db/database';
import { selectLocalizedField, type Language } from '$lib/db/schemas/0-utils';
import {
	AttributeType,
	type AttributeType as AttributeTypeValue
} from '$lib/db/schemas/2-story-module';
import { error } from '@sveltejs/kit';
import { sql } from 'kysely';

const randomItem = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];

const defaults = {
	nrOfRounds: 5,
	nrOfItemsPerRound: 4,
	goal: 1,
	maxMistakes: null,
	difficulty: null
};

export async function loadTaxonomyGame(clientId: string, draftId: string, language?: Language) {
	const draft = await db
		.selectFrom('taxonomyDraftForPart')
		.innerJoin('taxonomy', 'taxonomy.id', 'taxonomyDraftForPart.taxonomyId')
		.where('taxonomy.clientId', '=', clientId)
		.where('taxonomyDraftForPart.id', '=', draftId)
		.select((eb) => [
			'taxonomyDraftForPart.id',
			'taxonomyDraftForPart.taxonomyId',
			'taxonomyDraftForPart.nrOfRounds',
			'taxonomyDraftForPart.nrOfItemsPerRound',
			'taxonomyDraftForPart.goal',
			'taxonomyDraftForPart.maxMistakes',
			'taxonomyDraftForPart.difficulty',
			'taxonomyDraftForPart.defaultNextPartId',
			sql<string[]>`coalesce((
				select jsonb_agg(drafted_category.category_id)
				from drafted_category
				where drafted_category.taxonomy_draft_for_part_id = ${eb.ref('taxonomyDraftForPart.id')}
			), '[]'::jsonb)`.as('categories'),
			sql<string[]>`coalesce((
				select jsonb_agg(drafted_attribute.attribute_id)
				from drafted_attribute
				where drafted_attribute.taxonomy_draft_for_part_id = ${eb.ref('taxonomyDraftForPart.id')}
			), '[]'::jsonb)`.as('attributes'),
			sql<string[]>`coalesce((
				select jsonb_agg(drafted_item.item_id)
				from drafted_item
				where drafted_item.taxonomy_draft_for_part_id = ${eb.ref('taxonomyDraftForPart.id')}
			), '[]'::jsonb)`.as('items')
		])
		.executeTakeFirst();

	if (!draft) throw error(404, 'The draft does not exist');

	const nrOfRounds = draft.nrOfRounds ?? defaults.nrOfRounds;
	const nrOfItemsPerRound = draft.nrOfItemsPerRound ?? defaults.nrOfItemsPerRound;
	const goal = Math.min(draft.goal ?? defaults.goal, nrOfRounds);
	const maxMistakes = draft.maxMistakes ?? defaults.maxMistakes;
	const difficulty = draft.difficulty ?? defaults.difficulty;
	const selectedCategoryIds = draft.categories;
	const selectedAttributeIds = draft.attributes;
	const selectedItemIds = draft.items;

	const [combinations, rules] = await Promise.all([
		db
			.selectFrom('category')
			.innerJoin('taxonomy', 'taxonomy.id', 'category.taxonomyId')
			.innerJoin('attributeOfCategory as targetCategoryAttribute', (join) =>
				join.onRef('targetCategoryAttribute.categoryId', '=', 'category.id')
			)
			.innerJoin(
				'attribute as targetAttribute',
				'targetAttribute.id',
				'targetCategoryAttribute.attributeId'
			)
			.innerJoin('itemOfCategory', 'itemOfCategory.categoryId', 'category.id')
			.innerJoin('attributeOfItem as targetItemAttribute', (join) =>
				join
					.onRef('targetItemAttribute.itemId', '=', 'itemOfCategory.itemId')
					.onRef('targetItemAttribute.attributeId', '=', 'targetAttribute.id')
			)
			.where('taxonomy.clientId', '=', clientId)
			.where('category.taxonomyId', '=', draft.taxonomyId)
			.$if(selectedCategoryIds.length > 0, (qb) =>
				qb.where('category.id', 'in', selectedCategoryIds)
			)
			.$if(selectedAttributeIds.length > 0, (qb) =>
				qb.where('targetAttribute.id', 'in', selectedAttributeIds)
			)
			.$if(selectedItemIds.length > 0, (qb) =>
				qb.where('itemOfCategory.itemId', 'in', selectedItemIds)
			)
			.$if(difficulty !== null, (qb) =>
				qb.where('targetItemAttribute.difficulty', '<=', difficulty)
			)
			.whereRef('targetAttribute.taxonomyId', '=', 'category.taxonomyId')
			.where('targetAttribute.type', 'in', [
				AttributeType.number,
				AttributeType.itemReference,
				AttributeType.translatableCategory
			])
			.where((eb) =>
				eb.or([
					eb('targetCategoryAttribute.isDefault', '=', false),
					eb('targetAttribute.type', '=', AttributeType.translatableCategory)
				])
			)
			.where((eb) =>
				eb.or([
					eb.and([
						eb('targetAttribute.type', '=', AttributeType.number),
						eb('targetItemAttribute.value', 'is not', null)
					]),
					eb.and([
						eb('targetAttribute.type', '=', AttributeType.translatableCategory),
						eb('targetItemAttribute.value', 'is not', null),
						eb('category.map', 'is not', null)
					]),
					eb.and([
						eb('targetAttribute.type', '=', AttributeType.itemReference),
						eb('targetItemAttribute.referencedItemId', 'is not', null)
					])
				])
			)
			.where((eb) =>
				eb.exists(
					eb
						.selectFrom('attributeOfCategory as defaultAttribute')
						.innerJoin('attributeOfItem as nameAttribute', (join) =>
							join
								.onRef('nameAttribute.itemId', '=', 'itemOfCategory.itemId')
								.onRef('nameAttribute.attributeId', '=', 'defaultAttribute.attributeId')
						)
						.whereRef('defaultAttribute.categoryId', '=', 'category.id')
						.where('defaultAttribute.isDefault', '=', true)
						.where((innerEb) =>
							innerEb(
								innerEb.fn.coalesce(
									sql<
										string | null
									>`${innerEb.ref('nameAttribute.value')}->>${language ?? 'default'}`,
									sql<string | null>`${innerEb.ref('nameAttribute.value')}->>'default'`,
									sql<string | null>`${innerEb.ref('nameAttribute.value')}->>'en'`
								),
								'is not',
								null
							)
						)
						.select('defaultAttribute.attributeId')
				)
			)
			.select((eb) => [
				'category.id as categoryId',
				'category.taxonomyId',
				selectLocalizedField(eb, 'category.name', language).as('categoryName'),
				'targetAttribute.id as attributeId',
				selectLocalizedField(eb, 'targetAttribute.name', language).as('attributeName'),
				'targetAttribute.type as attributeType',
				'targetAttribute.referencedCategoryId'
			])
			.groupBy(['category.id', 'category.taxonomyId', 'targetAttribute.id'])
			.having((eb) => eb.fn.count('itemOfCategory.itemId'), '>=', nrOfItemsPerRound)
			.execute(),
		db
			.selectFrom('taxonomyDraftLogicRule')
			.where('taxonomyDraftLogicRule.taxonomyDraftForPartId', '=', draft.id)
			.select([
				'taxonomyDraftLogicRule.id',
				'taxonomyDraftLogicRule.order',
				'taxonomyDraftLogicRule.nextPartId',
				'taxonomyDraftLogicRule.nrOfRounds',
				'taxonomyDraftLogicRule.score',
				'taxonomyDraftLogicRule.mistakes',
				'taxonomyDraftLogicRule.duration'
			])
			.orderBy('taxonomyDraftLogicRule.order', 'asc')
			.execute()
	]);

	const categories = Object.values(
		combinations.reduce<
			Record<
				string,
				{
					id: string;
					taxonomyId: string;
					name: string | null;
					attributes: {
						id: string;
						name: string | null;
						referencedCategoryId: string | null;
						type: AttributeTypeValue;
					}[];
				}
			>
		>((categories, combination) => {
			categories[combination.categoryId] ??= {
				id: combination.categoryId,
				taxonomyId: combination.taxonomyId,
				name: combination.categoryName,
				attributes: []
			};
			categories[combination.categoryId].attributes.push({
				id: combination.attributeId,
				name: combination.attributeName,
				referencedCategoryId: combination.referencedCategoryId,
				type: combination.attributeType
			});
			return categories;
		}, {})
	);

	const rounds = await Promise.all(
		Array.from({ length: nrOfRounds }, async (): Promise<TaxonomyRound | null> => {
			const category = randomItem(categories);
			if (!category) return null;
			const attribute = randomItem(category.attributes);
			const mapCategoryId =
				attribute.type === AttributeType.translatableCategory
					? category.id
					: attribute.referencedCategoryId;
			const mapCategory = mapCategoryId
				? await db
						.selectFrom('category')
						.where('category.id', '=', mapCategoryId)
						.where('category.taxonomyId', '=', category.taxonomyId)
						.select(['category.map', 'category.taxonomyId'])
						.executeTakeFirst()
				: null;
			const mapItems = mapCategoryId
				? await db
						.selectFrom('item as mapItem')
						.innerJoin('itemOfCategory as mapItemOfCategory', (join) =>
							join
								.onRef('mapItemOfCategory.itemId', '=', 'mapItem.id')
								.on('mapItemOfCategory.categoryId', '=', mapCategoryId)
						)
						.innerJoin('attribute as shapeAttribute', (join) =>
							join
								.on('shapeAttribute.taxonomyId', '=', category.taxonomyId)
								.on('shapeAttribute.slug', '=', 'shape')
						)
						.innerJoin('attributeOfItem as shapeItemAttribute', (join) =>
							join
								.onRef('shapeItemAttribute.itemId', '=', 'mapItem.id')
								.onRef('shapeItemAttribute.attributeId', '=', 'shapeAttribute.id')
						)
						.leftJoin('attribute as centerAttribute', (join) =>
							join
								.on('centerAttribute.taxonomyId', '=', category.taxonomyId)
								.on('centerAttribute.slug', '=', 'center')
						)
						.leftJoin('attributeOfItem as centerItemAttribute', (join) =>
							join
								.onRef('centerItemAttribute.itemId', '=', 'mapItem.id')
								.onRef('centerItemAttribute.attributeId', '=', 'centerAttribute.id')
						)
						.leftJoin('attribute as colorAttribute', (join) =>
							join
								.on('colorAttribute.taxonomyId', '=', category.taxonomyId)
								.on('colorAttribute.slug', '=', 'color')
						)
						.leftJoin('attributeOfItem as colorItemAttribute', (join) =>
							join
								.onRef('colorItemAttribute.itemId', '=', 'mapItem.id')
								.onRef('colorItemAttribute.attributeId', '=', 'colorAttribute.id')
						)
						.where('mapItem.taxonomyId', '=', category.taxonomyId)
						.where('shapeItemAttribute.value', 'is not', null)
						.select((eb) => [
							'mapItem.id as id',
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
								inner join attribute_of_item as name_attribute
									on name_attribute.item_id = ${eb.ref('mapItem.id')}
									and name_attribute.attribute_id = default_attribute.attribute_id
								where default_attribute.category_id = ${eb.ref('mapItemOfCategory.categoryId')}
									and default_attribute.is_default = true
							)`.as('name'),
							'shapeItemAttribute.value as shape',
							'centerItemAttribute.value as center',
							'colorItemAttribute.value as color'
						])
						.execute()
				: [];

			const items = await db
				.selectFrom('item')
				.innerJoin('itemOfCategory', 'itemOfCategory.itemId', 'item.id')
				.innerJoin('attributeOfItem as targetItemAttribute', (join) =>
					join
						.onRef('targetItemAttribute.itemId', '=', 'item.id')
						.on('targetItemAttribute.attributeId', '=', attribute.id)
				)
				.innerJoin(
					'attribute as targetAttribute',
					'targetAttribute.id',
					'targetItemAttribute.attributeId'
				)
				.leftJoin(
					'item as referencedItem',
					'referencedItem.id',
					'targetItemAttribute.referencedItemId'
				)
				.where('item.taxonomyId', '=', category.taxonomyId)
				.where('itemOfCategory.categoryId', '=', category.id)
				.$if(selectedItemIds.length > 0, (qb) => qb.where('item.id', 'in', selectedItemIds))
				.$if(difficulty !== null, (qb) =>
					qb.where('targetItemAttribute.difficulty', '<=', difficulty)
				)
				.where((eb) =>
					eb.or([
						eb.and([
							eb('targetAttribute.type', '=', AttributeType.number),
							eb('targetItemAttribute.value', 'is not', null)
						]),
						eb.and([
							eb('targetAttribute.type', '=', AttributeType.translatableCategory),
							eb('targetItemAttribute.value', 'is not', null)
						]),
						eb.and([
							eb('targetAttribute.type', '=', AttributeType.itemReference),
							eb('targetItemAttribute.referencedItemId', 'is not', null)
						])
					])
				)
				.where((eb) =>
					eb.exists(
						eb
							.selectFrom('attributeOfCategory as defaultAttribute')
							.innerJoin('attributeOfItem as nameAttribute', (join) =>
								join
									.onRef('nameAttribute.itemId', '=', 'item.id')
									.onRef('nameAttribute.attributeId', '=', 'defaultAttribute.attributeId')
							)
							.whereRef('defaultAttribute.categoryId', '=', 'itemOfCategory.categoryId')
							.where('defaultAttribute.isDefault', '=', true)
							.where((innerEb) =>
								innerEb(
									innerEb.fn.coalesce(
										sql<
											string | null
										>`${innerEb.ref('nameAttribute.value')}->>${language ?? 'default'}`,
										sql<string | null>`${innerEb.ref('nameAttribute.value')}->>'default'`,
										sql<string | null>`${innerEb.ref('nameAttribute.value')}->>'en'`
									),
									'is not',
									null
								)
							)
							.select('defaultAttribute.attributeId')
					)
				)
				.select((eb) => [
					'item.id as id',
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
						inner join attribute_of_item as name_attribute
							on name_attribute.item_id = ${eb.ref('item.id')}
							and name_attribute.attribute_id = default_attribute.attribute_id
						where default_attribute.category_id = ${eb.ref('itemOfCategory.categoryId')}
							and default_attribute.is_default = true
					)`.as('name'),
					'targetItemAttribute.value as value',
					'targetItemAttribute.referencedItemId as referencedItemId',
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
						inner join attribute_of_item as name_attribute
							on name_attribute.item_id = ${eb.ref('referencedItem.id')}
							and name_attribute.attribute_id = default_attribute.attribute_id
						where default_attribute.category_id = ${eb.ref('targetAttribute.referencedCategoryId')}
							and default_attribute.is_default = true
					)`.as('referencedName')
				])
				.orderBy(sql`random()`)
				.limit(nrOfItemsPerRound)
				.execute();

			return {
				category: {
					id: category.id,
					name: category.name
				},
				attribute: {
					id: attribute.id,
					name: attribute.name,
					referencedCategoryId: attribute.referencedCategoryId,
					type: attribute.type
				},
				items,
				map: mapCategory?.map ?? null,
				mapItems
			};
		})
	);

	return {
		rounds: rounds.filter((round): round is TaxonomyRound => round !== null),
		goal,
		maxMistakes,
		showHints: false as const,
		logic: {
			defaultNextPartId: draft.defaultNextPartId,
			rules
		}
	};
}
