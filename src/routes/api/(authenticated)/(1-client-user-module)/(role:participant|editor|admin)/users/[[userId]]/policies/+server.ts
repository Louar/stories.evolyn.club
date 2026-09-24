import { db } from '$lib/db/database';
import { acceptLatestLicense } from '$lib/db/repositories/1-client-user-module';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { requireParam } from '$lib/server/utils.server';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * @openapi
 * summary: Accept the latest policy for a user
 * tags:
 *  - Users
 * description: |
 *  Accepts the latest policy applicable to the current client.
 *
 *  Use `PUT /me/policies` as a shortcut for the authenticated user.
 */
export const PUT: RequestHandler = async ({ locals, params }) => {
	const authenticatedUser = locals.authusr!;
	const userId = requireParam(params.userId, 'The user parameter is required');
	if (!authenticatedUser.roles.includes(UserRole.admin) && userId !== authenticatedUser.id) {
		error(403, 'You are not allowed to accept policies for this user');
	}

	const result = await db
		.transaction()
		.execute((trx) => acceptLatestLicense(locals.client.id, userId, trx));

	return json(result, { status: 200 });
};
