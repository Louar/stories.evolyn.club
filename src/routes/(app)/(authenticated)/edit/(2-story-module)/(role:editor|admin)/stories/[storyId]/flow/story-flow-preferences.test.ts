import { describe, expect, it } from 'vitest';
import { Language } from '$lib/db/schemas/0-utils.js';
import {
	getStoryFlowPreferencesKey,
	parseStoryFlowPreferences,
	persistStoryFlowPreferences,
	STORY_FLOW_PREFERENCES_LIMIT,
	STORY_FLOW_PREFERENCES_VERSION,
	STORY_FLOW_RECENT_KEY,
	type StoryFlowPreferences
} from './story-flow-preferences.js';

describe('story flow preferences', () => {
	class MemoryStorage {
		#values = new Map<string, string>();
		get length() {
			return this.#values.size;
		}
		key(index: number) {
			return [...this.#values.keys()][index] ?? null;
		}
		getItem(key: string) {
			return this.#values.get(key) ?? null;
		}
		setItem(key: string, value: string) {
			this.#values.set(key, value);
		}
		removeItem(key: string) {
			this.#values.delete(key);
		}
	}

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

	it('retains only the 25 most recently persisted stories', () => {
		const storage = new MemoryStorage();
		for (let index = 0; index <= STORY_FLOW_PREFERENCES_LIMIT; index++)
			persistStoryFlowPreferences(storage, `story-${index}`, JSON.stringify({ index }));

		expect(storage.getItem(getStoryFlowPreferencesKey('story-0'))).toBeNull();
		expect(storage.getItem(getStoryFlowPreferencesKey('story-25'))).not.toBeNull();
		expect(JSON.parse(storage.getItem(STORY_FLOW_RECENT_KEY) ?? '[]')).toHaveLength(25);
	});

	it('moves an updated story to the front of the recent index', () => {
		const storage = new MemoryStorage();
		persistStoryFlowPreferences(storage, 'one', '{}');
		persistStoryFlowPreferences(storage, 'two', '{}');
		persistStoryFlowPreferences(storage, 'one', '{"updated":true}');

		expect(JSON.parse(storage.getItem(STORY_FLOW_RECENT_KEY) ?? '[]')).toEqual(['one', 'two']);
	});

	it('brings pre-index records under the retention limit', () => {
		const storage = new MemoryStorage();
		for (let index = 0; index < 30; index++)
			storage.setItem(getStoryFlowPreferencesKey(`legacy-${index}`), '{}');

		persistStoryFlowPreferences(storage, 'current', '{}');

		const retained = JSON.parse(storage.getItem(STORY_FLOW_RECENT_KEY) ?? '[]') as string[];
		expect(retained).toHaveLength(25);
		expect(retained[0]).toBe('current');
		expect(storage.length).toBe(26);
	});
});
