import type { Player } from '$lib/components/app/player/types';
import { findOneAnthologyByReference, findOneStoryByReference } from '$lib/db/repositories/2-stories-module';
import { Language, Orientation } from '$lib/db/schemas/0-utils';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (async ({ locals, params }) => {

  const clientId = locals.client.id;

  const settings = params.settings?.toLowerCase()?.split('/');
  const setLanguage = (input: string[]): Language | undefined => {
    const values = new Set<string>(Object.values(Language));
    const match = input.find(value => values.has(value));
    return (match as Language) ?? undefined;
  }
  const language = setLanguage(settings);
  const setOrientation = (input: string[]): Orientation | undefined => {
    const values = new Set<string>(Object.values(Orientation));
    const match = input.find(value => values.has(value));
    return (match as Orientation) ?? undefined;
  }
  const orientation = setOrientation(settings);

  const anthologyReference = params.anthologyReference;

  const anthology = await findOneAnthologyByReference(clientId, anthologyReference, language);
  if (!anthology) error(404, `The anthology '${anthologyReference}' was not found. It may not exist, or may not be published, yet.`);

  const stories: NonNullable<Awaited<ReturnType<typeof findOneStoryByReference>>>[] = [];
  const playersOfStories: Player[][] = [];

  for (const { reference: storyReference } of anthology.stories) {
    const story = await findOneStoryByReference(clientId, storyReference, orientation, language);
    if (!story) error(404, `The story '${storyReference}' was not found. It may not exist, or may not be published, yet.`);

    const players = story?.parts?.map((part, index) => ({
      id: part.id,
      source: part.background?.source,
      thumbnail: part.background?.thumbnail ?? undefined,
      captions: part.background?.captions ?? undefined,
      start: part.background?.start && part.background?.duration ? part?.background?.start * part.background?.duration : undefined,
      end: part.background?.end && part.background?.duration ? part?.background?.end * part.background?.duration : undefined,
      playbackRate: 1, // (part.background?.playbackRate as number) ?? undefined,
      isInitialPart: index === 0,
      next: part.defaultNextPartId ?? undefined,

      doBuffer: index === 0,
      doPlay: false,
      doRestart: false,
      doEnd: false,
      time: 0,
    }));

    stories.push(story);
    playersOfStories.push(players);
  }

  return { anthology, stories, playersOfStories, orientation };
});
