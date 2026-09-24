import { db } from '$lib/db/database.js';
import {
	acceptLatestLicense,
	authenticateUser
} from '$lib/db/repositories/1-client-user-module.js';
import { UserRole } from '$lib/db/schemas/1-client-user-module.js';
import * as m from '$lib/paraglide/messages';
import { parseBody } from '$lib/server/utils.server';
import { error, json } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import type { RequestHandler } from './$types';
import { authenticationSchema as createSchema } from './schemas.js';

/**
 * @openapi
 * summary: Register a new account
 * tags:
 *  - Authentication
 */
export const POST = (async ({ url, request, locals, cookies }) => {
	const clientId = locals.client.id;
	const parsed = await parseBody(request, createSchema, locals.language);
	if (!parsed.ok) return parsed.response;

	const { email, password } = parsed.data;

	const user = await db
		.selectFrom('user')
		.select('id')
		.where('clientId', '=', clientId)
		.where('email', '=', email)
		.executeTakeFirst();
	if (user) return error(409, m.auth_account_exists());

	const roles: UserRole[] = [UserRole.participant];
	if (
		((
			await db
				.selectFrom('user')
				.where('clientId', '=', clientId)
				.select(({ fn }) => fn.countAll().as('count'))
				.executeTakeFirst()
		)?.count || 0) === 0
	)
		roles.push(UserRole.admin);

	const salt = await bcrypt.genSalt();
	const hash = await bcrypt.hash(password, salt);

	try {
		await db.transaction().execute(async (trx) => {
			const createdUser = await trx
				.insertInto('user')
				.values({
					clientId,
					email,
					password: `{bcrypt}${hash}`,
					roles
				})
				.returning('id')
				.executeTakeFirstOrThrow();

			await acceptLatestLicense(clientId, createdUser.id, trx, false);
		});
	} catch (e) {
		if (e instanceof Error) return error(422, e.message);
		else return error(422, m.auth_registration_failed());
	}

	// Authenticate
	try {
		await authenticateUser(
			email,
			password,
			url.hostname,
			locals.client.id,
			locals.client.accessTokenKey,
			cookies
		);
	} catch (e) {
		if (e instanceof Error) return error(422, e.message);
		else return error(422, m.auth_registration_failed());
	}

	delete locals.authusr;
	cookies.delete(process.env.NODE_ENV === 'production' ? '__session' : '__session_stories', {
		domain: url.hostname,
		path: '/'
	});
	const { id, token } = await authenticateUser(
		email,
		password,
		url.hostname,
		locals.client.id,
		locals.client.accessTokenKey,
		cookies
	);

	if (!token) error(422, m.auth_login_failed());

	return json({ id, token }, { status: 201 });
}) satisfies RequestHandler;
