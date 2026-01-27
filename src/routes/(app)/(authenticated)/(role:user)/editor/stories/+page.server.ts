import { db } from '$lib/db/database';
import { selectLocalizedField } from '$lib/db/schemas/0-utils';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (async ({ locals }) => {

  const clientId = locals.client.id;
  const userId = locals.authusr!.id;
  const language = locals.authusr!.language;

  const stories = await db
    .selectFrom('story')
    .leftJoin('storyPermission', 'storyPermission.storyId', 'story.id')
    .where('story.clientId', '=', clientId)
    .where('storyPermission.userId', '=', userId)
    .select((eb) => [
      'story.id',
      selectLocalizedField(eb, 'story.name', language).as('name'),

      'story.isPublic',
      'story.isPublished',
    ])
    .execute()

  return { stories };
});
