import { db } from '$lib/db/database';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { AttributeType } from '$lib/db/schemas/2-story-module';
import {
	hasPermission,
	isUniqueViolation,
	parseBody,
	requireParam
} from '$lib/server/utils.server';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	attributeOfItemCreateSchema as createSchema,
	attributeOfItemPatchSchema as patchSchema
} from './schemas';

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

const assertItem = async (taxonomyId: string, itemId: string) => {
	const item = await db
		.selectFrom('item')
		.where('item.id', '=', itemId)
		.where('item.taxonomyId', '=', taxonomyId)
		.select('item.id')
		.executeTakeFirst();
	if (!item) throw error(404, 'The item does not exist');
};

const findEligibleAttribute = async (taxonomyId: string, itemId: string, attributeId?: string) => {
	let query = db
		.selectFrom('attribute')
		.innerJoin('attributeOfCategory', 'attributeOfCategory.attributeId', 'attribute.id')
		.innerJoin('itemOfCategory', 'itemOfCategory.categoryId', 'attributeOfCategory.categoryId')
		.leftJoin('attributeOfItem', (join) =>
			join
				.onRef('attributeOfItem.attributeId', '=', 'attribute.id')
				.on('attributeOfItem.itemId', '=', itemId)
		)
		.where('itemOfCategory.itemId', '=', itemId)
		.where('attribute.taxonomyId', '=', taxonomyId)
		.select(['attribute.id', 'attribute.type', 'attribute.referencedCategoryId'])
		.distinct()
		.orderBy('attribute.slug');

	if (attributeId) query = query.where('attribute.id', '=', attributeId);
	else query = query.where('attributeOfItem.attributeId', 'is', null);

	return query.executeTakeFirst();
};

const findAttributeForItem = async (taxonomyId: string, itemId: string, attributeId: string) => {
	const attribute = await findEligibleAttribute(taxonomyId, itemId, attributeId);
	if (!attribute) throw error(404, 'The item attribute does not exist');
	return attribute;
};

const validateReferencedItem = async (
	taxonomyId: string,
	attribute: { type: string; referencedCategoryId: string | null },
	referencedItemId: string | null | undefined
) => {
	if (!referencedItemId) return;

	if (attribute.type !== AttributeType.itemReference) {
		throw error(422, { message: 'Referenced items can only be set on item-reference attributes' });
	}

	let query = db
		.selectFrom('item')
		.where('item.id', '=', referencedItemId)
		.where('item.taxonomyId', '=', taxonomyId)
		.select('item.id');

	if (attribute.referencedCategoryId) {
		query = query
			.innerJoin('itemOfCategory', 'itemOfCategory.itemId', 'item.id')
			.where('itemOfCategory.categoryId', '=', attribute.referencedCategoryId);
	}

	const item = await query.executeTakeFirst();
	if (!item) throw error(422, { message: 'The referenced item does not exist' });
};

const findOneAttributeOfItem = async (taxonomyId: string, itemId: string, attributeId: string) => {
	const row = await db
		.selectFrom('attributeOfItem')
		.innerJoin('attribute', 'attribute.id', 'attributeOfItem.attributeId')
		.where('attributeOfItem.itemId', '=', itemId)
		.where('attributeOfItem.attributeId', '=', attributeId)
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
		.executeTakeFirst();

	if (!row) throw error(404, 'The item attribute does not exist');
	return row;
};

