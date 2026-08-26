import { db } from '$lib/db/database';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { hasPermission, parseBody, requireParam } from '$lib/server/utils.server';
import { error, json } from '@sveltejs/kit';
import { sql } from 'kysely';
import { z } from 'zod/v4';
import type { RequestHandler } from './$types';

const itemPatchSchema = z.object({
	categories: z.array(z.string()).optional()
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

const findOneItemById = async (taxonomyId: string, itemId: string) => {
	const row = await db
		.selectFrom('item')
		.where('item.id', '=', itemId)
		.where('item.taxonomyId', '=', taxonomyId)
		.select((eb) => [
			'item.id',
			'item.taxonomyId',
			sql<string[]>`coalesce((
				select jsonb_agg(item_of_category.category_id)
				from item_of_category
				where item_of_category.item_id = ${eb.ref('item.id')}
			), '[]'::jsonb)`.as('categories'),
			sql<number>`(
				select count(*)::int
				from attribute_of_item
				where attribute_of_item.item_id = ${eb.ref('item.id')}
			)`.as('attributes')
		])
		.executeTakeFirst();

	if (!row) throw error(404, 'The item does not exist');
	return row;
};

const canModify = (locals: App.Locals) =>
	hasPermission(locals, {
		elevatedRoles: [UserRole.editor, UserRole.admin]
	});

export const GET: RequestHandler = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const taxonomyId = requireParam(params.taxonomyId, 'The taxonomy parameter is required');
	const itemId = requireParam(params.itemId, 'The item parameter is required');

	await assertTaxonomy(clientId, taxonomyId);
	const row = await findOneItemById(taxonomyId, itemId);
	return json(row);
};

export const POST: RequestHandler = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const taxonomyId = requireParam(params.taxonomyId, 'The taxonomy parameter is required');

	if (!(await canModify(locals))) throw error(403, 'You are not allowed to create items');
	await assertTaxonomy(clientId, taxonomyId);

	const inserted = await db
		.insertInto('item')
		.values({ taxonomyId })
		.returning('item.id')
		.executeTakeFirstOrThrow();

	const row = await findOneItemById(taxonomyId, inserted.id);
	return json(row, { status: 201 });
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const clientId = locals.client.id;
	const taxonomyId = requireParam(params.taxonomyId, 'The taxonomy parameter is required');
	const itemId = requireParam(params.itemId, 'The item parameter is required');

	if (!(await canModify(locals))) throw error(403, 'You are not allowed to update this item');
	await assertTaxonomy(clientId, taxonomyId);

	const parsed = await parseBody(request, itemPatchSchema);
	if (!parsed.ok) return parsed.response;
	await findOneItemById(taxonomyId, itemId);

	if (parsed.data.categories) {
		const categories = [...new Set(parsed.data.categories)];
		const validCategories = categories.length
			? await db
					.selectFrom('category')
					.where('category.taxonomyId', '=', taxonomyId)
					.where('category.id', 'in', categories)
					.select('category.id')
					.execute()
			: [];

		if (validCategories.length !== categories.length) {
			return json(
				{ errors: { categories: ['One or more categories do not exist'] } },
				{ status: 422 }
			);
		}

		await db.transaction().execute(async (trx) => {
			await trx.deleteFrom('itemOfCategory').where('itemOfCategory.itemId', '=', itemId).execute();

			if (categories.length) {
				await trx
					.insertInto('itemOfCategory')
					.values(categories.map((categoryId) => ({ itemId, categoryId })))
					.execute();
			}
		});
	}

	const row = await findOneItemById(taxonomyId, itemId);
	return json(row, { status: 200 });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const taxonomyId = requireParam(params.taxonomyId, 'The taxonomy parameter is required');
	const itemId = requireParam(params.itemId, 'The item parameter is required');

	if (!(await canModify(locals))) throw error(403, 'You are not allowed to delete this item');
	await assertTaxonomy(clientId, taxonomyId);

	const deleted = await db
		.deleteFrom('item')
		.where('item.id', '=', itemId)
		.where('item.taxonomyId', '=', taxonomyId)
		.returning('item.id')
		.executeTakeFirst();

	if (!deleted) throw error(404, 'The item does not exist');

	return new Response(undefined, { status: 204 });
};
