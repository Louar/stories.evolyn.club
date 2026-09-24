import { Language } from '$lib/db/schemas/0-utils.js';
import type { Viewport } from '@xyflow/svelte';
import type { EditorSelection } from './ResourceInspector.svelte';

export const STORY_FLOW_PREFERENCES_VERSION = 1;

export type StoryFlowPreferences = {
	version: typeof STORY_FLOW_PREFERENCES_VERSION;
	mainTab: 'settings' | 'backgrounds' | 'foregrounds';
	backgroundTab: 'stills' | 'videos';
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
	if (!['still', 'video', 'announcement', 'quiz'].includes(value.kind)) return undefined;
	if (value.id !== undefined && typeof value.id !== 'string') return undefined;
	return { kind: value.kind, id: value.id } as EditorSelection;
};

export const getStoryFlowPreferencesKey = (storyId: string) =>
	`story-flow:${encodeURIComponent(storyId)}`;

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
	if (!isOneOf(value.backgroundTab, ['stills', 'videos'])) return undefined;
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
