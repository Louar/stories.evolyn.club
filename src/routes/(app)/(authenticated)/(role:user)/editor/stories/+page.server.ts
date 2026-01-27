import { db } from '$lib/db/database';
import { selectLocalizedField } from '$lib/db/schemas/0-utils';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (async ({ locals }) => {

  const clientId = locals.client.id;
  const language = locals.authusr?.language ?? undefined;

  const stories = await db
    .selectFrom('story')
    .where('story.clientId', '=', clientId)
    .select((eb) => [
      'story.id',
      selectLocalizedField(eb, 'story.name', language).as('name'),

      'story.isPublic',
      'story.isPublished',
    ])
    .execute()

  return { stories };
});
