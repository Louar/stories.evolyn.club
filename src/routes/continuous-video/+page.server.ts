import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (async () => {

  const story = {
    parts: [
      {
        id: '111',
        order: 1,
        background: {
          type: 'video',
          duration: 3.000,
          configuration: {
            source: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
            start: 3.000,
            end: 6.000,
            poster: 'https://files.vidstack.io/sprite-fight/poster.webp',
            captions: '',
          },
          next: '222',
        },
      },
      {
        id: '222',
        order: 2,
        background: {
          type: 'video',
          duration: 11.000,
          configuration: {
            source: 'https://files.vidstack.io/sprite-fight/hls/stream.m3u8',
            start: 3.000,
            end: 14.000,
            // poster: 'https://files.vidstack.io/sprite-fight/poster.webp',
            captions: '',
          },
          next: '333',
        },
        foreground: {
          start: 0.2,
          questions: [
            {
              widget: 'radio',
              order: 1,
              description: '',
              isRequired: true,
            },
          ],
          actions: [
            {
              next: '111',
            },
          ],
        }
      },
      {
        id: '333',
        order: 1,
        background: {
          type: 'video',
          duration: 11.000,
          configuration: {
            source: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
            start: 3.000,
            end: 14.000,
            // poster: 'https://files.vidstack.io/sprite-fight/poster.webp',
            captions: '',
          },
          next: '222',
        },
      },
    ]
  };

  const players = story?.parts?.map((part, index) => ({
    id: part.id,
    source: part?.background?.configuration?.source,
    poster: part?.background?.configuration?.poster ?? null,
    captions: part?.background?.configuration?.captions ?? null,
    start: part?.background?.configuration?.start ?? null,
    end: part?.background?.configuration?.end ?? null,
    next: part?.background?.next ?? null,

    doBuffer: index === 0,
    doPlay: false,
    watchPercentage: 0,
  }));

  return { story, players };
});
