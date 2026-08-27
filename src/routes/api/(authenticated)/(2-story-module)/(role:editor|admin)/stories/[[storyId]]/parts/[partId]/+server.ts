import { db } from '$lib/db/database';
import { findOnePartById } from '$lib/db/repositories/2-story-module';
import {
  LogicHitpolicy,
  PartBackgroundType,
  PartForegroundType
} from '$lib/db/schemas/2-story-module.js';
import { canModifyStory, requireParam } from '$lib/server/utils.server';
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
  stillId: z.string().nullish(),
  announcementTemplateId: z.string().nullish(),
  quizTemplateId: z.string().nullish(),
  quizLogicForPartId: z.string().nullish(),
  taxonomyId: z.string().nullish(),
  taxonomyDraftForPartId: z.string().nullish(),
  position: z.object({ x: z.number(), y: z.number() }).nullable()
});

/**
 * @openapi
 * summary: Create or update story part
 * tags:
 *  - Stories
 */
export const POST = async ({ locals, params, request }) => {
  const storyId = requireParam(params.storyId, 'The story path parameter is required');
  await canModifyStory(locals, storyId);

  const body = partSchema.safeParse(await request.json());
  if (!body.success) return json(body.error.issues, { status: 422 });

  const {
    position,
    backgroundConfiguration,
    foregroundConfiguration,
    quizTemplateId,
    taxonomyId,
    ...rawRest
  } = body.data;
  const rest = {
    ...rawRest,
    videoId: rawRest.backgroundType === 'video' ? rawRest.videoId : null,
    stillId: rawRest.backgroundType === 'still' ? rawRest.stillId : null
  };

  const partId = await db.transaction().execute(async (trx) => {
    const {
      id: partId,
      foregroundType,
      quizLogicForPartId: initialQuizLogicForPartId,
      taxonomyDraftForPartId: initialTaxonomyDraftForPartId
    } = await trx
      .insertInto('part')
      .values({
        id: params.partId === 'new' ? undefined : params.partId,
        storyId,
        position: position ? JSON.stringify(position) : null,
        backgroundConfiguration: backgroundConfiguration
          ? JSON.stringify(backgroundConfiguration)
          : null,
        foregroundConfiguration: foregroundConfiguration
          ? JSON.stringify(foregroundConfiguration)
          : null,
        ...rest
      })
      .onConflict((oc) =>
        oc.columns(['id']).doUpdateSet({
          storyId: params.storyId,
          position: position ? JSON.stringify(position) : null,
          backgroundConfiguration: backgroundConfiguration
            ? JSON.stringify(backgroundConfiguration)
            : null,
          foregroundConfiguration: foregroundConfiguration
            ? JSON.stringify(foregroundConfiguration)
            : null,
          ...rest
        })
      )
      .returning(['id', 'foregroundType', 'quizLogicForPartId', 'taxonomyDraftForPartId'])
      .executeTakeFirstOrThrow();

    if (foregroundType === 'quiz' && quizTemplateId?.length) {
      if (!initialQuizLogicForPartId?.length) {
        const { id: quizLogicForPartId } = await trx
          .insertInto('quizLogicForPart')
          .values({
            hitpolicy: LogicHitpolicy.first,
            quizTemplateId
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

    if (foregroundType === 'taxonomy' && taxonomyId?.length) {
      const taxonomy = await trx
        .selectFrom('taxonomy')
        .where('id', '=', taxonomyId)
        .where('clientId', '=', locals.client.id)
        .select('id')
        .executeTakeFirst();
      if (!taxonomy) return partId;

      if (!initialTaxonomyDraftForPartId?.length) {
        const draft = await trx
          .insertInto('taxonomyDraftForPart')
          .values({ taxonomyId })
          .returning('id')
          .executeTakeFirstOrThrow();
        await trx
          .updateTable('part')
          .where('id', '=', partId)
          .set({ taxonomyDraftForPartId: draft.id })
          .executeTakeFirstOrThrow();
      } else {
        await trx
          .updateTable('taxonomyDraftForPart')
          .where('id', '=', initialTaxonomyDraftForPartId)
          .set({ taxonomyId })
          .executeTakeFirstOrThrow();
      }
    }

    return partId;
  });

  const part = await findOnePartById(partId);

  return json(part);
};

/**
 * @openapi
 * summary: Delete story part
 * tags:
 *  - Stories
 */
export const DELETE = (async ({ locals, params }) => {
  const storyId = requireParam(params.storyId, 'The story path parameter is required');
  await canModifyStory(locals, storyId);

  await db.deleteFrom('part').where('id', '=', params.partId).executeTakeFirstOrThrow();

  return json({ success: true });
}) satisfies RequestHandler;
