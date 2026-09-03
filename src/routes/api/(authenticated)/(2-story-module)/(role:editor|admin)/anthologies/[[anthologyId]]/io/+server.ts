import { db } from '$lib/db/database';
import { findOneStoryById } from '$lib/db/repositories/2-story-module';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { AnthologyPermissionRole } from '$lib/db/schemas/2-story-module';
import { hasPermission, requireParam } from '$lib/server/utils.server';
import { json } from '@sveltejs/kit';
import type { NotNull } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import YAML from 'yaml';
import type { RequestHandler } from './$types';
import { schema } from './schemas';

const parseBody = async (request: Request) => {
	const body = await request.text();
	const contentType = request.headers.get('content-type') ?? '';

	try {
		if (contentType.includes('json')) return JSON.parse(body);
		return YAML.parse(body);
	} catch {
		return undefined;
	}
};

const canAccessAnthology = (locals: App.Locals, anthologyId: string) =>
	hasPermission(locals, {
		elevatedRoles: [UserRole.admin],
		permissionQuery: ({ locals, db }) => {
			const userId = locals.authusr!.id;

			return db
				.selectFrom('anthologyPermission')
				.where('anthologyPermission.anthologyId', '=', anthologyId)
				.where('anthologyPermission.userId', '=', userId)
				.select('anthologyPermission.id');
		}
	});

const findOneAnthologyById = async (clientId: string, anthologyId: string) =>
	db
		.selectFrom('anthology')
		.where('anthology.id', '=', anthologyId)
		.where('anthology.clientId', '=', clientId)
		.select((eb) => [
			'anthology.id',
			'anthology.slug',
			'anthology.name',
			'anthology.configuration',
			'anthology.isPublished',
			'anthology.isPublic',
			jsonArrayFrom(
				eb
					.selectFrom('anthologyPosition')
					.whereRef('anthologyPosition.anthologyId', '=', 'anthology.id')
					.innerJoin('story', 'story.id', 'anthologyPosition.storyId')
					.select([
						'anthologyPosition.id',
						'anthologyPosition.order',
						'story.id as storyId',
						'story.slug as storySlug',
						'anthologyPosition.configuration'
					])
					.orderBy('anthologyPosition.order', 'asc')
					.$narrowType<{
						id: NotNull;
						order: NotNull;
						storyId: NotNull;
						storySlug: NotNull;
					}>()
			).as('positions')
		])
		.executeTakeFirstOrThrow();

/**
 * @openapi
 * summary: Export anthology
 * tags:
 *  - Anthologies
 *  - Assistant
 */
export const GET = (async ({ locals, params, url }) => {
	const clientId = locals.client.id;
	const anthologyId = requireParam(params.anthologyId, 'The anthology path parameter is required');
	const includeStories = url.searchParams.get('includeStories') === 'true';

	if (!(await canAccessAnthology(locals, anthologyId))) {
		return json({ message: 'You are not allowed to access this anthology' }, { status: 403 });
	}

	const anthology = await findOneAnthologyById(clientId, anthologyId);
	const { positions, ...restAnthology } = anthology;
	const storyIds = [...new Set(positions.map((position) => position.storyId))];
	const yaml = YAML.stringify({
		...restAnthology,
		positions: positions.map(({ storyId: _storyId, ...position }) => position),
		...(includeStories
			? {
					stories: await Promise.all(storyIds.map((storyId) => findOneStoryById(clientId, storyId)))
				}
			: {})
	});

	return new Response(yaml, {
		headers: {
			'content-type': 'application/yaml',
			'content-disposition': `attachment; filename="anthology-${anthology.slug}.yaml"`
		}
	});
}) satisfies RequestHandler;

/**
 * @openapi
 * summary: Import anthology
 * tags:
 *  - Anthologies
 *  - Assistant
 */
export const POST = (async ({ locals, request, fetch }) => {
	const clientId = locals.client.id;
	const userId = locals.authusr!.id;

	const rawBody = await parseBody(request);
	if (rawBody === undefined) return json({ message: 'Invalid JSON or YAML body' }, { status: 400 });

	const body = schema.safeParse(rawBody);
	if (!body.success) {
		return json({ message: 'Invalid anthology body', issues: body.error.issues }, { status: 422 });
	}
	const anthologyRaw = body.data;

	const storyIdBySlug = new Map<string, string>();
	for (const storyRaw of anthologyRaw.stories ?? []) {
		const res = await fetch('/api/stories/io', {
			method: 'POST',
			body: JSON.stringify(storyRaw),
			headers: { 'content-type': 'application/json' }
		});

		if (!res.ok) return json(await res.json().catch(() => ({})), { status: res.status });

		const story = (await res.json()) as { id?: string; slug?: string };
		if (story.id?.length) storyIdBySlug.set(storyRaw.slug, story.id);
	}

	const storySlugs = [
		...new Set(
			anthologyRaw.positions
				.map((position) => position.storySlug)
				.filter((storySlug) => !storyIdBySlug.has(storySlug))
		)
	];
	const stories = storySlugs.length
		? await db
				.selectFrom('story')
				.where('clientId', '=', clientId)
				.where('slug', 'in', storySlugs)
				.select(['id', 'slug'])
				.execute()
		: [];
	for (const story of stories) storyIdBySlug.set(story.slug, story.id);

	const missingStorySlugs = anthologyRaw.positions
		.map((position) => position.storySlug)
		.filter((storySlug) => !storyIdBySlug.has(storySlug));
	if (missingStorySlugs.length) {
		return json(
			{ message: 'Some stories do not exist', storySlugs: [...new Set(missingStorySlugs)] },
			{ status: 422 }
		);
	}

	const anthologyId = await db.transaction().execute(async (trx) => {
		let anthologySlug = anthologyRaw.slug;
		const exists = await trx
			.selectFrom('anthology')
			.where('anthology.slug', '=', anthologySlug)
			.where('anthology.clientId', '=', clientId)
			.select('anthology.id')
			.executeTakeFirst();
		if (exists) anthologySlug += `-${crypto.randomUUID().toString().slice(0, 8)}`;

		const anthology = await trx
			.insertInto('anthology')
			.values({
				clientId,
				slug: anthologySlug,
				name: JSON.stringify(anthologyRaw.name),
				configuration: anthologyRaw.configuration
					? JSON.stringify(anthologyRaw.configuration)
					: null,
				isPublished: anthologyRaw.isPublished,
				isPublic: anthologyRaw.isPublic,
				createdBy: userId,
				updatedBy: userId
			})
			.returning('id')
			.executeTakeFirstOrThrow();

		await trx
			.insertInto('anthologyPermission')
			.values({
				anthologyId: anthology.id,
				userId,
				role: AnthologyPermissionRole.owner,
				createdBy: userId,
				updatedBy: userId
			})
			.executeTakeFirstOrThrow();

		for (const positionRaw of anthologyRaw.positions) {
			const storyId = storyIdBySlug.get(positionRaw.storySlug)!;
			await trx
				.insertInto('anthologyPosition')
				.values({
					anthologyId: anthology.id,
					storyId,
					order: positionRaw.order,
					configuration: positionRaw.configuration
						? JSON.stringify(positionRaw.configuration)
						: null
				})
				.executeTakeFirstOrThrow();
		}

		return anthology.id;
	});

	const anthology = await findOneAnthologyById(clientId, anthologyId);
	return json(anthology, { status: 201 });
}) satisfies RequestHandler;
