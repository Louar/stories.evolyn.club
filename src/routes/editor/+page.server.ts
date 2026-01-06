import { env } from '$env/dynamic/private';
import { db } from '$lib/db/database';
import { findOneStoryById } from '$lib/db/repositories/2-stories-module';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (async () => {

  const clientId = (await db.selectFrom('client').where('reference', '=', env.SECRET_DEFAULT_CLIENT_REFERENCE).select('id').executeTakeFirstOrThrow()).id;
  const storyReference = 'quiz-of-cities';

  const { id: storyId } = await db
    .selectFrom('story')
    .where('story.reference', '=', storyReference)
    .where('story.clientId', '=', clientId)
    .select('story.id')
    .executeTakeFirstOrThrow()

  const story = await findOneStoryById(clientId, storyId);

  return { story };
});
