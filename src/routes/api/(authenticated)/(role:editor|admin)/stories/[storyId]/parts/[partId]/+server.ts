import { db } from '$lib/db/database';
import { findOnePartById } from '$lib/db/repositories/2-stories-module';
import { LogicHitpolicy, PartBackgroundType, PartForegroundType } from '$lib/db/schemas/2-story-module.js';
import { canModifyStory } from '$lib/server/utils.server';
import { json } from '@sveltejs/kit';
import z from 'zod/v4';
import type { RequestHandler } from './$types';

const partSchema = z.object({
  backgroundType: z.enum(PartBackgroundType).nullable().catch(null),
  backgroundConfiguration: z.record(z.string(), z.unknown()).nullish(),
  foregroundType: z.enum(PartForegroundType).nullable().catch(null),
  foregroundConfiguration: z.record(z.string(), z.unknown()).nullish(),
  isInitial: z.boolean().default(false),
  defaultNextPartId: z.string().nullish(),
  videoId: z.string().nullish(),
  announcementTemplateId: z.string().nullish(),
  quizTemplateId: z.string().nullish(),
  quizLogicForPartId: z.string().nullish(),
  position: z.object({ x: z.number(), y: z.number() }).nullable(),
});

export const POST = (async ({ locals, params, request }) => {
  await canModifyStory(locals, params.storyId);

  const body = partSchema.safeParse(await request.json());
  if (!body.success) return json(body.error.issues, { status: 422 });

  const { position, backgroundConfiguration, foregroundConfiguration, quizTemplateId, ...rest } = body.data;

  const partId = await db.transaction().execute(async (trx) => {
    const { id: partId, foregroundType, quizLogicForPartId: initialQuizLogicForPartId } = await db
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
      .returning(['id', 'foregroundType', 'quizLogicForPartId'])
      .executeTakeFirstOrThrow();

    if (foregroundType === 'quiz' && quizTemplateId?.length) {
      if (!initialQuizLogicForPartId?.length) {
        const { id: quizLogicForPartId } = await trx
          .insertInto('quizLogicForPart')
          .values({
            hitpolicy: LogicHitpolicy.first,
            quizTemplateId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();

        await trx
          .updateTable('part')
          .where('id', '=', partId)
          .set({ quizLogicForPartId })
          .executeTakeFirstOrThrow();
      } else {
        await trx
          .updateTable('quizLogicForPart')
          .where('id', '=', initialQuizLogicForPartId)
          .set({ quizTemplateId })
          .executeTakeFirstOrThrow();
      }
    }

    return partId;
  });

  const part = await findOnePartById(partId);

  return json(part);
});

export const DELETE = (async ({ locals, params }) => {
  await canModifyStory(locals, params.storyId);

  await db.deleteFrom('part')
    .where('id', '=', params.partId)
    .executeTakeFirstOrThrow();

  return json({ success: true });
}) satisfies RequestHandler;
