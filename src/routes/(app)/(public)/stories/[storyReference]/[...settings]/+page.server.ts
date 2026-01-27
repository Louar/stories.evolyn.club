import { findOneStoryByReference } from '$lib/db/repositories/2-stories-module';
import { Language, Orientation } from '$lib/db/schemas/0-utils';
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

  const story = await findOneStoryByReference(clientId, params.storyReference, orientation, language);

  const players = story?.parts?.map((part, index) => ({
    id: part.id,
    source: part.background?.source,
    thumbnail: part.background?.thumbnail ?? undefined,
    captions: part.background?.captions ?? undefined,
    start: part.background?.start && part.background?.duration ? part?.background?.start * part.background?.duration : undefined,
    end: part.background?.end && part.background?.duration ? part?.background?.end * part.background?.duration : undefined,
    playbackRate: 1, // (part.background?.playbackRate as number) ?? undefined,
    next: part.defaultNextPartId ?? undefined,

    doBuffer: index === 0,
    doPlay: false,
    doRestart: false,
    doEnd: false,
    time: 0,
  }));

  return { story, players, orientation };
});
