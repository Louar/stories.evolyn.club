import { db } from '$lib/db/database';
import { storySchema } from '$lib/db/repositories/2-story-module';
import { StoryPermissionRole } from '$lib/db/schemas/2-story-module';
import {
	canModifyStory,
	isUniqueViolation,
	parseBody,
	requireParam
} from '$lib/server/utils.server';
import { clean } from '$lib/utils';
import { error, json } from '@sveltejs/kit';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { z } from 'zod/v4';
import type { RequestHandler } from './$types';

const storyGridSchema = storySchema.extend({
	configuration: z.record(z.string(), z.unknown()).nullable().default(null)
});
const storyPatchSchema = z.object({
	slug: storySchema.shape.slug.optional(),
	name: storySchema.shape.name.optional(),
	defaultBackgroundColor: z.string().nullable().optional(),
	thumbnail: storySchema.shape.thumbnail.unwrap().optional(),
	configuration: z.record(z.string(), z.unknown()).nullable().optional(),
	isPublished: z.boolean().optional(),
	isPublic: z.boolean().optional()
});

const findStoryGridRow = async (clientId: string, storyId: string) => {
	const row = await db
		.selectFrom('story')
		.where('story.clientId', '=', clientId)
		.where('story.id', '=', storyId)
		.select((eb) => [
			'story.id',
			'story.clientId',
			'story.slug',
			'story.name',
			'story.defaultBackgroundColor',
			'story.thumbnail',
			'story.configuration',
			'story.isPublished',
			'story.isPublic',
			'story.createdAt',
			'story.updatedAt',
			eb
				.selectFrom('storyPermission')
				.whereRef('storyPermission.storyId', '=', 'story.id')
				.select(eb.fn.countAll<number>().as('permissions'))
				.as('permissions'),
			jsonObjectFrom(
				eb
					.selectFrom('user')
					.whereRef('user.id', '=', 'story.createdBy')
					.select(['user.id', 'user.firstName as label', 'user.picture as image'])
			).as('createdBy'),
			jsonObjectFrom(
				eb
					.selectFrom('user')
					.whereRef('user.id', '=', 'story.updatedBy')
					.select(['user.id', 'user.firstName as label', 'user.picture as image'])
			).as('updatedBy')
		])
		.executeTakeFirst();
	if (!row) throw error(404, 'Story not found');
	return row;
};

export const POST = (async ({ locals, request }) => {
	const clientId = locals.client.id;
	const userId = locals.authusr!.id;
	const parsed = await parseBody(request, storyGridSchema, locals.language);
	if (!parsed.ok) return parsed.response;
	const { name, thumbnail, configuration, ...rest } = parsed.data;

	try {
		const storyId = await db.transaction().execute(async (trx) => {
			const story = await trx
				.insertInto('story')
				.values({
					clientId,
					...rest,
					name: JSON.stringify(name),
					thumbnail: thumbnail ? JSON.stringify(thumbnail) : null,
					configuration: configuration ? JSON.stringify(configuration) : null,
					createdBy: userId,
					updatedBy: userId
				})
				.returning('id')
				.executeTakeFirstOrThrow();
			await trx
				.insertInto('storyPermission')
				.values({ storyId: story.id, userId, role: StoryPermissionRole.owner })
				.executeTakeFirstOrThrow();
			await trx
				.insertInto('part')
				.values({ storyId: story.id, position: JSON.stringify({ x: 0, y: 0 }), isInitial: true })
				.executeTakeFirstOrThrow();
			return story.id;
		});
		return json(await findStoryGridRow(clientId, storyId), { status: 201 });
	} catch (e) {
		if (isUniqueViolation(e))
			return json({ errors: { slug: ['Slug already exists'] } }, { status: 422 });
		throw e;
	}
}) satisfies RequestHandler;

export const PATCH = (async ({ locals, params, request }) => {
	const clientId = locals.client.id;
	const userId = locals.authusr!.id;
	const storyId = requireParam(params.storyId, 'The story path parameter is required');
	await canModifyStory(locals, storyId);
	const parsed = await parseBody(request, storyPatchSchema, locals.language);
	if (!parsed.ok) return parsed.response;
	const { name, thumbnail, configuration, ...rest } = parsed.data;

	try {
		const updated = await db
			.updateTable('story')
			.where('clientId', '=', clientId)
			.where('id', '=', storyId)
			.set({
				...rest,
				...(name !== undefined ? { name: JSON.stringify(name) } : {}),
				...(thumbnail !== undefined
					? { thumbnail: thumbnail ? JSON.stringify(thumbnail) : null }
					: {}),
				...(configuration !== undefined
					? { configuration: configuration ? JSON.stringify(configuration) : null }
					: {}),
				updatedAt: new Date(),
				updatedBy: userId
			})
			.returning('id')
			.executeTakeFirst();
		if (!updated) throw error(404, 'Story not found');
		return json(await findStoryGridRow(clientId, storyId));
	} catch (e) {
		if (isUniqueViolation(e))
			return json({ errors: { slug: ['Slug already exists'] } }, { status: 422 });
		throw e;
	}
}) satisfies RequestHandler;

/**
 * @openapi
 * summary: Update story
 * tags:
 *  - Stories
 *  - Assistant
 */
export const PUT = (async ({ locals, params, request }) => {
	const clientId = locals.client.id;
	const userId = locals.authusr!.id;
	const storyId = requireParam(params.storyId, 'The story path parameter is required');

	await canModifyStory(locals, storyId);

	const body = storySchema.safeParse(clean(await request.json()));
	if (!body.success) return json(body.error.issues, { status: 422 });

	const story = await db
		.selectFrom('story')
		.where('clientId', '=', clientId)
		.where('id', '=', storyId)
		.select('id')
		.executeTakeFirst();
	if (!story) error(404, `Story not found`);

	const { slug, name, thumbnail, ...rest } = body.data;
	const slugConflict = await db
		.selectFrom('story')
		.where('clientId', '=', clientId)
		.where('id', '!=', storyId)
		.where('slug', '=', slug)
		.select('id')
		.executeTakeFirst();
	if (slugConflict)
		return json([{ code: 'custom', path: ['slug'], message: 'Slug already exists' }], {
			status: 422
		});

	await db
		.insertInto('story')
		.values({
			clientId,
			id: storyId,
			slug,
			name: JSON.stringify(name),
			thumbnail: JSON.stringify(thumbnail),
			...rest,
			createdBy: userId,
			updatedBy: userId
		})
		.onConflict((oc) =>
			oc.columns(['id']).doUpdateSet({
				slug,
				name: JSON.stringify(name),
				thumbnail: JSON.stringify(thumbnail),
				...rest,
				updatedAt: new Date(),
				updatedBy: userId
			})
		)
		.returning('id')
		.executeTakeFirstOrThrow();

	return json(body.data);
}) satisfies RequestHandler;

/**
 * @openapi
 * summary: Delete story
 * tags:
 *  - Stories
 *  - Assistant
 */
export const DELETE = (async ({ locals, params }) => {
	const clientId = locals.client.id;
	const storyId = requireParam(params.storyId, 'The story path parameter is required');

	await canModifyStory(locals, storyId);

	await db
		.deleteFrom('story')
		.where('clientId', '=', clientId)
		.where('id', '=', storyId)
		.executeTakeFirstOrThrow();

	return json({ success: true });
}) satisfies RequestHandler;
