import { db } from '$lib/db/database';
import { findOneAnnouncementById } from '$lib/db/repositories/2-stories-module';
import type { Translatable } from '$lib/db/schemas/0-utils';
import { json } from '@sveltejs/kit';
import z from 'zod/v4';
import type { RequestHandler } from './$types';

const announcementSchema = z.object({
  name: z.string().min(1),
  title: z.string().nullable(),
  message: z.string().nullable(),
});

export const POST = (async ({ request, params }) => {

  const body = announcementSchema.safeParse(await request.json());
  if (!body.success) return json(body.error.issues, { status: 422 });

  const { name, title, message } = body.data;

  const announcementId = await db.transaction().execute(async (trx) => {

    const announcement = await trx
      .insertInto('announcementTemplate')
      .values({
        id: params.announcementId === 'new' ? undefined : params.announcementId,
        name,
        title: JSON.stringify({ default: title } as Translatable),
        message: JSON.stringify({ default: message } as Translatable),
      })
      .onConflict((oc) =>
        oc.columns(['id']).doUpdateSet({
          name,
          title: JSON.stringify({ default: title } as Translatable),
          message: JSON.stringify({ default: message } as Translatable),
        })
      )
      .returning('id')
      .executeTakeFirstOrThrow();
    await trx
      .insertInto('announcementTemplateAvailableToStory')
      .values({
        storyId: params.storyId,
        announcementTemplateId: announcement.id,
      })
      .onConflict((oc) => oc.columns(['storyId', 'announcementTemplateId']).doNothing())
      .executeTakeFirstOrThrow();

    return announcement.id;
  });

  const announcement = await findOneAnnouncementById(announcementId);

  return json(announcement);
}) satisfies RequestHandler;

export const DELETE = (async ({ params }) => {

  await db.deleteFrom('announcementTemplate')
    .where('id', '=', params.announcementId)
    .executeTakeFirstOrThrow();

  return json({ success: true });
}) satisfies RequestHandler;