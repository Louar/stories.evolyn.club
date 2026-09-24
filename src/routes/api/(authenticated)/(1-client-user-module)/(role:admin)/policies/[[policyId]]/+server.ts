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
import { policyCreateSchema as createSchema, policyPatchSchema as patchSchema } from './schemas';

const selectPolicy = (clientId: string, policyId: string | null) =>
	db
		.selectFrom('license')
		.where('license.clientId', '=', clientId)
		.$if(policyId != null, (qb) => qb.where('license.id', '=', policyId!))
		.select((eb) => [
			'license.id',
			'license.name',
			'license.version',
			'license.termsOfUse',
			'license.privacyPolicy',
			'license.createdAt',
			'license.updatedAt',
			eb
				.selectFrom('licenseAgreement')
				.whereRef('licenseAgreement.licenseId', '=', 'license.id')
				.select(eb.fn.countAll<number>().as('agreements'))
				.as('agreements'),
			jsonObjectFrom(
				eb
					.selectFrom('user')
					.whereRef('user.id', '=', 'license.createdBy')
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
					.whereRef('user.id', '=', 'license.updatedBy')
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
		]);

const findPolicies = async (clientId: string, policyId: string | null) => {
	const rows = await selectPolicy(clientId, policyId)
		.orderBy('license.updatedAt', 'desc')
		.orderBy('license.id', 'desc')
		.execute();
	if (policyId?.length && !rows.length) throw error(404, 'The policy does not exist');
	return rows;
};

const findOnePolicyById = async (clientId: string, policyId: string) =>
	(await findPolicies(clientId, policyId))[0];

const canModify = (locals: App.Locals) =>
	hasPermission(locals, {
		elevatedRoles: [UserRole.admin]
	});

/**
 * @openapi
 * summary-one: Get policy
 * summary-all: Get policies
 * tags:
 *  - Policies
 *  - Assistant
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	const policyId = params.policyId ?? null;
	const rows = await findPolicies(locals.client.id, policyId);
	return json(policyId?.length ? rows[0] : rows);
};

/**
 * @openapi
 * summary: Create a policy
 * tags:
 *  - Policies
 *  - Assistant
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	const clientId = locals.client.id;
	const userId = locals.authusr!.id;

	if (!(await canModify(locals))) throw error(403, 'You are not allowed to create policies');

	const parsed = await parseBody(request, createSchema, locals.language);
	if (!parsed.ok) return parsed.response;

	try {
		const inserted = await db
			.insertInto('license')
			.values({
				clientId,
				...parsed.data,
				createdBy: userId,
				updatedBy: userId
			})
			.returning('license.id')
			.executeTakeFirstOrThrow();

		return json(await findOnePolicyById(clientId, inserted.id), { status: 201 });
	} catch (e) {
		if (isUniqueViolation(e)) {
			return json(
				{ errors: { name: ['A policy with this name already exists'] } },
				{ status: 422 }
			);
		}
		throw e;
	}
};

/**
 * @openapi
 * summary: Update policy
 * tags:
 *  - Policies
 *  - Assistant
 */
export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const clientId = locals.client.id;
	const userId = locals.authusr!.id;
	const policyId = requireParam(params.policyId, 'The policy parameter is required');

	if (!(await canModify(locals))) throw error(403, 'You are not allowed to update this policy');

	const parsed = await parseBody(request, patchSchema, locals.language);
	if (!parsed.ok) return parsed.response;

	try {
		const updated = await db
			.updateTable('license')
			.where('license.id', '=', policyId)
			.where('license.clientId', '=', clientId)
			.set({
				...parsed.data,
				updatedAt: new Date(),
				updatedBy: userId
			})
			.returning('license.id')
			.executeTakeFirst();

		if (!updated) throw error(404, 'The policy does not exist');

		return json(await findOnePolicyById(clientId, policyId), { status: 200 });
	} catch (e) {
		if (isUniqueViolation(e)) {
			return json(
				{ errors: { name: ['A policy with this name already exists'] } },
				{ status: 422 }
			);
		}
		throw e;
	}
};

/**
 * @openapi
 * summary: Delete policy
 * tags:
 *  - Policies
 *  - Assistant
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const policyId = requireParam(params.policyId, 'The policy parameter is required');

	if (!(await canModify(locals))) throw error(403, 'You are not allowed to delete this policy');

	const deleted = await db
		.deleteFrom('license')
		.where('license.id', '=', policyId)
		.where('license.clientId', '=', clientId)
		.returning('license.id')
		.executeTakeFirst();

	if (!deleted) throw error(404, 'The policy does not exist');

	return new Response(undefined, { status: 204 });
};
