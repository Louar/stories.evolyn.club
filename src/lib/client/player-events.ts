type PlayerEvent =
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

let runtimeSessionId: string | null = null;

const isBrowser = typeof window !== 'undefined';

const createSessionId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

const toRecordValue = (value: unknown): Record<string, unknown> | null => {
  if (value == null) return null;
  return typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : { value };
};

const sendEvent = async (storyId: string, event: PlayerEvent) => {
  if (!isBrowser || !runtimeSessionId || !storyId) return;

  const body = JSON.stringify({
    url: window.location.href,
    session: runtimeSessionId,
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
  runtimeSessionId = createSessionId();
};

export const logTransitionEvent = (
  storyId: string,
  fromPartId: string,
  toPartId: string
) => {
  if (!storyId || !fromPartId || !toPartId) return;

  void sendEvent(storyId, {
    type: 'transition',
    createdAt: new Date().toISOString(),
    fromPartId,
    toPartId
  });
};

export const logInteractionEvent = (
  storyId: string,
  args: {
    partId: string;
    quizQuestionTemplateId: string;
    quizQuestionTemplateAnswerItemId: string | null;
    value: unknown;
  }
) => {
  if (!storyId || !args.partId || !args.quizQuestionTemplateId) return;

  void sendEvent(storyId, {
    type: 'interaction',
    createdAt: new Date().toISOString(),
    partId: args.partId,
    quizQuestionTemplateId: args.quizQuestionTemplateId,
    quizQuestionTemplateAnswerItemId: args.quizQuestionTemplateAnswerItemId,
    value: toRecordValue(args.value)
  });
};
