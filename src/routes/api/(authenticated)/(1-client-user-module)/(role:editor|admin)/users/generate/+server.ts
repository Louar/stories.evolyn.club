import { db } from '$lib/db/database';
import { Language } from '$lib/db/schemas/0-utils';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { hasPermission, isUniqueViolation, parseBody } from '$lib/server/utils.server';
import { error, json } from '@sveltejs/kit';
import { z } from 'zod/v4';
import type { RequestHandler } from './$types';

const MAX_BATCH = 1000;
const CHUNK_SIZE = 200;

const generateUsersSchema = z.object({
	count: z.coerce.number().int().min(1).max(MAX_BATCH)
});

const canCreate = async (locals: App.Locals) =>
	hasPermission(locals, {
		elevatedRoles: [UserRole.admin]
	});

/**
 * @openapi
 * summary: Import users
 * tags:
 *  - Users
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	const clientId = locals.client.id;
	const authUserId = locals.authusr?.id;

	if (!authUserId) throw error(401, 'You are not authenticated');
	if (!(await canCreate(locals))) throw error(403, 'You are not allowed to generate users');

	const parsed = await parseBody(request, generateUsersSchema, locals.language);
	if (!parsed.ok) return parsed.response;

	const { count } = parsed.data;
	let createdUsersCount = 0;
	let createdAuthCodesCount = 0;
	const results: { userId: string; authCode: string }[] = [];

	for (let start = 0; start < count; start += CHUNK_SIZE) {
		const chunkCount = Math.min(CHUNK_SIZE, count - start);

		await db.transaction().execute(async (trx) => {
			const insertedUsers = await trx
				.insertInto('user')
				.values(
					Array.from({ length: chunkCount }, () => ({
						clientId,
						roles: [UserRole.participant],
						language: Language.Nederlands,
						isActive: true,
						createdBy: authUserId,
						updatedBy: authUserId
					}))
				)
				.returning('id')
				.execute();

			for (const user of insertedUsers) {
				for (let attempt = 0; attempt < 2; attempt++) {
					const value = crypto.randomUUID();
					try {
						await trx
							.insertInto('authCode')
							.values({
								clientId,
								userId: user.id,
								value
							})
							.executeTakeFirstOrThrow();
						results.push({ userId: user.id, authCode: value });
						break;
					} catch (e) {
						if (isUniqueViolation(e) && attempt === 0) continue;
						throw e;
					}
				}
			}

			createdUsersCount += insertedUsers.length;
			createdAuthCodesCount += insertedUsers.length;
		});
	}

	return json(
		{
			requestedCount: count,
			createdUsersCount,
			createdAuthCodesCount,
			results
		},
		{ status: 201 }
	);
};
