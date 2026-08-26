import { db } from '$lib/db/database';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import {
	hasPermission,
	isUniqueViolation,
	parseBody,
	requireParam
} from '$lib/server/utils.server';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	attributeOfCategoryCreateSchema as createSchema,
	attributeOfCategoryPatchSchema as patchSchema
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

const assertCategory = async (taxonomyId: string, categoryId: string) => {
	const category = await db
		.selectFrom('category')
		.where('category.id', '=', categoryId)
		.where('category.taxonomyId', '=', taxonomyId)
		.select('category.id')
		.executeTakeFirst();
	if (!category) throw error(404, 'The category does not exist');
};

const assertAttribute = async (taxonomyId: string, attributeId: string) => {
	const attribute = await db
		.selectFrom('attribute')
		.where('attribute.id', '=', attributeId)
		.where('attribute.taxonomyId', '=', taxonomyId)
		.select('attribute.id')
		.executeTakeFirst();
	if (!attribute) throw error(404, 'The attribute does not exist');
};

const findAvailableAttributeId = async (taxonomyId: string, categoryId: string) => {
	const attribute = await db
		.selectFrom('attribute')
		.leftJoin('attributeOfCategory', (join) =>
			join
				.onRef('attributeOfCategory.attributeId', '=', 'attribute.id')
				.on('attributeOfCategory.categoryId', '=', categoryId)
		)
		.where('attribute.taxonomyId', '=', taxonomyId)
		.where('attributeOfCategory.attributeId', 'is', null)
		.select('attribute.id')
		.orderBy('attribute.slug')
		.executeTakeFirst();

	return attribute?.id;
};

const findOneAttributeOfCategory = async (
	taxonomyId: string,
	categoryId: string,
	attributeId: string
) => {
	const row = await db
		.selectFrom('attributeOfCategory')
		.innerJoin('attribute', 'attribute.id', 'attributeOfCategory.attributeId')
		.where('attributeOfCategory.categoryId', '=', categoryId)
		.where('attributeOfCategory.attributeId', '=', attributeId)
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
		.executeTakeFirst();

	if (!row) throw error(404, 'The category attribute does not exist');
	return row;
};

export const GET: RequestHandler = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const taxonomyId = requireParam(params.taxonomyId, 'The taxonomy parameter is required');
	const categoryId = requireParam(params.categoryId, 'The category parameter is required');
	const attributeId = requireParam(params.attributeId, 'The attribute parameter is required');

	await assertTaxonomy(clientId, taxonomyId);
	const row = await findOneAttributeOfCategory(taxonomyId, categoryId, attributeId);
	return json(row);
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const clientId = locals.client.id;
	const taxonomyId = requireParam(params.taxonomyId, 'The taxonomy parameter is required');
	const categoryId = requireParam(params.categoryId, 'The category parameter is required');

	if (!(await canModify(locals)))
		throw error(403, 'You are not allowed to create category attributes');

	const parsed = await parseBody(request, createSchema);
	if (!parsed.ok) return parsed.response;

	await assertTaxonomy(clientId, taxonomyId);
	await assertCategory(taxonomyId, categoryId);
	const attributeId =
		parsed.data.attributeId ?? (await findAvailableAttributeId(taxonomyId, categoryId));
	if (!attributeId) {
		return json(
			{ errors: { attributeId: ['There are no available attributes for this category'] } },
			{ status: 422 }
		);
	}
	await assertAttribute(taxonomyId, attributeId);

	try {
		await db
			.insertInto('attributeOfCategory')
			.values({
				categoryId,
				attributeId,
				order: parsed.data.order,
				isRequired: parsed.data.isRequired,
				isDefault: parsed.data.isDefault
			})
			.executeTakeFirstOrThrow();

		const row = await findOneAttributeOfCategory(taxonomyId, categoryId, attributeId);
		return json(row, { status: 201 });
	} catch (e) {
		if (isUniqueViolation(e)) {
			return json(
				{ errors: { attributeId: ['This attribute is already associated with the category'] } },
				{ status: 422 }
			);
		}
		throw e;
	}
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const clientId = locals.client.id;
	const taxonomyId = requireParam(params.taxonomyId, 'The taxonomy parameter is required');
	const categoryId = requireParam(params.categoryId, 'The category parameter is required');
	const attributeId = requireParam(params.attributeId, 'The attribute parameter is required');

	if (!(await canModify(locals)))
		throw error(403, 'You are not allowed to update this category attribute');

	const parsed = await parseBody(request, patchSchema);
	if (!parsed.ok) return parsed.response;
	await assertTaxonomy(clientId, taxonomyId);
	await assertCategory(taxonomyId, categoryId);
	if (parsed.data.attributeId) await assertAttribute(taxonomyId, parsed.data.attributeId);

	try {
		const updated = await db
			.updateTable('attributeOfCategory')
			.where('attributeOfCategory.categoryId', '=', categoryId)
			.where('attributeOfCategory.attributeId', '=', attributeId)
			.set(parsed.data)
			.returning('attributeOfCategory.attributeId')
			.executeTakeFirst();

		if (!updated) throw error(404, 'The category attribute does not exist');

		const row = await findOneAttributeOfCategory(
			taxonomyId,
			categoryId,
			parsed.data.attributeId ?? attributeId
		);
		return json(row, { status: 200 });
	} catch (e) {
		if (parsed.data.attributeId?.length && isUniqueViolation(e)) {
			return json(
				{ errors: { attributeId: ['This attribute is already associated with the category'] } },
				{ status: 422 }
			);
		}
		throw e;
	}
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const taxonomyId = requireParam(params.taxonomyId, 'The taxonomy parameter is required');
	const categoryId = requireParam(params.categoryId, 'The category parameter is required');
	const attributeId = requireParam(params.attributeId, 'The attribute parameter is required');

	if (!(await canModify(locals)))
		throw error(403, 'You are not allowed to delete this category attribute');

	await assertTaxonomy(clientId, taxonomyId);
	await assertCategory(taxonomyId, categoryId);

	const deleted = await db
		.deleteFrom('attributeOfCategory')
		.where('attributeOfCategory.categoryId', '=', categoryId)
		.where('attributeOfCategory.attributeId', '=', attributeId)
		.returning('attributeOfCategory.attributeId')
		.executeTakeFirst();

	if (!deleted) throw error(404, 'The category attribute does not exist');

	return new Response(undefined, { status: 204 });
};
