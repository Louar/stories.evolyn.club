import { authenticateUser } from '$lib/db/repositories/1-client-user-module.js';
import * as m from '$lib/paraglide/messages';
import { parseBody } from '$lib/server/utils.server';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticationSchema as createSchema } from './schemas.js';

/**
 * @openapi
 * summary: Authenticate
 * tags:
 *  - Authentication
 */
export const POST = (async ({ url, request, locals, cookies }) => {
	const parsed = await parseBody(request, createSchema, locals.language);
	if (!parsed.ok) return parsed.response;

	const { email, password } = parsed.data;

	delete locals.authusr;
	cookies.delete(process.env.NODE_ENV === 'production' ? '__session' : '__session_stories', {
		domain: url.hostname,
		path: '/'
	});
	try {
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
	} catch (e) {
		if (e instanceof Error) return error(422, e.message);
		else return error(422, m.auth_login_failed());
	}
}) satisfies RequestHandler;
