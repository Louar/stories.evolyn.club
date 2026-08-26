import type { Player } from '$lib/components/app/player/types';
import {
  findOneAnthologyBySlug,
  findOneStoryBySlug
} from '$lib/db/repositories/2-story-module';
import { Language } from '$lib/db/schemas/0-utils';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
  const clientId = locals.client.id;

  const settings = params.settings?.toLowerCase()?.split('/');
  const setLanguage = (input: string[]): Language | undefined => {
    const values = new Set<string>(Object.values(Language));
    const match = input.find((value) => values.has(value));
    return (match as Language) ?? undefined;
  };
  const language = setLanguage(settings);

  const anthologySlug = params.anthologySlug;

  const anthology = await findOneAnthologyBySlug(clientId, anthologySlug, language);
  if (!anthology)
    error(
      404,
      `The anthology '${anthologySlug}' was not found. It may not exist, or may not be published, yet.`
    );

  const stories: NonNullable<Awaited<ReturnType<typeof findOneStoryBySlug>>>[] = [];
  const playersOfStories: Player[][] = [];

  for (const [storyIndex, { slug: storySlug }] of anthology.stories.entries()) {
    const story = await findOneStoryBySlug(clientId, storySlug, language);
    if (!story)
      error(
        404,
        `The story '${storySlug}' was not found. It may not exist, or may not be published, yet.`
      );

    const players = story?.parts?.map((part, index) => {
      const background =
        part.backgroundType === 'video' && part.background && 'source' in part.background
          ? part.background
          : undefined;
      return {
        id: part.id,
        source: background?.source,
        thumbnail: background?.thumbnail ?? undefined,
        captions: background?.captions ?? undefined,
        start:
          background?.start && background.duration
            ? background.start * background.duration
            : undefined,
        end:
          background?.end && background.duration ? background.end * background.duration : undefined,
        playbackRate: 1,
        isInitialPart: index === 0,
        next: part.defaultNextPartId ?? undefined,
        doBuffer: storyIndex === 0 && index === 0,
        doPlay: false,
        doPause: false,
        doRestart: false,
        doEnd: false,
        time: 0
      };
    });

    stories.push(story);
    playersOfStories.push(players);
  }

  return { anthology, stories, playersOfStories };
};
