import type {
	ColumnFiltersState,
	ColumnOrderState,
	ColumnPinningState,
	ColumnSizingState,
	SortingState,
	VisibilityState
} from '@tanstack/table-core';
import { ROW_HEIGHTS, type DataGridRowHeight } from './config/data-grid.js';

export const DATA_GRID_PREFERENCES_VERSION = 2;

export interface DataGridPersistenceSlices {
	sorting?: boolean;
	filters?: boolean;
	visibility?: boolean;
	pinning?: boolean;
	sizing?: boolean;
	rowHeight?: boolean;
	columnOrder?: boolean;
}

export const DEFAULT_DATA_GRID_PERSISTENCE_SLICES = {
	sorting: true,
	filters: true,
	visibility: true,
	pinning: true,
	sizing: true,
	rowHeight: true,
	columnOrder: true
} satisfies Required<DataGridPersistenceSlices>;

export interface DataGridPreferences {
	version: typeof DATA_GRID_PREFERENCES_VERSION;
	updatedAt: number;
	sorting?: SortingState;
	columnFilters?: ColumnFiltersState;
	columnVisibility?: VisibilityState;
	columnPinning?: ColumnPinningState;
	columnSizing?: ColumnSizingState;
	columnOrder?: ColumnOrderState;
	rowHeight?: DataGridRowHeight;
}

export interface DataGridPersistenceIdentity {
	gridId: string;
	tenantId: string;
	userId: string;
}

export function createDataGridPersistenceIdentity(
	gridId: string,
	getData: () => { client: { id: string }; authusr?: { id: string } | null }
): DataGridPersistenceIdentity {
	const data = getData();
	if (!data.authusr) throw new Error('Authenticated user is required for data grid persistence');
	return { gridId, tenantId: data.client.id, userId: data.authusr.id };
}

