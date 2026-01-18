import type { findOneStoryById } from '$lib/db/repositories/2-stories-module';

export const EDITORS: {
  videos: Awaited<ReturnType<typeof findOneStoryById>>['videos'];
  announcements: Awaited<ReturnType<typeof findOneStoryById>>['announcements'];
  quizzes: Awaited<ReturnType<typeof findOneStoryById>>['quizzes'];
}
  = $state({
    videos: [],
    announcements: [],
    quizzes: [],
  });