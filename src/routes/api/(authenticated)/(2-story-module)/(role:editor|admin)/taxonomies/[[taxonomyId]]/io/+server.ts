import { db } from '$lib/db/database';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { hasPermission, requireParam } from '$lib/server/utils.server';
import { error, json } from '@sveltejs/kit';
import YAML from 'yaml';
import type { RequestHandler } from './$types';
import { schema } from './schemas';

const parseBody = async (request: Request) => {
	const body = await request.text();
	const contentType = request.headers.get('content-type') ?? '';

	try {
		if (contentType.includes('json')) return JSON.parse(body);
		return YAML.parse(body);
	} catch {
		return undefined;
	}
};

const stringifyOrNull = (value: unknown) =>
	value === null || value === undefined ? null : JSON.stringify(value);

const canModify = (locals: App.Locals) =>
	hasPermission(locals, {
		elevatedRoles: [UserRole.editor, UserRole.admin]
	});

const assertTaxonomy = async (clientId: string, taxonomyId: string) => {
	const taxonomy = await db
		.selectFrom('taxonomy')
		.where('taxonomy.id', '=', taxonomyId)
		.where('taxonomy.clientId', '=', clientId)
		.select('taxonomy.id')
		.executeTakeFirst();

	if (!taxonomy) throw error(404, 'The taxonomy does not exist');
};

const findOneTaxonomyById = async (clientId: string, taxonomyId: string) => {
	await assertTaxonomy(clientId, taxonomyId);

	const taxonomy = await db
		.selectFrom('taxonomy')
		.where('taxonomy.id', '=', taxonomyId)
		.where('taxonomy.clientId', '=', clientId)
		.select(['taxonomy.id', 'taxonomy.slug', 'taxonomy.name', 'taxonomy.description'])
		.executeTakeFirstOrThrow();

	const [categories, attributes, attributeOfCategories, items, itemOfCategories, attributeOfItems] =
		await Promise.all([
			db
				.selectFrom('category')
				.where('category.taxonomyId', '=', taxonomyId)
				.select([
					'category.id',
					'category.name',
					'category.image',
					'category.description',
					'category.map'
				])
				.orderBy('category.id')
				.execute(),
			db
				.selectFrom('attribute')
				.where('attribute.taxonomyId', '=', taxonomyId)
				.select([
					'attribute.id',
					'attribute.slug',
					'attribute.name',
					'attribute.image',
					'attribute.description',
					'attribute.type',
					'attribute.referencedCategoryId',
					'attribute.schema'
				])
				.orderBy('attribute.slug')
				.execute(),
			db
				.selectFrom('attributeOfCategory')
				.innerJoin('category', 'category.id', 'attributeOfCategory.categoryId')
				.innerJoin('attribute', 'attribute.id', 'attributeOfCategory.attributeId')
				.where('category.taxonomyId', '=', taxonomyId)
				.where('attribute.taxonomyId', '=', taxonomyId)
				.select([
					'attributeOfCategory.categoryId',
					'attributeOfCategory.attributeId',
					'attributeOfCategory.order',
					'attributeOfCategory.isRequired',
					'attributeOfCategory.isDefault'
				])
				.orderBy('attributeOfCategory.categoryId')
				.orderBy('attributeOfCategory.order')
				.execute(),
			db
				.selectFrom('item')
				.where('item.taxonomyId', '=', taxonomyId)
				.select('item.id')
				.orderBy('item.id')
				.execute(),
			db
				.selectFrom('itemOfCategory')
				.innerJoin('item', 'item.id', 'itemOfCategory.itemId')
				.innerJoin('category', 'category.id', 'itemOfCategory.categoryId')
				.where('item.taxonomyId', '=', taxonomyId)
				.where('category.taxonomyId', '=', taxonomyId)
				.select(['itemOfCategory.itemId', 'itemOfCategory.categoryId'])
				.orderBy('itemOfCategory.itemId')
				.orderBy('itemOfCategory.categoryId')
				.execute(),
			db
				.selectFrom('attributeOfItem')
				.innerJoin('item', 'item.id', 'attributeOfItem.itemId')
				.innerJoin('attribute', 'attribute.id', 'attributeOfItem.attributeId')
				.where('item.taxonomyId', '=', taxonomyId)
				.where('attribute.taxonomyId', '=', taxonomyId)
				.select([
					'attributeOfItem.itemId',
					'attributeOfItem.attributeId',
					'attributeOfItem.value',
					'attributeOfItem.referencedItemId',
					'attributeOfItem.difficulty'
				])
				.orderBy('attributeOfItem.itemId')
				.orderBy('attributeOfItem.attributeId')
				.execute()
		]);

	return {
		...taxonomy,
		categories,
		attributes,
		attributeOfCategories,
		items,
		itemOfCategories,
		attributeOfItems
	};
};

/**
 * @openapi
 * summary: Export taxonomy
 * tags:
 *  - Story assets
 */
export const GET = (async ({ locals, params }) => {
	const clientId = locals.client.id;
	const taxonomyId = requireParam(params.taxonomyId, 'The taxonomy parameter is required');

	const taxonomy = await findOneTaxonomyById(clientId, taxonomyId);
	const yaml = YAML.stringify(taxonomy);

	return new Response(yaml, {
		headers: {
			'content-type': 'application/yaml',
			'content-disposition': `attachment; filename="taxonomy-${taxonomy.slug}.yaml"`
		}
	});
}) satisfies RequestHandler;

/**
 * @openapi
 * summary: Import taxonomy
 * tags:
 *  - Story assets
 */