export interface DataGridColumnPreferenceCapability {
	id: string;
	canSort?: boolean;
	canFilter?: boolean;
	canHide?: boolean;
	minSize?: number;
	maxSize?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isColumnId = (value: unknown): value is string =>
	typeof value === 'string' && value.length > 0;

export function getDataGridPreferencesKey(identity: DataGridPersistenceIdentity): string {
	return ['data-grid', identity.tenantId, identity.userId, identity.gridId]
		.map(encodeURIComponent)
		.join(':');
}

export function parseDataGridPreferences(value: string | null): DataGridPreferences | null {
	return decodeDataGridPreferences(value).preferences;
}

export type DataGridPreferencesDecodeResult = {
	status: 'empty' | 'valid' | 'malformed' | 'future';
	preferences: DataGridPreferences | null;
};

export function decodeDataGridPreferences(value: string | null): DataGridPreferencesDecodeResult {
	if (!value) return { status: 'empty', preferences: null };
	try {
		const parsed = JSON.parse(value) as unknown;
		if (!isRecord(parsed) || typeof parsed.version !== 'number')
			return { status: 'malformed', preferences: null };
		if (parsed.version > DATA_GRID_PREFERENCES_VERSION)
			return { status: 'future', preferences: null };
		if (parsed.version < 1) return { status: 'malformed', preferences: null };

		// Migrations are intentionally sequential so each historical version has one upgrade step.
		let migrated = parsed;
		if (migrated.version === 1) migrated = { ...migrated, version: 2, updatedAt: 0 };
		if (
			migrated.version !== DATA_GRID_PREFERENCES_VERSION ||
			typeof migrated.updatedAt !== 'number' ||
			!Number.isFinite(migrated.updatedAt)
		)
			return { status: 'malformed', preferences: null };

		const preferences: DataGridPreferences = {
			version: DATA_GRID_PREFERENCES_VERSION,
			updatedAt: migrated.updatedAt
		};
		if (
			Array.isArray(migrated.sorting) &&
			migrated.sorting.every(
				(item) => isRecord(item) && isColumnId(item.id) && typeof item.desc === 'boolean'
			)
		)
			preferences.sorting = migrated.sorting as SortingState;
		if (
			Array.isArray(migrated.columnFilters) &&
			migrated.columnFilters.every(
				(item) => isRecord(item) && isColumnId(item.id) && 'value' in item
			)
		)
			preferences.columnFilters = migrated.columnFilters as ColumnFiltersState;
		if (
			isRecord(migrated.columnVisibility) &&
			Object.values(migrated.columnVisibility).every((item) => typeof item === 'boolean')
		)
			preferences.columnVisibility = migrated.columnVisibility as VisibilityState;
		if (
			isRecord(migrated.columnPinning) &&
			Object.values(migrated.columnPinning).every(
				(item) => item === undefined || (Array.isArray(item) && item.every(isColumnId))
			)
		)
			preferences.columnPinning = migrated.columnPinning as ColumnPinningState;
		if (
			isRecord(migrated.columnSizing) &&
			Object.values(migrated.columnSizing).every(
				(item) => typeof item === 'number' && Number.isFinite(item) && item >= 0
			)
		)
			preferences.columnSizing = migrated.columnSizing as ColumnSizingState;
		if (Array.isArray(migrated.columnOrder) && migrated.columnOrder.every(isColumnId)) {
			preferences.columnOrder = migrated.columnOrder;
		}
		if (isColumnId(migrated.rowHeight) && migrated.rowHeight in ROW_HEIGHTS) {
			preferences.rowHeight = migrated.rowHeight as DataGridRowHeight;
		}
		return { status: 'valid', preferences };
	} catch {
		return { status: 'malformed', preferences: null };
	}
}

export function serializeDataGridPreferencesSnapshot(
	preferences: Omit<DataGridPreferences, 'updatedAt'>
): string {
	return JSON.stringify(preferences);
}

export function getDataGridPreferencesContentSnapshot(preferences: DataGridPreferences): string {
	const { updatedAt, ...content } = preferences;
	void updatedAt;
	return serializeDataGridPreferencesSnapshot(content);
}

export function getAppliedDataGridPreferenceState(preferences: DataGridPreferences | null): {
	snapshot: string | null;
	updatedAt: number;
} {
	return preferences
		? {
				snapshot: getDataGridPreferencesContentSnapshot(preferences),
				updatedAt: preferences.updatedAt
			}
		: { snapshot: null, updatedAt: 0 };
}

export function reconcileDataGridPreferences(
	preferences: DataGridPreferences,
	columns: readonly (string | DataGridColumnPreferenceCapability)[]
): DataGridPreferences {
	const capabilities = new Map(
		columns.map((column) => [typeof column === 'string' ? column : column.id, column] as const)
	);
	const current = new Set(capabilities.keys());
	const filterRecord = <T>(record: Record<string, T>): Record<string, T> =>
		Object.fromEntries(Object.entries(record).filter(([id]) => current.has(id)));
	const uniqueCurrent = (ids: string[] | undefined) =>
		Array.from(new Set(ids?.filter((id) => current.has(id)) ?? []));
	const left = uniqueCurrent(preferences.columnPinning?.left);
	const leftIds = new Set(left);
	const sizing = filterRecord(preferences.columnSizing ?? {});
	for (const [id, size] of Object.entries(sizing)) {
		const capability = capabilities.get(id);
		if (typeof capability === 'string') continue;
		sizing[id] = Math.min(
			capability?.maxSize ?? Infinity,
			Math.max(capability?.minSize ?? 0, size)
		);
	}
	return {
		...preferences,
		sorting: preferences.sorting?.filter((item) => {
			const capability = capabilities.get(item.id);
			return (
				current.has(item.id) && (typeof capability === 'string' || capability?.canSort !== false)
			);
		}),
		columnFilters: preferences.columnFilters?.filter((item) => {
			const capability = capabilities.get(item.id);
			return (
				current.has(item.id) && (typeof capability === 'string' || capability?.canFilter !== false)
			);
		}),
		columnVisibility: Object.fromEntries(
			Object.entries(filterRecord(preferences.columnVisibility ?? {})).filter(([id]) => {
				const capability = capabilities.get(id);
				return typeof capability === 'string' || capability?.canHide !== false;
			})
		),
		columnPinning: {
			left,
			right: uniqueCurrent(preferences.columnPinning?.right).filter((id) => !leftIds.has(id))
		},
		columnSizing: sizing,
		columnOrder: uniqueCurrent(preferences.columnOrder)
	};
}
