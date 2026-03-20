import type { findOneStoryByReference } from '$lib/db/repositories/2-stories-module';
import { STORIES } from '$lib/states/stories.svelte';

type StoryEvent =
  | {
    type: 'transition';
    createdAt: string;
    fromPartId: string;
    toPartId: string;
  }
  | {
    type: 'interaction';
    createdAt: string;
    partId: string;
    quizQuestionTemplateId: string;
    quizQuestionTemplateAnswerItemId: string | null;
    value: Record<string, unknown> | null;
  };

const MAX_ATTEMPTS = 3;

let session: string | null = null;

const isBrowser = typeof window !== 'undefined';

const createSessionId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

const sendEvent = async (storyId: string, event: StoryEvent) => {
  if (!isBrowser || !session || !storyId) return;

  const body = JSON.stringify({
    url: window.location.href,
    session,
    event
  });

  const endpoint = `/api/stories/${storyId}/events`;

  for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body
      });

      if (response.ok) return;
    } catch {
      // swallow and retry
    }
  }

  console.warn('[player-events] request failed after retries', {
    type: event.type,
    attempts: MAX_ATTEMPTS
  });
};

export const initPlayerEvents = (storyId: string) => {
  if (!isBrowser || !storyId) return;
  session = createSessionId();
};

export const logTransitionEvent = (
  storyId: string,
  fromPartId: string,
  toPartId: string
) => {
  if (!storyId || !fromPartId || !toPartId) return;

  const event = {
    type: 'transition',
    createdAt: new Date().toISOString(),
    fromPartId,
    toPartId
  } as const;

  if (!STORIES.events[storyId]) STORIES.events[storyId] = [];
  STORIES.events[storyId].push(event);

  void sendEvent(storyId, event);
};

export const logInteractionEvent = (
  storyId: string,
  args: {
    partId: string;
    quizQuestionTemplate: Extract<
      NonNullable<
        Awaited<ReturnType<typeof findOneStoryByReference>>
      >['parts'][number]['foreground'],
      { questions: unknown }
    >['questions'][number];
    quizQuestionTemplateAnswerItemId: string | null;
    value: unknown;
    raw_value: unknown;
  }
) => {
  const { partId, quizQuestionTemplate, quizQuestionTemplateAnswerItemId, value, raw_value } = args;
  if (!storyId || !partId || !quizQuestionTemplate?.id) return;

  const type = 'interaction';
  const createdAt = new Date().toISOString();

  if (!STORIES.events[storyId]) STORIES.events[storyId] = [];
  STORIES.events[storyId].push({
    type,
    createdAt,
    partId,
    question: quizQuestionTemplate.title,
    answer: raw_value,
  });

  void sendEvent(storyId, {
    type,
    createdAt,
    partId,
    quizQuestionTemplateId: quizQuestionTemplate.id,
    quizQuestionTemplateAnswerItemId,
    value: value as Record<string, unknown> | null
  });
};
