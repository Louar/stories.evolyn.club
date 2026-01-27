import { db } from '$lib/db/database';
import { findOneStoryById } from '$lib/db/repositories/2-stories-module';
import type { Translatable } from '$lib/db/schemas/0-utils';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (async ({ locals, params }) => {

  const clientId = locals.client.id;

  const storyId = params.storyId;

  if (storyId === 'new') {
    console.log('new');
    const newStoryId = await db.transaction().execute(async (trx) => {
      const { id: newStoryId } = await trx
        .insertInto('story')
        .values({
          clientId,
          reference: crypto.randomUUID().toString().slice(0, 8),
          name: JSON.stringify({ en: 'New story' } as Translatable),
          isPublic: true,
          isPublished: true,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await trx
        .insertInto('part')
        .values({
          storyId: newStoryId,
          position: JSON.stringify({ x: 0, y: 0 }),
          isInitial: true,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return newStoryId;
    });

    redirect(302, `/editor/stories/${newStoryId}`);
  }

  const story = await findOneStoryById(clientId, storyId);
  return { story };
});
