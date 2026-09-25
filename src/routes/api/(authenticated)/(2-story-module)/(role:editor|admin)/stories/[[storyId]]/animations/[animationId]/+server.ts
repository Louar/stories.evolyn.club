import { db } from '$lib/db/database';
import { findOneAnimationById } from '$lib/db/repositories/2-story-module';
import { animationSchema } from '$lib/media/animation';
import { canModifyStory, requireParam } from '$lib/server/utils.server';
import { error, json } from '@sveltejs/kit';
import z from 'zod/v4';
import type { RequestHandler } from './$types';

const authorize = async (locals: App.Locals, storyId: string, animationId: string) => {
	await canModifyStory(locals, storyId);
	const story = await db
		.selectFrom('story')
		.where('id', '=', storyId)
		.where('clientId', '=', locals.client.id)
		.select('id')
		.executeTakeFirst();
	if (!story) error(404, 'Story not found');
	if (animationId === 'new') return;
	if (!z.uuid().safeParse(animationId).success) error(404, 'Animation not found');
	const links = await db
		.selectFrom('animationAvailableToStory')
		.innerJoin('story', 'story.id', 'animationAvailableToStory.storyId')
		.where('animationId', '=', animationId)
		.select(['story.id', 'story.clientId'])
		.execute();
	if (!links.some((link) => link.id === storyId)) error(404, 'Animation not found');
	for (const link of links) {
		if (link.clientId !== locals.client.id) error(403, 'Animation belongs to another client');
		await canModifyStory(locals, link.id);
	}
};

/**
 * @openapi
 * summary: Create or update animation
 * tags:
 *  - Story assets
 *  - Assistant
 */
export const POST = (async ({ locals, params, request }) => {
	const storyId = requireParam(params.storyId, 'The story path parameter is required');
	await authorize(locals, storyId, params.animationId);
	const body = animationSchema.safeParse(await request.json());
	if (!body.success) return json(body.error.issues, { status: 422 });
	const { name, configuration, texts } = body.data;
	const values = {
		name,
		configuration: JSON.stringify(configuration),
		texts: JSON.stringify(texts)
	};
	const animation = await db.transaction().execute(async (trx) => {
		if (params.animationId !== 'new') {
			const updated = await trx
				.updateTable('animation')
				.where('id', '=', params.animationId)
				.where(
					'id',
					'in',
					trx
						.selectFrom('animationAvailableToStory')
						.where('storyId', '=', storyId)
						.select('animationId')
				)
				.set(values)
				.returning('id')
				.executeTakeFirst();
			if (!updated) error(404, 'Animation not found');
			return updated;
		}
		const created = await trx
			.insertInto('animation')
			.values(values)
			.returning('id')
			.executeTakeFirstOrThrow();
		await trx
			.insertInto('animationAvailableToStory')
			.values({ storyId, animationId: created.id })
			.execute();
		return created;
	});
	return json(await findOneAnimationById(storyId, animation.id));
}) satisfies RequestHandler;

/**
 * @openapi
 * summary: Get animation
 * tags:
 *  - Story assets
 *  - Assistant
 */
export const GET = (async ({ locals, params }) => {
	const storyId = requireParam(params.storyId, 'The story path parameter is required');
	await authorize(locals, storyId, params.animationId);
	if (params.animationId === 'new') error(404, 'Animation not found');
	return json(await findOneAnimationById(storyId, params.animationId));
}) satisfies RequestHandler;

/**
 * @openapi
 * summary: Delete animation
 * tags:
 *  - Story assets
 *  - Assistant
 */
export const DELETE = (async ({ locals, params }) => {
	const storyId = requireParam(params.storyId, 'The story path parameter is required');
	await authorize(locals, storyId, params.animationId);
	if (params.animationId === 'new') error(404, 'Animation not found');
	await db.transaction().execute(async (trx) => {
		await trx
			.updateTable('part')
			.where('animationId', '=', params.animationId)
			.set({ animationId: null, backgroundType: null, backgroundConfiguration: null })
			.execute();
		const deleted = await trx
			.deleteFrom('animation')
			.where('id', '=', params.animationId)
			.where(
				'id',
				'in',
				trx
					.selectFrom('animationAvailableToStory')
					.where('storyId', '=', storyId)
					.select('animationId')
			)
			.returning('id')
			.executeTakeFirst();
		if (!deleted) error(404, 'Animation not found');
	});
	return json({ success: true });
}) satisfies RequestHandler;
