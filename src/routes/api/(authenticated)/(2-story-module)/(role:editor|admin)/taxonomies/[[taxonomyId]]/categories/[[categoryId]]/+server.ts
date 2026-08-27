import { db } from '$lib/db/database';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { hasPermission, parseBody, requireParam } from '$lib/server/utils.server';
import { error, json } from '@sveltejs/kit';
import { sql } from 'kysely';
import type { RequestHandler } from './$types';
import {
	categoryCreateSchema as createSchema,
	categoryPatchSchema as patchSchema
} from './schemas';

const defaultName = JSON.stringify({ default: 'New category' });

const assertTaxonomy = async (clientId: string, taxonomyId: string) => {
	const taxonomy = await db
		.selectFrom('taxonomy')
		.where('taxonomy.id', '=', taxonomyId)
		.where('taxonomy.clientId', '=', clientId)
		.select('taxonomy.id')
		.executeTakeFirst();

	if (!taxonomy) throw error(404, 'The taxonomy does not exist');
};

const findOneCategoryById = async (taxonomyId: string, categoryId: string) => {
	const row = await db
		.selectFrom('category')
		.where('category.id', '=', categoryId)
		.where('category.taxonomyId', '=', taxonomyId)
		.select((eb) => [
			'category.id',
			'category.taxonomyId',
			'category.name',
			'category.image',
			'category.description',
			'category.map',
			sql<number>`(
				select count(*)::int
				from attribute_of_category
				where attribute_of_category.category_id = ${eb.ref('category.id')}
			)`.as('attributes')
		])
		.executeTakeFirst();

	if (!row) throw error(404, 'The category does not exist');
	return row;
};

const canModify = (locals: App.Locals) =>
	hasPermission(locals, {
		elevatedRoles: [UserRole.editor, UserRole.admin]
	});

/**
 * @openapi
 * summary: Get taxonomy category
 * tags:
 *  - Story assets
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const taxonomyId = requireParam(params.taxonomyId, 'The taxonomy parameter is required');
	const categoryId = requireParam(params.categoryId, 'The category parameter is required');

	await assertTaxonomy(clientId, taxonomyId);
	const row = await findOneCategoryById(taxonomyId, categoryId);
	return json(row);
};

/**
 * @openapi
 * summary: Create taxonomy category
 * tags:
 *  - Story assets
 */
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const clientId = locals.client.id;
	const taxonomyId = requireParam(params.taxonomyId, 'The taxonomy parameter is required');

	if (!(await canModify(locals))) throw error(403, 'You are not allowed to create categories');
	await assertTaxonomy(clientId, taxonomyId);

	const parsed = await parseBody(request, createSchema);
	if (!parsed.ok) return parsed.response;

	const inserted = await db
		.insertInto('category')
		.values({
			taxonomyId,
			name: defaultName,
			...parsed.data
		})
		.returning('category.id')
		.executeTakeFirstOrThrow();

	const row = await findOneCategoryById(taxonomyId, inserted.id);
	return json(row, { status: 201 });
};

/**
 * @openapi
 * summary: Update taxonomy category
 * tags:
 *  - Story assets
 */
export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const clientId = locals.client.id;
	const taxonomyId = requireParam(params.taxonomyId, 'The taxonomy parameter is required');
	const categoryId = requireParam(params.categoryId, 'The category parameter is required');

	if (!(await canModify(locals))) throw error(403, 'You are not allowed to update this category');
	await assertTaxonomy(clientId, taxonomyId);

	const parsed = await parseBody(request, patchSchema);
	if (!parsed.ok) return parsed.response;
	if (!Object.keys(parsed.data).length)
		return json(await findOneCategoryById(taxonomyId, categoryId));

	const updated = await db
		.updateTable('category')
		.where('category.id', '=', categoryId)
		.where('category.taxonomyId', '=', taxonomyId)
		.set(parsed.data)
		.returning('category.id')
		.executeTakeFirst();

	if (!updated) throw error(404, 'The category does not exist');

	const row = await findOneCategoryById(taxonomyId, categoryId);
	return json(row, { status: 200 });
};

/**
 * @openapi
 * summary: Delete taxonomy category
 * tags:
 *  - Story assets
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const taxonomyId = requireParam(params.taxonomyId, 'The taxonomy parameter is required');
	const categoryId = requireParam(params.categoryId, 'The category parameter is required');

	if (!(await canModify(locals))) throw error(403, 'You are not allowed to delete this category');
	await assertTaxonomy(clientId, taxonomyId);

	const deleted = await db
		.deleteFrom('category')
		.where('category.id', '=', categoryId)
		.where('category.taxonomyId', '=', taxonomyId)
		.returning('category.id')
		.executeTakeFirst();

	if (!deleted) throw error(404, 'The category does not exist');

	return new Response(undefined, { status: 204 });
};
