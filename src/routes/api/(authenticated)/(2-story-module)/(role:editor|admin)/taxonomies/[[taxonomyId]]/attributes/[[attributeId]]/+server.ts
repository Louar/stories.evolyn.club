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
	attributeCreateSchema as createSchema,
	attributePatchSchema as patchSchema
} from './schemas';

const defaultName = JSON.stringify({ default: 'New attribute' });

const assertTaxonomy = async (clientId: string, taxonomyId: string) => {
	const taxonomy = await db
		.selectFrom('taxonomy')
		.where('taxonomy.id', '=', taxonomyId)
		.where('taxonomy.clientId', '=', clientId)
		.select('taxonomy.id')
		.executeTakeFirst();

	if (!taxonomy) throw error(404, 'The taxonomy does not exist');
};

const findOneAttributeById = async (taxonomyId: string, attributeId: string) => {
	const row = await db
		.selectFrom('attribute')
		.where('attribute.id', '=', attributeId)
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
		.executeTakeFirst();

	if (!row) throw error(404, 'The attribute does not exist');
	return row;
};

const assertReferencedCategory = async (taxonomyId: string, categoryId: string) => {
	const category = await db
		.selectFrom('category')
		.where('category.id', '=', categoryId)
		.where('category.taxonomyId', '=', taxonomyId)
		.select('category.id')
		.executeTakeFirst();

	if (!category) {
		throw error(422, { message: 'The referenced category does not exist' });
	}
};

const canModify = (locals: App.Locals) =>
	hasPermission(locals, {
		elevatedRoles: [UserRole.editor, UserRole.admin]
	});

/**
 * @openapi
 * summary: Get taxonomy attribute
 * tags:
 *  - Story assets
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const taxonomyId = requireParam(params.taxonomyId, 'The taxonomy parameter is required');
	const attributeId = requireParam(params.attributeId, 'The attribute parameter is required');

	await assertTaxonomy(clientId, taxonomyId);
	const row = await findOneAttributeById(taxonomyId, attributeId);
	return json(row);
};

/**
 * @openapi
 * summary: Create taxonomy attribute
 * tags:
 *  - Story assets
 */
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const clientId = locals.client.id;
	const taxonomyId = requireParam(params.taxonomyId, 'The taxonomy parameter is required');

	if (!(await canModify(locals))) throw error(403, 'You are not allowed to create attributes');
	await assertTaxonomy(clientId, taxonomyId);

	const parsed = await parseBody(request, createSchema);
	if (!parsed.ok) return parsed.response;
	if (parsed.data.referencedCategoryId)
		await assertReferencedCategory(taxonomyId, parsed.data.referencedCategoryId);

	const slug = parsed.data.slug ?? `attribute-${crypto.randomUUID().slice(0, 8)}`;

	try {
		const inserted = await db
			.insertInto('attribute')
			.values({
				taxonomyId,
				slug,
				name: defaultName,
				type: AttributeType.translatable,
				...parsed.data
			})
			.returning('attribute.id')
			.executeTakeFirstOrThrow();

		const row = await findOneAttributeById(taxonomyId, inserted.id);
		return json(row, { status: 201 });
	} catch (e) {
		if (isUniqueViolation(e)) {
			return json(
				{ errors: { slug: ['An attribute with this slug already exists'] } },
				{ status: 422 }
			);
		}
		throw e;
	}
};

/**
 * @openapi
 * summary: Update taxonomy attribute
 * tags:
 *  - Story assets
 */
export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const clientId = locals.client.id;
	const taxonomyId = requireParam(params.taxonomyId, 'The taxonomy parameter is required');
	const attributeId = requireParam(params.attributeId, 'The attribute parameter is required');

	if (!(await canModify(locals))) throw error(403, 'You are not allowed to update this attribute');
	await assertTaxonomy(clientId, taxonomyId);

	const parsed = await parseBody(request, patchSchema);
	if (!parsed.ok) return parsed.response;
	if (parsed.data.referencedCategoryId)
		await assertReferencedCategory(taxonomyId, parsed.data.referencedCategoryId);
	if (!Object.keys(parsed.data).length)
		return json(await findOneAttributeById(taxonomyId, attributeId));

	try {
		const updated = await db
			.updateTable('attribute')
			.where('attribute.id', '=', attributeId)
			.where('attribute.taxonomyId', '=', taxonomyId)
			.set(parsed.data)
			.returning('attribute.id')
			.executeTakeFirst();

		if (!updated) throw error(404, 'The attribute does not exist');

		const row = await findOneAttributeById(taxonomyId, attributeId);
		return json(row, { status: 200 });
	} catch (e) {
		if (parsed.data.slug?.length && isUniqueViolation(e)) {
			return json(
				{ errors: { slug: ['An attribute with this slug already exists'] } },
				{ status: 422 }
			);
		}
		throw e;
	}
};

/**
 * @openapi
 * summary: Delete taxonomy attribute
 * tags:
 *  - Story assets
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const taxonomyId = requireParam(params.taxonomyId, 'The taxonomy parameter is required');
	const attributeId = requireParam(params.attributeId, 'The attribute parameter is required');

	if (!(await canModify(locals))) throw error(403, 'You are not allowed to delete this attribute');
	await assertTaxonomy(clientId, taxonomyId);

	const deleted = await db
		.deleteFrom('attribute')
		.where('attribute.id', '=', attributeId)
		.where('attribute.taxonomyId', '=', taxonomyId)
		.returning('attribute.id')
		.executeTakeFirst();

	if (!deleted) throw error(404, 'The attribute does not exist');

	return new Response(undefined, { status: 204 });
};