export const POST = (async ({ locals, request }) => {
	const clientId = locals.client.id;

	if (!(await canModify(locals))) throw error(403, 'You are not allowed to import taxonomies');

	const rawBody = await parseBody(request);
	if (rawBody === undefined) return json({ message: 'Invalid JSON or YAML body' }, { status: 400 });

	const body = schema.safeParse(rawBody);
	if (!body.success) {
		return json({ message: 'Invalid taxonomy body', issues: body.error.issues }, { status: 422 });
	}
	const taxonomyRaw = body.data;

	const taxonomyId = await db.transaction().execute(async (trx) => {
		let taxonomySlug = taxonomyRaw.slug;
		const exists = await trx
			.selectFrom('taxonomy')
			.where('taxonomy.slug', '=', taxonomySlug)
			.where('taxonomy.clientId', '=', clientId)
			.select('taxonomy.id')
			.executeTakeFirst();
		if (exists) taxonomySlug += `-${crypto.randomUUID().toString().slice(0, 8)}`;

		const taxonomy = await trx
			.insertInto('taxonomy')
			.values({
				clientId,
				slug: taxonomySlug,
				name: stringifyOrNull(taxonomyRaw.name),
				description: stringifyOrNull(taxonomyRaw.description)
			})
			.returning('taxonomy.id')
			.executeTakeFirstOrThrow();

		const categoryIdByOriginalId = new Map<string, string>();
		for (const categoryRaw of taxonomyRaw.categories) {
			const category = await trx
				.insertInto('category')
				.values({
					taxonomyId: taxonomy.id,
					name: JSON.stringify(categoryRaw.name),
					image: stringifyOrNull(categoryRaw.image),
					description: stringifyOrNull(categoryRaw.description),
					map: stringifyOrNull(categoryRaw.map)
				})
				.returning('category.id')
				.executeTakeFirstOrThrow();
			categoryIdByOriginalId.set(categoryRaw.id, category.id);
		}

		const attributeIdByOriginalId = new Map<string, string>();
		for (const attributeRaw of taxonomyRaw.attributes) {
			const referencedCategoryId = attributeRaw.referencedCategoryId
				? categoryIdByOriginalId.get(attributeRaw.referencedCategoryId)
				: null;
			if (attributeRaw.referencedCategoryId && !referencedCategoryId) {
				throw error(422, { message: 'An attribute references a missing category' });
			}

			const attribute = await trx
				.insertInto('attribute')
				.values({
					taxonomyId: taxonomy.id,
					slug: attributeRaw.slug,
					name: JSON.stringify(attributeRaw.name),
					image: stringifyOrNull(attributeRaw.image),
					description: stringifyOrNull(attributeRaw.description),
					type: attributeRaw.type,
					referencedCategoryId,
					schema: stringifyOrNull(attributeRaw.schema)
				})
				.returning('attribute.id')
				.executeTakeFirstOrThrow();
			attributeIdByOriginalId.set(attributeRaw.id, attribute.id);
		}

		if (taxonomyRaw.attributeOfCategories.length) {
			await trx
				.insertInto('attributeOfCategory')
				.values(
					taxonomyRaw.attributeOfCategories.map((attributeOfCategoryRaw) => {
						const categoryId = categoryIdByOriginalId.get(attributeOfCategoryRaw.categoryId);
						const attributeId = attributeIdByOriginalId.get(attributeOfCategoryRaw.attributeId);
						if (!categoryId || !attributeId) {
							throw error(422, { message: 'A category attribute references a missing record' });
						}

						return {
							categoryId,
							attributeId,
							order: attributeOfCategoryRaw.order,
							isRequired: attributeOfCategoryRaw.isRequired,
							isDefault: attributeOfCategoryRaw.isDefault
						};
					})
				)
				.execute();
		}

		const itemIdByOriginalId = new Map<string, string>();
		for (const itemRaw of taxonomyRaw.items) {
			const item = await trx
				.insertInto('item')
				.values({ taxonomyId: taxonomy.id })
				.returning('item.id')
				.executeTakeFirstOrThrow();
			itemIdByOriginalId.set(itemRaw.id, item.id);
		}

		if (taxonomyRaw.itemOfCategories.length) {
			await trx
				.insertInto('itemOfCategory')
				.values(
					taxonomyRaw.itemOfCategories.map((itemOfCategoryRaw) => {
						const itemId = itemIdByOriginalId.get(itemOfCategoryRaw.itemId);
						const categoryId = categoryIdByOriginalId.get(itemOfCategoryRaw.categoryId);
						if (!itemId || !categoryId) {
							throw error(422, { message: 'An item category references a missing record' });
						}

						return { itemId, categoryId };
					})
				)
				.execute();
		}

		if (taxonomyRaw.attributeOfItems.length) {
			await trx
				.insertInto('attributeOfItem')
				.values(
					taxonomyRaw.attributeOfItems.map((attributeOfItemRaw) => {
						const itemId = itemIdByOriginalId.get(attributeOfItemRaw.itemId);
						const attributeId = attributeIdByOriginalId.get(attributeOfItemRaw.attributeId);
						const referencedItemId = attributeOfItemRaw.referencedItemId
							? itemIdByOriginalId.get(attributeOfItemRaw.referencedItemId)
							: null;
						if (
							!itemId ||
							!attributeId ||
							(attributeOfItemRaw.referencedItemId && !referencedItemId)
						) {
							throw error(422, { message: 'An item attribute references a missing record' });
						}

						return {
							itemId,
							attributeId,
							value: stringifyOrNull(attributeOfItemRaw.value),
							referencedItemId,
							difficulty: attributeOfItemRaw.difficulty
						};
					})
				)
				.execute();
		}

		return taxonomy.id;
	});

	const taxonomy = await findOneTaxonomyById(clientId, taxonomyId);
	return json(taxonomy, { status: 201 });
}) satisfies RequestHandler;
