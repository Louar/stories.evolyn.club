import { describe, expect, it } from 'vitest';
import type { DataGridPreferences } from './data-grid-preferences.js';
import {
	createDataGridPersistenceIdentity,
	DATA_GRID_PREFERENCES_VERSION,
	decodeDataGridPreferences,
	getAppliedDataGridPreferenceState,
	getDataGridPreferencesContentSnapshot,
	getDataGridPreferencesKey,
	parseDataGridPreferences,
	reconcileDataGridPreferences
} from './data-grid-preferences.js';
import { getCellKey, parseCellKey } from './types/data-grid.js';

describe('data grid cell keys', () => {
	it('round-trips row and column ids containing delimiters', () => {
		const key = getCellKey('tenant:row[1]', 'details:name:value');
		expect(parseCellKey(key)).toEqual({
			rowId: 'tenant:row[1]',
			rowIndex: 0,
			columnId: 'details:name:value'
		});
	});
});

describe('data grid preferences', () => {
	const persisted: DataGridPreferences = {
		version: DATA_GRID_PREFERENCES_VERSION,
		updatedAt: 123,
		sorting: [
			{ id: 'name', desc: false },
			{ id: 'removed', desc: true }
		],
		columnFilters: [{ id: 'removed', value: 'x' }],
		columnVisibility: { name: true, removed: false },
		columnPinning: { left: ['name', 'removed'], right: [] },
		columnSizing: { name: 200, removed: 100 },
		columnOrder: ['removed', 'name'],
		rowHeight: 'medium'
	};

	it('rejects malformed and differently-versioned payloads', () => {
		expect(parseDataGridPreferences('{')).toBeNull();
		expect(parseDataGridPreferences(JSON.stringify({ ...persisted, version: 3 }))).toBeNull();
		expect(parseDataGridPreferences(JSON.stringify({ ...persisted, rowHeight: 'huge' }))).toEqual({
			...persisted,
			rowHeight: undefined
		});
	});

	it('migrates records sequentially and distinguishes future records', () => {
		const legacy = { ...persisted, version: 1 };
		delete (legacy as Partial<typeof persisted>).updatedAt;
		expect(parseDataGridPreferences(JSON.stringify(legacy))).toMatchObject({
			version: DATA_GRID_PREFERENCES_VERSION,
			updatedAt: 0
		});
		expect(decodeDataGridPreferences(JSON.stringify({ ...persisted, version: 99 })).status).toBe(
			'future'
		);
		expect(decodeDataGridPreferences('{').status).toBe('malformed');
	});

	it('keeps valid slices when another slice is malformed', () => {
		expect(
			parseDataGridPreferences(JSON.stringify({ ...persisted, columnSizing: { name: 'wide' } }))
		).toEqual({ ...persisted, columnSizing: undefined });
	});

	it('keeps the storage namespace stable across payload versions', () => {
		const identity = { tenantId: 'a', userId: 'b', gridId: 'c' };
		expect(getDataGridPreferencesKey(identity)).toBe('data-grid:a:b:c');
	});

	it('compares preference content independently from updatedAt', () => {
		expect(getDataGridPreferencesContentSnapshot(persisted)).toBe(
			getDataGridPreferencesContentSnapshot({ ...persisted, updatedAt: 999 })
		);
	});

	it('derives an atomic applied snapshot and timestamp', () => {
		expect(getAppliedDataGridPreferenceState(persisted)).toEqual({
			snapshot: getDataGridPreferencesContentSnapshot(persisted),
			updatedAt: 123
		});
		expect(getAppliedDataGridPreferenceState(null)).toEqual({ snapshot: null, updatedAt: 0 });
	});

	it('derives persistence identity from inherited authenticated layout data', () => {
		expect(
			createDataGridPersistenceIdentity('edit.pages', () => ({
				client: { id: 'tenant' },
				authusr: { id: 'user' }
			}))
		).toEqual({ gridId: 'edit.pages', tenantId: 'tenant', userId: 'user' });
	});

	it('requires authenticated layout data for persistence', () => {
		expect(() =>
			createDataGridPersistenceIdentity('edit.pages', () => ({
				client: { id: 'tenant' }
			}))
		).toThrow('Authenticated user is required');
	});

	it('reconciles persisted columns with the current definitions', () => {
		const parsed = parseDataGridPreferences(JSON.stringify(persisted));
		expect(parsed).not.toBeNull();
		expect(reconcileDataGridPreferences(parsed!, ['name'])).toEqual({
			...persisted,
			sorting: [{ id: 'name', desc: false }],
			columnFilters: [],
			columnVisibility: { name: true },
			columnPinning: { left: ['name'], right: [] },
			columnSizing: { name: 200 },
			columnOrder: ['name']
		});
	});

	it('reconciles capabilities and clamps restored widths', () => {
		const parsed = parseDataGridPreferences(JSON.stringify(persisted))!;
		expect(
			reconcileDataGridPreferences(parsed, [
				{ id: 'name', canSort: false, canHide: false, minSize: 80, maxSize: 120 }
			])
		).toMatchObject({ sorting: [], columnVisibility: {}, columnSizing: { name: 120 } });
	});
});
