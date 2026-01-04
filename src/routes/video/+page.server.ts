import type { PageServerLoad } from './$types';
import { HitPolicy } from './types';

export const load: PageServerLoad = (async () => {

  const story = {
    parts: [
      {
        id: 'play-pause',
        background: {
          type: 'video',
          configuration: {
            source: '/videos/play-pause/stream.m3u8',
            end: 3.000,
            poster: '/videos/play-pause.jpg',
            captions: '',
          },
        },
        foreground: {
          start: 0.5,
          type: 'quiz',
          interactions: [
            {
              widget: 'single-select',
              order: 1,
              description: 'Are you ready?',
              isRequired: true,
              answerOptions: [
                {
                  order: 1,
                  value: JSON.stringify(1),
                  label: 'Yes',
                },
                {
                  order: 2,
                  value: JSON.stringify(0),
                  label: 'No',
                }
              ]
            },
            {
              widget: 'single-select',
              order: 2,
              description: 'Are you sure?',
              isRequired: true,
              answerOptions: [
                {
                  order: 1,
                  value: JSON.stringify('YES'),
                  label: 'Yes',
                },
                {
                  order: 2,
                  value: JSON.stringify('NO'),
                  label: 'No',
                }
              ]
            },
          ],
          logic: {
            hitPolicy: HitPolicy.first,
            inputs: [
              {
                id: 'interaction_1',
                field: 'interaction_1',
                name: 'Are you ready?'
              },
              {
                id: 'interaction_2',
                field: 'interaction_2',
                name: 'Are you sure?'
              }
            ],
            outputs: [
              {
                field: 'next',
                id: 'next',
                name: 'Next part'
              }
            ],
            rules: [
              {
                _id: 'rule_1',
                _description: 'Ready: Yes!',
                interaction_1: JSON.stringify(1),
                interaction_2: JSON.stringify('YES'),
                next: 'countdown',
              },
              {
                _id: 'rule_2',
                _description: 'Default: Not ready',
                next: 'play-pause',
              },
            ]
          }
        }
      },
      {
        id: 'countdown',
        background: {
          type: 'video',
          configuration: {
            source: '/videos/countdown/stream.m3u8',
            start: 5.000,
            poster: '/videos/countdown.jpg',
          },
          next: 'city-Barcelona',
        },
        foreground: {
          start: 0.5,
          type: 'information',
          title: 'Welcome to the quiz!',
          message: 'And good luck!',
        }
      },
      {
        id: 'city-Barcelona',
        background: {
          type: 'video',
          configuration: {
            source: '/videos/city-Barcelona/stream.m3u8',
          },
        },
        foreground: {
          start: 1,
          type: 'quiz',
          interactions: [
            {
              widget: 'single-select',
              order: 1,
              description: 'Which city is this?',
              isRequired: true,
              answerGroup: {
                doRandomize: true,
              },
              answerOptions: [
                {
                  order: 1,
                  value: JSON.stringify('Barcelona'),
                  label: 'Barcelona',
                },
                {
                  order: 2,
                  value: JSON.stringify('Amsterdam'),
                  label: 'Amsterdam',
                },
                {
                  order: 3,
                  value: JSON.stringify('Malaga'),
                  label: 'Malaga',
                },
                {
                  order: 4,
                  value: JSON.stringify('Bari'),
                  label: 'Bari',
                }
              ]
            },
          ],
          logic: {
            hitPolicy: HitPolicy.first,
            inputs: [
              {
                id: 'interaction_1',
                field: 'interaction_1',
                name: 'Which city is this?'
              }
            ],
            outputs: [
              {
                field: 'next',
                id: 'next',
                name: 'Next part'
              }
            ],
            rules: [
              {
                _id: 'rule_1',
                _description: 'Correct!',
                interaction_1: JSON.stringify('Barcelona'),
                next: 'city-Barcelona-thumbs-up',
              },
              {
                _id: 'rule_2',
                _description: 'Default: Wrong',
                next: 'city-Barcelona-thumbs-down',
              },
            ]
          }
        }
      },
      {
        id: 'city-Barcelona-thumbs-down',
        background: {
          type: 'video',
          configuration: {
            source: '/videos/thumbs-down/stream.m3u8',
            end: 3.000,
          },
          next: 'city-Barcelona',
        },
      },
      {
        id: 'city-Barcelona-thumbs-up',
        background: {
          type: 'video',
          configuration: {
            source: '/videos/thumbs-up/stream.m3u8',
            end: 3.000,
          },
          next: 'city-Luzern',
        },
      },
      {
        id: 'city-Luzern',
        background: {
          type: 'video',
          configuration: {
            source: '/videos/city-Luzern/stream.m3u8',
          },
        },
        foreground: {
          start: 1,
          type: 'quiz',
          interactions: [
            {
              widget: 'single-select',
              order: 1,
              description: 'Which city is this?',
              isRequired: true,
              answerGroup: {
                doRandomize: true,
              },
              answerOptions: [
                {
                  order: 1,
                  value: JSON.stringify('Luzern'),
                  label: 'Luzern',
                },
                {
                  order: 2,
                  value: JSON.stringify('Munich'),
                  label: 'Munich',
                },
                {
                  order: 3,
                  value: JSON.stringify('Berlin'),
                  label: 'Berlin',
                },
                {
                  order: 4,
                  value: JSON.stringify('Zurich'),
                  label: 'Zurich',
                }
              ]
            },
          ],
          logic: {
            hitPolicy: HitPolicy.first,
            inputs: [
              {
                id: 'interaction_1',
                field: 'interaction_1',
                name: 'Which city is this?'
              }
            ],
            outputs: [
              {
                field: 'next',
                id: 'next',
                name: 'Next part'
              }
            ],
            rules: [
              {
                _id: 'rule_1',
                _description: 'Correct!',
                interaction_1: JSON.stringify('Luzern'),
                next: 'city-Luzern-thumbs-up',
              },
              {
                _id: 'rule_2',
                _description: 'Default: Wrong',
                next: 'city-Luzern-thumbs-down',
              },
            ]
          }
        }
      },
      {
        id: 'city-Luzern-thumbs-down',
        background: {
          type: 'video',
          configuration: {
            source: '/videos/thumbs-down/stream.m3u8',
            end: 3.000,
            playbackRate: 2,
          },
          next: 'city-Luzern',
        },
      },
      {
        id: 'city-Luzern-thumbs-up',
        background: {
          type: 'video',
          configuration: {
            source: '/videos/thumbs-up/stream.m3u8',
            end: 3.000,
          },
          next: 'game-over',
        },
      },
      {
        id: 'game-over',
        background: {
          type: 'video',
          configuration: {
            source: '/videos/game-over/stream.m3u8',
          },
        },
        foreground: {
          start: 0.5,
          type: 'quiz',
          interactions: [
            {
              widget: 'single-select',
              order: 1,
              isRequired: true,
              answerOptions: [
                {
                  order: 1,
                  value: JSON.stringify(true),
                  label: 'Start over',
                },
              ]
            },
          ],
          logic: {
            hitPolicy: HitPolicy.first,
            inputs: [
              {
                id: 'interaction_1',
                field: 'interaction_1',
                name: 'Start over?'
              }
            ],
            outputs: [
              {
                field: 'next',
                id: 'next',
                name: 'Next part'
              }
            ],
            rules: [
              {
                _id: 'rule_1',
                _description: 'Start over',
                interaction_1: JSON.stringify(true),
                next: 'play-pause',
              },
            ]
          }
        }
      },
    ]
  };

  const players = story?.parts?.map((part, index) => ({
    id: part.id,
    source: part?.background?.configuration?.source,
    poster: part?.background?.configuration?.poster ?? undefined,
    captions: part?.background?.configuration?.captions ?? undefined,
    start: part?.background?.configuration?.start ?? undefined,
    end: part?.background?.configuration?.end ?? undefined,
    playbackRate: part?.background?.configuration?.playbackRate ?? undefined,
    next: part?.background?.next ?? undefined,

    doBuffer: index === 0,
    doPlay: false,
    doRestart: false,
    watchPercentage: 0,
  }));

  return { story, players };
});
