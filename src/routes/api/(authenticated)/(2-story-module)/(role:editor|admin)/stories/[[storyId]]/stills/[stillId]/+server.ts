import { db } from '$lib/db/database';
import { findOneStillById } from '$lib/db/repositories/2-story-module';
import { formObjectPreprocessor, mediaValidator } from '$lib/db/schemas/0-utils';
import { canModifyStory, requireParam } from '$lib/server/utils.server';
import { json } from '@sveltejs/kit';
import z from 'zod/v4';
import type { RequestHandler } from './$types';

const stillSchema = z.object({
	color: z.preprocess(formObjectPreprocessor, z.string().nullable()),
	image: z.preprocess(formObjectPreprocessor, mediaValidator.nullable()),
	style: z.preprocess(formObjectPreprocessor, z.string().nullable())
});

export const POST = (async ({ locals, params, request }) => {
	const storyId = requireParam(params.storyId, 'The story path parameter is required');
	await canModifyStory(locals, storyId);

	const body = stillSchema.safeParse(await request.json());
	if (!body.success) return json(body.error.issues, { status: 422 });

	const stillId = await db.transaction().execute(async (trx) => {
		const values = {
			color: body.data.color,
			image: body.data.image ? JSON.stringify(body.data.image) : null,
			style: body.data.style
		};
		const still = await trx
			.insertInto('still')
			.values({ id: params.stillId === 'new' ? undefined : params.stillId, ...values })
			.onConflict((oc) => oc.column('id').doUpdateSet(values))
			.returning('id')
			.executeTakeFirstOrThrow();

		await trx
			.insertInto('stillAvailableToStory')
			.values({ storyId, stillId: still.id })
			.onConflict((oc) => oc.columns(['storyId', 'stillId']).doNothing())
			.execute();

		return still.id;
	});

	return json(await findOneStillById(stillId));
}) satisfies RequestHandler;

export const DELETE = (async ({ locals, params }) => {
	const storyId = requireParam(params.storyId, 'The story path parameter is required');
	await canModifyStory(locals, storyId);

	await db.deleteFrom('still').where('id', '=', params.stillId).executeTakeFirstOrThrow();
	return json({ success: true });
}) satisfies RequestHandler;