/**
 * @openapi
 * summary: Get item attribute
 * tags:
 *  - Story assets
 *  - Assistant
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const taxonomyId = requireParam(params.taxonomyId, 'The taxonomy parameter is required');
	const itemId = requireParam(params.itemId, 'The item parameter is required');
	const attributeId = requireParam(params.attributeId, 'The attribute parameter is required');

	await assertTaxonomy(clientId, taxonomyId);
	const row = await findOneAttributeOfItem(taxonomyId, itemId, attributeId);
	return json(row);
};

/**
 * @openapi
 * summary: Create item attribute
 * tags:
 *  - Story assets
 *  - Assistant
 */
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const clientId = locals.client.id;
	const taxonomyId = requireParam(params.taxonomyId, 'The taxonomy parameter is required');
	const itemId = requireParam(params.itemId, 'The item parameter is required');

	if (!(await canModify(locals))) throw error(403, 'You are not allowed to create item attributes');

	const parsed = await parseBody(request, createSchema);
	if (!parsed.ok) return parsed.response;

	await assertTaxonomy(clientId, taxonomyId);
	await assertItem(taxonomyId, itemId);
	const attribute = await findEligibleAttribute(taxonomyId, itemId, parsed.data.attributeId);
	if (!attribute) {
		return json(
			{
				errors: {
					attributeId: ["Select an attribute associated with one of this item's categories"]
				}
			},
			{ status: 422 }
		);
	}
	await validateReferencedItem(taxonomyId, attribute, parsed.data.referencedItemId);

	try {
		await db
			.insertInto('attributeOfItem')
			.values({
				itemId,
				attributeId: attribute.id,
				value: parsed.data.value,
				referencedItemId: parsed.data.referencedItemId,
				difficulty: parsed.data.difficulty
			})
			.executeTakeFirstOrThrow();

		const row = await findOneAttributeOfItem(taxonomyId, itemId, attribute.id);
		return json(row, { status: 201 });
	} catch (e) {
		if (isUniqueViolation(e)) {
			return json(
				{ errors: { attributeId: ['This attribute is already associated with the item'] } },
				{ status: 422 }
			);
		}
		throw e;
	}
};

/**
 * @openapi
 * summary: Update item attribute
 * tags:
 *  - Story assets
 *  - Assistant
 */
export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const clientId = locals.client.id;
	const taxonomyId = requireParam(params.taxonomyId, 'The taxonomy parameter is required');
	const itemId = requireParam(params.itemId, 'The item parameter is required');
	const attributeId = requireParam(params.attributeId, 'The attribute parameter is required');

	if (!(await canModify(locals)))
		throw error(403, 'You are not allowed to update this item attribute');

	const parsed = await parseBody(request, patchSchema);
	if (!parsed.ok) return parsed.response;

	await assertTaxonomy(clientId, taxonomyId);
	await assertItem(taxonomyId, itemId);
	const attribute = await findAttributeForItem(
		taxonomyId,
		itemId,
		parsed.data.attributeId ?? attributeId
	);
	await validateReferencedItem(taxonomyId, attribute, parsed.data.referencedItemId);

	try {
		const updated = await db
			.updateTable('attributeOfItem')
			.where('attributeOfItem.itemId', '=', itemId)
			.where('attributeOfItem.attributeId', '=', attributeId)
			.set(parsed.data)
			.returning('attributeOfItem.attributeId')
			.executeTakeFirst();

		if (!updated) throw error(404, 'The item attribute does not exist');

		const row = await findOneAttributeOfItem(
			taxonomyId,
			itemId,
			parsed.data.attributeId ?? attributeId
		);
		return json(row, { status: 200 });
	} catch (e) {
		if (parsed.data.attributeId?.length && isUniqueViolation(e)) {
			return json(
				{ errors: { attributeId: ['This attribute is already associated with the item'] } },
				{ status: 422 }
			);
		}
		throw e;
	}
};

/**
 * @openapi
 * summary: Delete item attribute
 * tags:
 *  - Story assets
 *  - Assistant
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const taxonomyId = requireParam(params.taxonomyId, 'The taxonomy parameter is required');
	const itemId = requireParam(params.itemId, 'The item parameter is required');
	const attributeId = requireParam(params.attributeId, 'The attribute parameter is required');

	if (!(await canModify(locals)))
		throw error(403, 'You are not allowed to delete this item attribute');

	await assertTaxonomy(clientId, taxonomyId);
	await assertItem(taxonomyId, itemId);

	const deleted = await db
		.deleteFrom('attributeOfItem')
		.where('attributeOfItem.itemId', '=', itemId)
		.where('attributeOfItem.attributeId', '=', attributeId)
		.returning('attributeOfItem.attributeId')
		.executeTakeFirst();

	if (!deleted) throw error(404, 'The item attribute does not exist');

	return new Response(undefined, { status: 204 });
};
