import type { findOneStoryById } from '$lib/db/repositories/2-stories-module';
import { Language, Orientation } from '$lib/db/schemas/0-utils';

export const EDITORS: {
  videos: Awaited<ReturnType<typeof findOneStoryById>>['videos'];
  announcements: Awaited<ReturnType<typeof findOneStoryById>>['announcements'];
  quizzes: Awaited<ReturnType<typeof findOneStoryById>>['quizzes'];
  language: Language | 'default';
  orientation: Orientation | 'default';
}
  = $state({
    videos: [],
    announcements: [],
    quizzes: [],
    language: 'default',
    orientation: 'default',
  });