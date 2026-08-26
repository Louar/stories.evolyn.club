import { db } from '$lib/db/database';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import {
	hasPermission,
	isUniqueViolation,
	parseBody,
	requireParam
} from '$lib/server/utils.server';
import { error, json } from '@sveltejs/kit';
import { Uuid25 } from 'uuid25';
import { uuidv7obj } from 'uuidv7';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import type { RequestHandler } from './$types';
import {
	clientApiKeyCreateSchema as createSchema,
	clientApiKeyPatchSchema as patchSchema
} from './schemas';

const maskSecret = (secret: string) => {
	if (secret.length <= 4) return '•'.repeat(secret.length);
	return `${secret.slice(0, 2)}${'•'.repeat(Math.max(1, secret.length - 4))}${secret.slice(-2)}`;
};

const generateSecret = () => Uuid25.fromBytes(uuidv7obj().bytes).toHex();

const canModify = (locals: App.Locals) =>
	hasPermission(locals, {
		elevatedRoles: [UserRole.admin]
	});

const selectClientApiKey = async (clientId: string, clientApiKeyId: string) => {
	const row = await db
		.selectFrom('clientApiKey')
		.where('clientApiKey.clientId', '=', clientId)
		.where('clientApiKey.id', '=', clientApiKeyId)
		.select((eb) => [
			'clientApiKey.id',
			'clientApiKey.clientId',
			'clientApiKey.name',
			'clientApiKey.scopes',
			'clientApiKey.lastUsedAt',
			'clientApiKey.createdAt',
			'clientApiKey.updatedAt',
			jsonObjectFrom(
				eb
					.selectFrom('user')
					.whereRef('user.id', '=', 'clientApiKey.createdBy')
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
					.whereRef('user.id', '=', 'clientApiKey.updatedBy')
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

	if (!row) throw error(404, 'The client API key does not exist');
	return row;
};

const findClientApiKey = async (clientId: string, clientApiKeyId: string) => {
	const row = await db
		.selectFrom('clientApiKey')
		.where('clientApiKey.clientId', '=', clientId)
		.where('clientApiKey.id', '=', clientApiKeyId)
		.select('clientApiKey.secret')
		.executeTakeFirst();

	if (!row) throw error(404, 'The client API key does not exist');
	return {
		...(await selectClientApiKey(clientId, clientApiKeyId)),
		secret: maskSecret(row.secret)
	};
};

/**
 * @openapi
 * summary-one: Get client API key
 * summary-all: Get client API keys
 * tags:
 *  - Clients
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	const clientId = requireParam(params.clientId, 'The client parameter is required');
	const clientApiKeyId = requireParam(
		params.clientApiKeyId,
		'The client API key parameter is required'
	);

	if (!(await canModify(locals))) throw error(403, 'You are not allowed to view client API keys');

	return json(await findClientApiKey(clientId, clientApiKeyId));
};

/**
 * @openapi
 * summary: Create a client API key
 * tags:
 *  - Clients
 */
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const clientId = requireParam(params.clientId, 'The client parameter is required');
	const userId = locals.authusr!.id;

	if (!(await canModify(locals))) throw error(403, 'You are not allowed to create client API keys');

	const parsed = await parseBody(request, createSchema, locals.language);
	if (!parsed.ok) return parsed.response;

	const secret = generateSecret();

	try {
		const inserted = await db
			.insertInto('clientApiKey')
			.values({
				clientId,
				...parsed.data,
				secret,
				createdBy: userId,
				updatedBy: userId
			})
			.returning('clientApiKey.id')
			.executeTakeFirstOrThrow();

		return json({ ...(await findClientApiKey(clientId, inserted.id)), secret }, { status: 201 });
	} catch (e) {
		if (isUniqueViolation(e)) {
			return json(
				{ errors: { name: ['A client API key with this name already exists for this client'] } },
				{ status: 422 }
			);
		}
		throw e;
	}
};

/**
 * @openapi
 * summary: Update client API key
 * tags:
 *  - Clients
 */
export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const clientId = requireParam(params.clientId, 'The client parameter is required');
	const clientApiKeyId = requireParam(
		params.clientApiKeyId,
		'The client API key parameter is required'
	);
	const userId = locals.authusr!.id;

	if (!(await canModify(locals)))
		throw error(403, 'You are not allowed to update this client API key');

	const parsed = await parseBody(request, patchSchema, locals.language);
	if (!parsed.ok) return parsed.response;

	try {
		const updated = await db
			.updateTable('clientApiKey')
			.where('clientApiKey.clientId', '=', clientId)
			.where('clientApiKey.id', '=', clientApiKeyId)
			.set({
				...parsed.data,
				updatedAt: new Date(),
				updatedBy: userId
			})
			.returning('clientApiKey.id')
			.executeTakeFirst();

		if (!updated) throw error(404, 'The client API key does not exist');

		return json(await findClientApiKey(clientId, clientApiKeyId), { status: 200 });
	} catch (e) {
		if (isUniqueViolation(e)) {
			return json(
				{ errors: { name: ['A client API key with this name already exists for this client'] } },
				{ status: 422 }
			);
		}
		throw e;
	}
};

/**
 * @openapi
 * summary: Delete client API key
 * tags:
 *  - Clients
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	const clientId = requireParam(params.clientId, 'The client parameter is required');
	const clientApiKeyId = requireParam(
		params.clientApiKeyId,
		'The client API key parameter is required'
	);

	if (!(await canModify(locals)))
		throw error(403, 'You are not allowed to delete this client API key');

	const deleted = await db
		.deleteFrom('clientApiKey')
		.where('clientApiKey.clientId', '=', clientId)
		.where('clientApiKey.id', '=', clientApiKeyId)
		.returning('clientApiKey.id')
		.executeTakeFirst();

	if (!deleted) throw error(404, 'The client API key does not exist');

	return new Response(undefined, { status: 204 });
};
