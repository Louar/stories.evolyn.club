import type { findOneStoryById } from '$lib/db/repositories/2-stories-module';
import { Language } from '$lib/db/schemas/0-utils';

export const EDITORS: {
  videos: Awaited<ReturnType<typeof findOneStoryById>>['videos'];
  announcements: Awaited<ReturnType<typeof findOneStoryById>>['announcements'];
  quizzes: Awaited<ReturnType<typeof findOneStoryById>>['quizzes'];
  language: Language | 'default';
}
  = $state({
    videos: [],
    announcements: [],
    quizzes: [],
    language: 'default'
  });