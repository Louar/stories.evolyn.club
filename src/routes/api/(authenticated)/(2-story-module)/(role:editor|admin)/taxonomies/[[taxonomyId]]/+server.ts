import { db } from '$lib/db/database';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { hasPermission, parseBody, requireParam } from '$lib/server/utils.server';
import { error, json } from '@sveltejs/kit';
import { sql } from 'kysely';
import type { RequestHandler } from './$types';
import {
	taxonomyCreateSchema as createSchema,
	taxonomyPatchSchema as patchSchema
} from './schemas';

const defaultName = 'New taxonomy';

const findOneTaxonomyById = async (clientId: string, taxonomyId: string) => {
	const row = await db
		.selectFrom('taxonomy')
		.where('taxonomy.id', '=', taxonomyId)
		.where('taxonomy.clientId', '=', clientId)
		.select((eb) => [
			'taxonomy.id',
			'taxonomy.clientId',
			'taxonomy.name',
			'taxonomy.description',
			sql<number>`(
				select count(*)::int
				from category
				where category.taxonomy_id = ${eb.ref('taxonomy.id')}
			)`.as('categories'),
			sql<number>`(
				select count(*)::int
				from attribute
				where attribute.taxonomy_id = ${eb.ref('taxonomy.id')}
			)`.as('attributes'),
			sql<number>`(
				select count(*)::int
				from item
				where item.taxonomy_id = ${eb.ref('taxonomy.id')}
			)`.as('items'),
			sql<number>`(
				select count(*)::int
				from taxonomy_draft_for_part
				where taxonomy_draft_for_part.taxonomy_id = ${eb.ref('taxonomy.id')}
			)`.as('drafts')
		])
		.executeTakeFirst();

	if (!row) throw error(404, 'The taxonomy does not exist');
	return row;
};

const canModify = (locals: App.Locals) =>
	hasPermission(locals, {
		elevatedRoles: [UserRole.editor, UserRole.admin]
	});

export const GET: RequestHandler = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const taxonomyId = requireParam(params.taxonomyId, 'The taxonomy parameter is required');

	const row = await findOneTaxonomyById(clientId, taxonomyId);
	return json(row);
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const clientId = locals.client.id;

	if (!(await canModify(locals))) throw error(403, 'You are not allowed to create taxonomies');

	const parsed = await parseBody(request, createSchema);
	if (!parsed.ok) return parsed.response;

	const inserted = await db
		.insertInto('taxonomy')
		.values({
			clientId,
			name: defaultName,
			...parsed.data
		})
		.returning('taxonomy.id')
		.executeTakeFirstOrThrow();

	const row = await findOneTaxonomyById(clientId, inserted.id);
	return json(row, { status: 201 });
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const clientId = locals.client.id;
	const taxonomyId = requireParam(params.taxonomyId, 'The taxonomy parameter is required');

	if (!(await canModify(locals))) throw error(403, 'You are not allowed to update this taxonomy');

	const parsed = await parseBody(request, patchSchema);
	if (!parsed.ok) return parsed.response;
	if (!Object.keys(parsed.data).length)
		return json(await findOneTaxonomyById(clientId, taxonomyId));

	const updated = await db
		.updateTable('taxonomy')
		.where('taxonomy.id', '=', taxonomyId)
		.where('taxonomy.clientId', '=', clientId)
		.set(parsed.data)
		.returning('taxonomy.id')
		.executeTakeFirst();

	if (!updated) throw error(404, 'The taxonomy does not exist');

	const row = await findOneTaxonomyById(clientId, taxonomyId);
	return json(row, { status: 200 });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const taxonomyId = requireParam(params.taxonomyId, 'The taxonomy parameter is required');

	if (!(await canModify(locals))) throw error(403, 'You are not allowed to delete this taxonomy');

	const deleted = await db
		.deleteFrom('taxonomy')
		.where('taxonomy.id', '=', taxonomyId)
		.where('taxonomy.clientId', '=', clientId)
		.returning('taxonomy.id')
		.executeTakeFirst();

	if (!deleted) throw error(404, 'The taxonomy does not exist');

	return new Response(undefined, { status: 204 });
};
