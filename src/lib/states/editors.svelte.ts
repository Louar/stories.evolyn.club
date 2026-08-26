import type { findOneStoryById } from '$lib/db/repositories/2-story-module';

export const EDITORS: {
  videos: Awaited<ReturnType<typeof findOneStoryById>>['videos'];
  stills: Awaited<ReturnType<typeof findOneStoryById>>['stills'];
  announcements: Awaited<ReturnType<typeof findOneStoryById>>['announcements'];
  quizzes: Awaited<ReturnType<typeof findOneStoryById>>['quizzes'];
  taxonomies: Awaited<ReturnType<typeof findOneStoryById>>['taxonomies'];
} = $state({
  videos: [],
  stills: [],
  announcements: [],
  quizzes: [],
  taxonomies: []
});
