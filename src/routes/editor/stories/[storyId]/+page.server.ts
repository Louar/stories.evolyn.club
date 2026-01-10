import { env } from '$env/dynamic/private';
import { db } from '$lib/db/database';
import { findOneStoryById } from '$lib/db/repositories/2-stories-module';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (async ({ params }) => {

  const clientId = (await db.selectFrom('client').where('reference', '=', env.SECRET_DEFAULT_CLIENT_REFERENCE).select('id').executeTakeFirstOrThrow()).id;

  const storyId = params.storyId;

  if (storyId === 'new') {
    const newStoryId = await db.transaction().execute(async (trx) => {
      const { id: newStoryId } = await trx
        .insertInto('story')
        .values({
          clientId,
          reference: crypto.randomUUID().toString().slice(0, 8),
          name: 'New Story'
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await trx
        .insertInto('part')
        .values({
          storyId: newStoryId,
          position: JSON.stringify({ x: 0, y: 0 }),
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
