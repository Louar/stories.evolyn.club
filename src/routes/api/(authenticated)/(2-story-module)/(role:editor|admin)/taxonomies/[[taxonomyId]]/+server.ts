import { db } from '$lib/db/database';
import type { Translatable } from '$lib/db/schemas/0-utils';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { hasPermission, parseBody, requireParam } from '$lib/server/utils.server';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	taxonomyCreateSchema as createSchema,
	taxonomyPatchSchema as patchSchema
} from './schemas';

const defaultSlug = 'new-taxonomy';
const defaultName = { en: 'New taxonomy' } as Translatable;

const serializeTaxonomyBody = (data: Partial<typeof createSchema._output>) => {
	const serialized: { slug?: string; name?: string | null; description?: string | null } = {};
	if (data.slug !== undefined) serialized.slug = data.slug;
	if (data.name !== undefined) serialized.name = data.name ? JSON.stringify(data.name) : null;
	if (data.description !== undefined)
		serialized.description = data.description ? JSON.stringify(data.description) : null;
	return serialized;
};

const findOneTaxonomyById = async (clientId: string, taxonomyId: string) => {
	const row = await db
		.selectFrom('taxonomy')
		.where('taxonomy.id', '=', taxonomyId)
		.where('taxonomy.clientId', '=', clientId)
		.select((eb) => [
			'taxonomy.id',
			'taxonomy.clientId',
			'taxonomy.slug',
			'taxonomy.name',
			'taxonomy.description',
			eb
				.selectFrom('category')
				.whereRef('category.taxonomyId', '=', 'taxonomy.id')
				.select(eb.fn.countAll<number>().as('categories'))
				.as('categories'),
			eb
				.selectFrom('attribute')
				.whereRef('attribute.taxonomyId', '=', 'taxonomy.id')
				.select(eb.fn.countAll<number>().as('attributes'))
				.as('attributes'),
			eb
				.selectFrom('item')
				.whereRef('item.taxonomyId', '=', 'taxonomy.id')
				.select(eb.fn.countAll<number>().as('items'))
				.as('items'),
			eb
				.selectFrom('taxonomyDraftForPart')
				.whereRef('taxonomyDraftForPart.taxonomyId', '=', 'taxonomy.id')
				.select(eb.fn.countAll<number>().as('drafts'))
				.as('drafts')
		])
		.executeTakeFirst();

	if (!row) throw error(404, 'The taxonomy does not exist');
	return row;
};

const canModify = (locals: App.Locals) =>
	hasPermission(locals, {
		elevatedRoles: [UserRole.editor, UserRole.admin]
	});

/**
 * @openapi
 * summary: Get taxonomy
 * tags:
 *  - Story assets
 *  - Assistant
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const taxonomyId = requireParam(params.taxonomyId, 'The taxonomy parameter is required');

	const row = await findOneTaxonomyById(clientId, taxonomyId);
	return json(row);
};

/**
 * @openapi
 * summary: Create taxonomy
 * tags:
 *  - Story assets
 *  - Assistant
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	const clientId = locals.client.id;

	if (!(await canModify(locals))) throw error(403, 'You are not allowed to create taxonomies');

	const parsed = await parseBody(request, createSchema);
	if (!parsed.ok) return parsed.response;

	const inserted = await db
		.insertInto('taxonomy')
		.values({
			clientId,
			slug: defaultSlug,
			name: JSON.stringify(defaultName),
			...serializeTaxonomyBody(parsed.data)
		})
		.returning('taxonomy.id')
		.executeTakeFirstOrThrow();

	const row = await findOneTaxonomyById(clientId, inserted.id);
	return json(row, { status: 201 });
};

/**
 * @openapi
 * summary: Update taxonomy
 * tags:
 *  - Story assets
 *  - Assistant
 */
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
		.set(serializeTaxonomyBody(parsed.data))
		.returning('taxonomy.id')
		.executeTakeFirst();

	if (!updated) throw error(404, 'The taxonomy does not exist');

	const row = await findOneTaxonomyById(clientId, taxonomyId);
	return json(row, { status: 200 });
};

/**
 * @openapi
 * summary: Delete taxonomy
 * tags:
 *  - Story assets
 *  - Assistant
 */
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
