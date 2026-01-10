import { env } from '$env/dynamic/private';
import { db } from '$lib/db/database';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (async () => {

  const clientId = (await db.selectFrom('client').where('reference', '=', env.SECRET_DEFAULT_CLIENT_REFERENCE).select('id').executeTakeFirstOrThrow()).id;

  const stories = await db
    .selectFrom('story')
    .where('story.clientId', '=', clientId)
    .select([
      'story.id',
      'story.name',
      'story.isPublic',
      'story.isPublished',
    ])
    .execute()

  return { stories };
});
