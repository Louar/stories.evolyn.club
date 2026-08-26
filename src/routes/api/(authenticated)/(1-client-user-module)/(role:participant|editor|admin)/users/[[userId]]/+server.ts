import { db } from '$lib/db/database';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import {
	hasPermission,
	isUniqueViolation,
	parseBody,
	requireParam
} from '$lib/server/utils.server';
import { error, json } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import type { RequestHandler } from './$types';
import { userCreateSchema as createSchema, userPatchSchema as patchSchema } from './schemas';

const findOneUserById = async (clientId: string, userId: string) => {
	const row = await db
		.selectFrom('user')
		.where('user.id', '=', userId)
		.where('user.clientId', '=', clientId)
		.select((eb) => [
			'user.id',
			'user.clientId',
			'user.email',
			'user.phone',
			'user.firstName',
			'user.lastName',
			'user.picture',
			eb
				.case()
				.when('user.password', 'is not', null)
				.then(eb.val('••••••••'))
				.else(null)
				.end()
				.as('password'),
			'user.roles',
			'user.language',
			'user.pronouns',
			'user.address',
			'user.dateOfBirth',
			'user.emailConfirmed',
			'user.emailConfirmCode',
			'user.phoneConfirmed',
			'user.passwordResetCode',
			'user.passwordResetExpiresAt',
			'user.isActive',
			'user.reasonForDeactivation',
			'user.createdAt',
			'user.updatedAt',
			eb
				.selectFrom('membership')
				.whereRef('membership.userId', '=', 'user.id')
				.select(eb.fn.countAll<number>().as('memberships'))
				.as('memberships'),
			jsonObjectFrom(
				eb
					.selectFrom('user as usr')
					.whereRef('usr.id', '=', 'user.createdBy')
					.select((eb) => [
						'usr.id',
						eb
							.fn<string | null>('nullif', [
								eb.fn<string>('btrim', [
									eb.fn<string>('concat', [
										'usr.firstName',
										eb.cast<string>(eb.val(' '), 'text'),
										'usr.lastName'
									])
								]),
								eb.val('')
							])
							.as('label'),
						'usr.picture as image'
					])
			).as('createdBy'),
			jsonObjectFrom(
				eb
					.selectFrom('user as usr')
					.whereRef('usr.id', '=', 'user.updatedBy')
					.select((eb) => [
						'usr.id',
						eb
							.fn<string | null>('nullif', [
								eb.fn<string>('btrim', [
									eb.fn<string>('concat', [
										'usr.firstName',
										eb.cast<string>(eb.val(' '), 'text'),
										'usr.lastName'
									])
								]),
								eb.val('')
							])
							.as('label'),
						'usr.picture as image'
					])
			).as('updatedBy')
		])
		.executeTakeFirst();

	if (!row) throw error(404, 'The user does not exist');
	return row;
};

const canCreate = async (locals: App.Locals) =>
	hasPermission(locals, {
		elevatedRoles: [UserRole.editor, UserRole.admin]
	});

const canModify = (locals: App.Locals, userId: string) =>
	hasPermission(locals, {
		elevatedRoles: [UserRole.editor, UserRole.admin],
		permissionQuery: ({ locals, db }) =>
			db
				.selectFrom('user')
				.where('user.id', '=', userId)
				.where('user.clientId', '=', locals.client.id)
				.where('user.id', '=', locals.authusr!.id)
				.select('user.id')
	});

/**
 * @openapi
 * summary-one: Get user
 * summary-all: Get users
 * tags:
 *  - Users
 *  - Current user (/me)
 * description: |
 *  Returns the user details for the specified user.
 *
 *  Use `GET /me` as a shortcut for the authenticated user.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const userId = requireParam(params.userId, 'The user parameter is required');

	const row = await findOneUserById(clientId, userId);
	return json(row);
};

/**
 * @openapi
 * summary: Create an user
 * tags:
 *  - Users
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	const clientId = locals.client.id;
	const authUserId = locals.authusr!.id;

	if (!(await canCreate(locals))) throw error(403, 'You are not allowed to create users');

	const parsed = await parseBody(request, createSchema, locals.language);
	if (!parsed.ok) return parsed.response;

	if (parsed.data.password?.length) {
		const salt = await bcrypt.genSalt();
		const hash = await bcrypt.hash(parsed.data.password, salt);
		parsed.data.password = `{bcrypt}${hash}`;
	}

	try {
		const inserted = await db
			.insertInto('user')
			.values({
				clientId,
				...parsed.data,
				createdBy: authUserId,
				updatedBy: authUserId
			})
			.returning('user.id')
			.executeTakeFirstOrThrow();

		const row = await findOneUserById(clientId, inserted.id);
		return json(row, { status: 201 });
	} catch (e) {
		if (parsed.data.email?.length && isUniqueViolation(e)) {
			return json(
				{ errors: { email: ['A user with this email already exists'] } },
				{ status: 422 }
			);
		}
		throw e;
	}
};

/**
 * @openapi
 * summary: Update user
 * tags:
 *  - Users
 */
export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const clientId = locals.client.id;
	const authUserId = locals.authusr!.id;
	const userId = requireParam(params.userId, 'The user parameter is required');

	if (!(await canModify(locals, userId)))
		throw error(403, 'You are not allowed to update this user');

	const parsed = await parseBody(request, patchSchema, locals.language);
	if (!parsed.ok) return parsed.response;

	if (parsed.data.password?.length) {
		const salt = await bcrypt.genSalt();
		const hash = await bcrypt.hash(parsed.data.password, salt);
		parsed.data.password = `{bcrypt}${hash}`;
	}

	try {
		const updated = await db
			.updateTable('user')
			.where('user.id', '=', userId)
			.where('user.clientId', '=', clientId)
			.set({
				...parsed.data,
				updatedAt: new Date(),
				updatedBy: authUserId
			})
			.returning('user.id')
			.executeTakeFirst();

		if (!updated) throw error(404, 'The user does not exist');

		const row = await findOneUserById(clientId, userId);
		return json(row, { status: 200 });
	} catch (e) {
		if (parsed.data.email?.length && isUniqueViolation(e)) {
			return json(
				{ errors: { email: ['A user with this email already exists'] } },
				{ status: 422 }
			);
		}
		throw e;
	}
};

/**
 * @openapi
 * summary: Delete user
 * tags:
 *  - Users
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const userId = requireParam(params.userId, 'The user parameter is required');

	if (!(await canModify(locals, userId)))
		throw error(403, 'You are not allowed to delete this user');

	const deleted = await db
		.deleteFrom('user')
		.where('user.id', '=', userId)
		.where('user.clientId', '=', clientId)
		.returning('user.id')
		.executeTakeFirst();

	if (!deleted) throw error(404, 'The user does not exist');

	return new Response(undefined, { status: 204 });
};
