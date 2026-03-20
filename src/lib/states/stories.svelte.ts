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
    question: string | null;
    answer: unknown;
  };

export const STORIES: {
  averageWatchTimePercentages: Record<string, number>;
  events: Record<string, StoryEvent[]>;
}
  = $state({
    averageWatchTimePercentages: {},
    events: {},
  });
