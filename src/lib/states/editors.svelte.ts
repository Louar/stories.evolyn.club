import type { findOneStoryById } from '$lib/db/repositories/2-story-module';

export const EDITORS: {
	videos: Awaited<ReturnType<typeof findOneStoryById>>['videos'];
	stills: Awaited<ReturnType<typeof findOneStoryById>>['stills'];
	animations: Awaited<ReturnType<typeof findOneStoryById>>['animations'];
	announcements: Awaited<ReturnType<typeof findOneStoryById>>['announcements'];
	quizzes: Awaited<ReturnType<typeof findOneStoryById>>['quizzes'];
	taxonomies: Awaited<ReturnType<typeof findOneStoryById>>['taxonomies'];
} = $state({
	videos: [],
	stills: [],
	animations: [],
	announcements: [],
	quizzes: [],
	taxonomies: []
});
