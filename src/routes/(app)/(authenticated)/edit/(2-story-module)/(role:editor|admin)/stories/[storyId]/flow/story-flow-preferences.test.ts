import { describe, expect, it } from 'vitest';
import { Language } from '$lib/db/schemas/0-utils.js';
import {
	getStoryFlowPreferencesKey,
	parseStoryFlowPreferences,
	STORY_FLOW_PREFERENCES_VERSION,
	type StoryFlowPreferences
} from './story-flow-preferences.js';

describe('story flow preferences', () => {
	const preferences: StoryFlowPreferences = {
		version: STORY_FLOW_PREFERENCES_VERSION,
		mainTab: 'backgrounds',
		backgroundTab: 'videos',
		foregroundTab: 'quizzes',
		sidebarOpen: false,
		inspectorOpen: true,
		editorSelection: { kind: 'video', id: 'video-1' },
		selectedPartId: 'part-1',
		partScrollPositions: { 'part-1': 240 },
		viewport: { x: 20, y: -10, zoom: 0.75 },
		language: Language.Nederlands
	};

	it('round-trips a valid payload', () => {
		expect(parseStoryFlowPreferences(JSON.stringify(preferences))).toEqual(preferences);
	});

	it('rejects malformed and unsupported payloads', () => {
		expect(parseStoryFlowPreferences('{')).toBeUndefined();
		expect(
			parseStoryFlowPreferences(JSON.stringify({ ...preferences, version: 2 }))
		).toBeUndefined();
		expect(
			parseStoryFlowPreferences(JSON.stringify({ ...preferences, mainTab: 'unknown' }))
		).toBeUndefined();
		expect(
			parseStoryFlowPreferences(
				JSON.stringify({ ...preferences, viewport: { x: 0, y: 0, zoom: 2 } })
			)
		).toEqual({ ...preferences, viewport: undefined });
	});

	it('drops invalid scroll positions without rejecting other preferences', () => {
		expect(
			parseStoryFlowPreferences(
				JSON.stringify({
					...preferences,
					partScrollPositions: { valid: 12, negative: -1, invalid: '12' }
				})
			)?.partScrollPositions
		).toEqual({ valid: 12 });
	});

	it('uses a story-specific encoded key', () => {
		expect(getStoryFlowPreferencesKey('story/one')).toBe('story-flow:story%2Fone');
	});
});
