import { db } from '$lib/db/database';
import { storySchema } from '$lib/db/repositories/2-story-module';
import { canModifyStory, requireParam } from '$lib/server/utils.server';
import { clean } from '$lib/utils';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

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

	const { slug, name, ...rest } = body.data;
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
			...rest,
			createdBy: userId,
			updatedBy: userId
		})
		.onConflict((oc) =>
			oc.columns(['id']).doUpdateSet({
				slug,
				name: JSON.stringify(name),
				...rest,
				updatedAt: new Date(),
				updatedBy: userId
			})
		)
		.returning('id')
		.executeTakeFirstOrThrow();

	return json(body.data);
}) satisfies RequestHandler;

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
