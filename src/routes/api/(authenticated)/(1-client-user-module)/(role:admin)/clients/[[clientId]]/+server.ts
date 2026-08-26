import { db } from '$lib/db/database';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import {
	hasPermission,
	isUniqueViolation,
	parseBody,
	requireParam
} from '$lib/server/utils.server';
import { error, json } from '@sveltejs/kit';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import type { RequestHandler } from './$types';
import { clientCreateSchema as createSchema, clientPatchSchema as patchSchema } from './schemas';

const findOneClientById = async (clientId: string) => {
	const row = await db
		.selectFrom('client')
		.where('client.id', '=', clientId)
		.select((eb) => [
			'client.id',
			'client.slug',
			'client.name',
			'client.description',
			'client.domains',
			'client.administrationEmail',
			'client.logo',
			'client.favicon',
			'client.splash',
			'client.hero',
			'client.css',
			'client.manifest',
			'client.isFindableBySearchEngines',
			'client.plausibleDomain',
			'client.authenticationMethods',
			'client.accessTokenKey',
			'client.redirectAuthorized',
			'client.redirectUnauthorized',
			eb
				.selectFrom('clientApiKey')
				.whereRef('clientApiKey.clientId', '=', 'client.id')
				.select(eb.fn.countAll<number>().as('clientApiKeys'))
				.as('clientApiKeys'),
			'client.createdAt',
			'client.updatedAt',
			jsonObjectFrom(
				eb
					.selectFrom('user')
					.whereRef('user.id', '=', 'client.createdBy')
					.select((eb) => [
						'user.id',
						eb
							.fn<string | null>('nullif', [
								eb.fn<string>('btrim', [
									eb.fn<string>('concat', [
										'user.firstName',
										eb.cast<string>(eb.val(' '), 'text'),
										'user.lastName'
									])
								]),
								eb.val('')
							])
							.as('label'),
						'user.picture as image'
					])
			).as('createdBy'),
			jsonObjectFrom(
				eb
					.selectFrom('user')
					.whereRef('user.id', '=', 'client.updatedBy')
					.select((eb) => [
						'user.id',
						eb
							.fn<string | null>('nullif', [
								eb.fn<string>('btrim', [
									eb.fn<string>('concat', [
										'user.firstName',
										eb.cast<string>(eb.val(' '), 'text'),
										'user.lastName'
									])
								]),
								eb.val('')
							])
							.as('label'),
						'user.picture as image'
					])
			).as('updatedBy')
		])
		.executeTakeFirst();

	if (!row) throw error(404, 'The client does not exist');
	return row;
};

const canModify = (locals: App.Locals) =>
	hasPermission(locals, {
		elevatedRoles: [UserRole.admin]
	});

/**
 * @openapi
 * summary-one: Get client
 * summary-all: Get clients
 * tags:
 *  - Clients
 */
export const GET: RequestHandler = async ({ params }) => {
	const clientId = requireParam(params.clientId, 'The client parameter is required');

	const row = await findOneClientById(clientId);
	return json(row);
};

/**
 * @openapi
 * summary: Create a client
 * tags:
 *  - Clients
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	const userId = locals.authusr!.id;

	if (!(await canModify(locals))) throw error(403, 'You are not allowed to create clients');

	const parsed = await parseBody(request, createSchema, locals.language);
	if (!parsed.ok) return parsed.response;

	try {
		const inserted = await db
			.insertInto('client')
			.values({
				...parsed.data,
				createdBy: userId,
				updatedBy: userId
			})
			.returning('client.id')
			.executeTakeFirstOrThrow();

		const row = await findOneClientById(inserted.id);
		return json(row, { status: 201 });
	} catch (e) {
		if (parsed.data.slug?.length && isUniqueViolation(e)) {
			return json(
				{ errors: { slug: ['A client with this slug already exists'] } },
				{ status: 422 }
			);
		}
		throw e;
	}
};

/**
 * @openapi
 * summary: Update client
 * tags:
 *  - Clients
 */
export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const userId = locals.authusr!.id;
	const clientId = requireParam(params.clientId, 'The client parameter is required');

	if (!(await canModify(locals))) throw error(403, 'You are not allowed to update this client');

	const parsed = await parseBody(request, patchSchema, locals.language);
	if (!parsed.ok) return parsed.response;

	try {
		const updated = await db
			.updateTable('client')
			.where('client.id', '=', clientId)
			.set({
				...parsed.data,
				updatedAt: new Date(),
				updatedBy: userId
			})
			.returning('client.id')
			.executeTakeFirst();

		if (!updated) throw error(404, 'The client does not exist');

		const row = await findOneClientById(clientId);
		return json(row, { status: 200 });
	} catch (e) {
		if (parsed.data.slug?.length && isUniqueViolation(e)) {
			return json(
				{ errors: { slug: ['A client with this slug already exists'] } },
				{ status: 422 }
			);
		}
		throw e;
	}
};

/**
 * @openapi
 * summary: Delete client
 * tags:
 *  - Clients
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	const clientId = requireParam(params.clientId, 'The client parameter is required');

	if (!(await canModify(locals))) throw error(403, 'You are not allowed to delete this client');

	const deleted = await db
		.deleteFrom('client')
		.where('client.id', '=', clientId)
		.returning('client.id')
		.executeTakeFirst();

	if (!deleted) throw error(404, 'The client does not exist');

	return new Response(undefined, { status: 204 });
};
