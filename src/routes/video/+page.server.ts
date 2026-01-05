import { env } from '$env/dynamic/private';
import { db } from '$lib/db/database';
import { findStory } from '$lib/db/repositories/2-stories-module';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (async () => {

  const clientId = (await db.selectFrom('client').where('reference', '=', env.SECRET_DEFAULT_CLIENT_REFERENCE).select('id').executeTakeFirstOrThrow()).id;
  const storyReference = 'quiz-of-cities';

  const story = await findStory(clientId, storyReference);

  const players = story?.parts?.map((part, index) => ({
    id: part.id,
    source: part?.background?.source,
    thumbnail: part?.background?.thumbnail ?? undefined,
    captions: part?.background?.captions ?? undefined,
    start: part?.backgroundConfiguration?.start ? part?.backgroundConfiguration?.start * part.background.duration : undefined,
    end: part?.backgroundConfiguration?.end ? part?.backgroundConfiguration?.end * part.background.duration : undefined,
    playbackRate: (part?.backgroundConfiguration?.playbackRate as number) ?? undefined,
    next: part?.defaultNextPartId ?? undefined,

    doBuffer: index === 0,
    doPlay: false,
    doRestart: false,
    watchPercentage: 0,
  }));

  return { story, players };
});
