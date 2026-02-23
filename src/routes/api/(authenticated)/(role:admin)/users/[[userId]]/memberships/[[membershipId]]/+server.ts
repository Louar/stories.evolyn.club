import { db } from '$lib/db/database';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { hasPermission, isUniqueViolation, parseBody, requireParam } from '$lib/server/utils.server';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { membershipCreateSchema as createSchema, membershipPatchSchema as patchSchema } from './schemas.js';

const findOneMembershipById = async (clientId: string, userId: string, membershipId: string) => {
	const row = await db
		.selectFrom('membership')
		.innerJoin('group', 'group.id', 'membership.groupId')
		.where('group.clientId', '=', clientId)
		.where('membership.userId', '=', userId)
		.where('membership.id', '=', membershipId)
		.select((eb) => [
			'membership.id',
			'membership.groupId',
			'membership.userId',
			'membership.roles',
			'membership.createdAt',
			'membership.updatedAt',
			eb.selectFrom('milestoneEnrollment')
				.whereRef('milestoneEnrollment.membershipId', '=', 'membership.id')
				.select(eb.fn.countAll<number>().as('milestoneEnrollments'))
				.as('milestoneEnrollments'),
		])
		.executeTakeFirst();

	if (!row) throw error(404, 'The membership does not exist');
	return row;
};

const canCreate = async (locals: App.Locals) =>
	hasPermission(locals, {
		elevatedRoles: [UserRole.editor, UserRole.admin]
	});

const canModify = (locals: App.Locals) =>
	hasPermission(locals, {
		elevatedRoles: [UserRole.editor, UserRole.admin]
	});

export const GET: RequestHandler = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const userId = requireParam(params.userId, 'The user parameter is required');
	const membershipId = requireParam(params.membershipId, 'The membership parameter is required');

	const row = await findOneMembershipById(clientId, userId, membershipId);
	return json(row);
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const clientId = locals.client.id;
	const userId = requireParam(params.userId, 'The user parameter is required');

	const parsed = await parseBody(request, createSchema);
	if (!parsed.ok) return parsed.response;

	if (!await canCreate(locals)) throw error(403, 'You are not allowed to create memberships');

	try {
		const { id: membershipId } = await db
			.insertInto('membership')
			.values({
				userId,
				...parsed.data
			})
			.returning('membership.id')
			.executeTakeFirstOrThrow();

		const row = await findOneMembershipById(clientId, userId, membershipId);
		return json(row, { status: 201 });
	} catch (e) {
		if (isUniqueViolation(e)) {
			return json({ errors: { userId: ['This user is already a member of the group'] } }, { status: 422 });
		}
		throw e;
	}
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const clientId = locals.client.id;
	const userId = requireParam(params.userId, 'The user parameter is required');
	const membershipId = requireParam(params.membershipId, 'The membership parameter is required');

	if (!await canModify(locals)) throw error(403, 'You are not allowed to update this membership');

	const parsed = await parseBody(request, patchSchema);
	if (!parsed.ok) return parsed.response;

	try {
		const updated = await db
			.updateTable('membership')
			.where('membership.id', '=', membershipId)
			.set({
				...parsed.data,
				updatedAt: new Date()
			})
			.returning('membership.id')
			.executeTakeFirst();

		if (!updated) throw error(404, 'The membership does not exist');

		const row = await findOneMembershipById(clientId, userId, membershipId);
		return json(row, { status: 200 });
	} catch (e) {
		if (isUniqueViolation(e)) {
			return json({ errors: { userId: ['This user is already a member of the group'] } }, { status: 422 });
		}
		throw e;
	}
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	requireParam(params.userId, 'The user parameter is required');
	const membershipId = requireParam(params.membershipId, 'The membership parameter is required');

	if (!await canModify(locals)) throw error(403, 'You are not allowed to delete this membership');

	const deleted = await db
		.deleteFrom('membership')
		.where('membership.id', '=', membershipId)
		.returning('membership.id')
		.executeTakeFirst();

	if (!deleted) throw error(404, 'The membership does not exist');

	return new Response(undefined, { status: 204 });
};
