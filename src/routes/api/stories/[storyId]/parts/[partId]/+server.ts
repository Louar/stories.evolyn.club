import { db } from '$lib/db/database';
import { findOnePartById } from '$lib/db/repositories/2-stories-module';
import { json } from '@sveltejs/kit';
import z from 'zod/v4';
import type { RequestHandler } from './$types';

const partSchema = z.object({
  backgroundType: z.string().nullish(),
  backgroundConfiguration: z.record(z.string(), z.unknown()).nullish(),
  foregroundType: z.string().nullish(),
  foregroundConfiguration: z.record(z.string(), z.unknown()).nullish(),
  isInitial: z.boolean().default(false),
  defaultNextPartId: z.string().nullish(),
  videoId: z.string().nullish(),
  announcementTemplateId: z.string().nullish(),
  quizLogicForPartId: z.string().nullish(),
  position: z.object({ x: z.number(), y: z.number() }).nullable(),
});

export const POST = (async ({ request, params }) => {

  const body = partSchema.safeParse(await request.json());
  if (!body.success) return json(body.error.issues, { status: 422 });

  const { position, backgroundConfiguration, foregroundConfiguration, ...rest } = body.data;

  const { id: partId } = await db
    .insertInto('part')
    .values({
      id: params.partId === 'new' ? undefined : params.partId,
      storyId: params.storyId,
      position: position ? JSON.stringify(position) : null,
      backgroundConfiguration: backgroundConfiguration ? JSON.stringify(backgroundConfiguration) : null,
      foregroundConfiguration: foregroundConfiguration ? JSON.stringify(foregroundConfiguration) : null,
      ...rest
    })
    .onConflict((oc) =>
      oc.columns(['id']).doUpdateSet({
        storyId: params.storyId,
        position: position ? JSON.stringify(position) : null,
        backgroundConfiguration: backgroundConfiguration ? JSON.stringify(backgroundConfiguration) : null,
        foregroundConfiguration: foregroundConfiguration ? JSON.stringify(foregroundConfiguration) : null,
        ...rest
      })
    )
    .returning('id')
    .executeTakeFirstOrThrow();

  const part = await findOnePartById(partId);

  return json(part);
});

export const DELETE = (async ({ params }) => {

  await db.deleteFrom('part')
    .where('id', '=', params.partId)
    .executeTakeFirstOrThrow();

  return json({ success: true });
}) satisfies RequestHandler;
