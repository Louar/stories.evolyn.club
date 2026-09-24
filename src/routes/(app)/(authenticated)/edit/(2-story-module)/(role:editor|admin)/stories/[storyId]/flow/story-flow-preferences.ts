import { Language } from '$lib/db/schemas/0-utils.js';
import type { Viewport } from '@xyflow/svelte';
import type { EditorSelection } from './ResourceInspector.svelte';

export const STORY_FLOW_PREFERENCES_VERSION = 1;
export const STORY_FLOW_PREFERENCES_LIMIT = 25;
export const STORY_FLOW_RECENT_KEY = 'story-flow:recent';
const STORY_FLOW_KEY_PREFIX = 'story-flow:';

type StoryFlowStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

export type StoryFlowPreferences = {
	version: typeof STORY_FLOW_PREFERENCES_VERSION;
	mainTab: 'settings' | 'backgrounds' | 'foregrounds';
	backgroundTab: 'stills' | 'videos' | 'animations';
	foregroundTab: 'announcements' | 'quizzes' | 'taxonomies';
	sidebarOpen: boolean;
	inspectorOpen: boolean;
	editorSelection: EditorSelection;
	selectedPartId?: string;
	partScrollPositions: Record<string, number>;
	viewport?: Viewport;
	language: Language | 'default';
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isOneOf = <T extends string>(value: unknown, values: readonly T[]): value is T =>
	typeof value === 'string' && values.includes(value as T);

const parseSelection = (value: unknown): EditorSelection | undefined => {
	if (value === null) return null;
	if (!isRecord(value) || typeof value.kind !== 'string') return undefined;
	if (value.kind === 'video-library') return { kind: value.kind };
	if (value.kind === 'taxonomy')
		return typeof value.partId === 'string'
			? { kind: value.kind, partId: value.partId }
			: undefined;
	if (!['still', 'video', 'animation', 'announcement', 'quiz'].includes(value.kind))
		return undefined;
	if (value.id !== undefined && typeof value.id !== 'string') return undefined;
	return { kind: value.kind, id: value.id } as EditorSelection;
};

export const getStoryFlowPreferencesKey = (storyId: string) =>
	`${STORY_FLOW_KEY_PREFIX}${encodeURIComponent(storyId)}`;

const getStoredStoryIds = (storage: StoryFlowStorage) => {
	const storyIds: string[] = [];
	for (let index = 0; index < storage.length; index++) {
		const key = storage.key(index);
		if (!key?.startsWith(STORY_FLOW_KEY_PREFIX) || key === STORY_FLOW_RECENT_KEY) continue;
		try {
			storyIds.push(decodeURIComponent(key.slice(STORY_FLOW_KEY_PREFIX.length)));
		} catch {
			// Ignore keys that do not use the story flow key format.
		}
	}
	return storyIds;
};

const getRecentStoryIds = (storage: StoryFlowStorage) => {
	try {
		const value: unknown = JSON.parse(storage.getItem(STORY_FLOW_RECENT_KEY) ?? '[]');
		return Array.isArray(value) && value.every((storyId) => typeof storyId === 'string')
			? [...new Set(value)]
			: [];
	} catch {
		return [];
	}
};

export const persistStoryFlowPreferences = (
	storage: StoryFlowStorage,
	storyId: string,
	serializedPreferences: string
) => {
	storage.setItem(getStoryFlowPreferencesKey(storyId), serializedPreferences);

	const indexedStoryIds = getRecentStoryIds(storage);
	const indexedSet = new Set(indexedStoryIds);
	const unindexedStoryIds = getStoredStoryIds(storage).filter(
		(storedStoryId) => storedStoryId !== storyId && !indexedSet.has(storedStoryId)
	);
	const storyIds = [
		storyId,
		...indexedStoryIds.filter((storedStoryId) => storedStoryId !== storyId),
		...unindexedStoryIds.reverse()
	];
	const retainedStoryIds = storyIds.slice(0, STORY_FLOW_PREFERENCES_LIMIT);
	for (const removedStoryId of storyIds.slice(STORY_FLOW_PREFERENCES_LIMIT))
		storage.removeItem(getStoryFlowPreferencesKey(removedStoryId));
	storage.setItem(STORY_FLOW_RECENT_KEY, JSON.stringify(retainedStoryIds));
};

export const parseStoryFlowPreferences = (raw: string): StoryFlowPreferences | undefined => {
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		return undefined;
	}
	if (!isRecord(value) || value.version !== STORY_FLOW_PREFERENCES_VERSION) return undefined;

	const editorSelection = parseSelection(value.editorSelection);
	if (editorSelection === undefined) return undefined;
	if (!isOneOf(value.mainTab, ['settings', 'backgrounds', 'foregrounds'])) return undefined;
	if (!isOneOf(value.backgroundTab, ['stills', 'videos', 'animations'])) return undefined;
	if (!isOneOf(value.foregroundTab, ['announcements', 'quizzes', 'taxonomies'])) return undefined;
	if (typeof value.sidebarOpen !== 'boolean' || typeof value.inspectorOpen !== 'boolean')
		return undefined;
	if (value.selectedPartId !== undefined && typeof value.selectedPartId !== 'string')
		return undefined;
	if (!isRecord(value.partScrollPositions)) return undefined;
	const partScrollPositions = Object.fromEntries(
		Object.entries(value.partScrollPositions).filter(
			(entry): entry is [string, number] =>
				typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] >= 0
		)
	);

	let viewport: Viewport | undefined;
	if (isRecord(value.viewport)) {
		const { x, y, zoom } = value.viewport;
		if (
			typeof x === 'number' &&
			Number.isFinite(x) &&
			typeof y === 'number' &&
			Number.isFinite(y) &&
			typeof zoom === 'number' &&
			Number.isFinite(zoom) &&
			zoom >= 0.25 &&
			zoom <= 1
		)
			viewport = { x, y, zoom };
	}

	if (!isOneOf(value.language, ['default', ...Object.values(Language)])) return undefined;

	return {
		version: STORY_FLOW_PREFERENCES_VERSION,
		mainTab: value.mainTab,
		backgroundTab: value.backgroundTab,
		foregroundTab: value.foregroundTab,
		sidebarOpen: value.sidebarOpen,
		inspectorOpen: value.inspectorOpen,
		editorSelection,
		selectedPartId: value.selectedPartId,
		partScrollPositions,
		viewport,
		language: value.language
	};
};
