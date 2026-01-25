import { db } from '$lib/db/database';
import { findOneVideoById } from '$lib/db/repositories/2-stories-module';
import { orientationableValidator } from '$lib/db/schemas/0-utils';
import { json } from '@sveltejs/kit';
import z from 'zod/v4';
import type { RequestHandler } from './$types';

const videoSchema = z.object({
  name: z.string().min(1),
  source: orientationableValidator,
  thumbnail: orientationableValidator.nullable(),
  duration: z.number().int().min(1),
});

export const POST = (async ({ request, params }) => {

  const body = videoSchema.safeParse(await request.json());
  if (!body.success) return json(body.error.issues, { status: 422 });

  const { name, source, thumbnail, duration } = body.data;

  const videoId = await db.transaction().execute(async (trx) => {

    const video = await trx
      .insertInto('video')
      .values({
        id: params.videoId === 'new' ? undefined : params.videoId,
        name,
        source: JSON.stringify(source),
        thumbnail: JSON.stringify(thumbnail),
        duration,
      })
      .onConflict((oc) =>
        oc.columns(['id']).doUpdateSet({
          name,
          source: JSON.stringify(source),
          thumbnail: JSON.stringify(thumbnail),
          duration,
        })
      )
      .returning('id')
      .executeTakeFirstOrThrow();
    await trx
      .insertInto('videoAvailableToStory')
      .values({
        storyId: params.storyId,
        videoId: video.id,
      })
      .onConflict((oc) => oc.columns(['storyId', 'videoId']).doNothing())
      .executeTakeFirstOrThrow();

    return video.id;
  });

  const video = await findOneVideoById(videoId);

  return json(video);
}) satisfies RequestHandler;

export const DELETE = (async ({ params }) => {

  await db.deleteFrom('video')
    .where('id', '=', params.videoId)
    .executeTakeFirstOrThrow();

  return json({ success: true });
}) satisfies RequestHandler;