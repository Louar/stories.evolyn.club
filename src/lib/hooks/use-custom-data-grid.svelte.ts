/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * useDataGrid - Svelte 5 data grid hook using TanStack Table
 *
 * This hook manages all data grid state including:
 * - Cell focus and editing
 * - Cell selection (single, multi, range)
 * - Keyboard navigation
 * - Copy/paste functionality
 * - Search
 * - Context menus
 * - Row virtualization
 *
 * ## Reactivity Pattern
 *
 * TanStack Table's `@tanstack/table-core` is framework-agnostic and doesn't have
 * built-in Svelte reactivity. To make it reactive, we use `createSubscriber` from
 * `svelte/reactivity`:
 *
 * 1. `subscribeToTable()` - Called in table method getters to register effects as subscribers
 * 2. `notifyTableUpdate()` - Called after `table.setOptions()` to trigger re-renders
 *
 * This pattern is essential for async data sources (like database queries) where
 * data arrives after the initial render. Without it, `$derived(table.getRowModel().rows)`
 * would not update when data loads.
 *
 * @see https://svelte.dev/docs/svelte/svelte-reactivity#createSubscriber
 */

import {
	DEBOUNCE_DELAY,
	DEFAULT_COLUMN_SIZE,
	DEFAULT_ROW_HEIGHT,
	MAX_COLUMN_SIZE,
	MIN_COLUMN_SIZE,
	OVERSCAN
} from '$lib/components/data-grid/config/data-grid.js';
import {
	clearCellMedia,
	getSelectedRows,
	isAcknowledgedNullClearCurrent,
	isCellMutationSnapshotCurrent,
	shouldRestoreCellMutation,
	snapshotCellKeys,
	snapshotCellMutations
} from '$lib/components/data-grid/data-grid-actions.js';
import {
	getEmptyCellValue,
	parseCellValue,
	parseClipboardRows,
	serializeCellValue
} from '$lib/components/data-grid/data-grid-cell-values.js';
import type { VersionedCellUpdate } from '$lib/components/data-grid/data-grid-mutations.js';
import {
	appendLocalDraftRows,
	areEditValuesEqual,
	buildPatchData,
	clearAccumulatedValidationUpdates,
	cloneEditValue,
	createKeyedSequencer,
	createRowIdentityRegistry,
	deleteRowsByPersistence,
	expandValidationColumnIds,
	getColumnIdsForPatchError,
	getDraftValidationDisposition,
	getEarliestPendingValue,
	groupCellUpdates,
	mergeAccumulatedValidationUpdates,
	mergePatchData,
	mergeVersionedCellUpdates,
	mergeVersionedCellUpdatesForRow,
	migrateAccumulatedValidationRow,
	migrateCellKeyRowId,
	migrateCellPositionRowId,
	removeAccumulatedValidationRows,
	setImmutableValue
} from '$lib/components/data-grid/data-grid-mutations.js';
import {
	DATA_GRID_PREFERENCES_VERSION,
	DEFAULT_DATA_GRID_PERSISTENCE_SLICES,
	decodeDataGridPreferences,
	getAppliedDataGridPreferenceState,
	getDataGridPreferencesContentSnapshot,
	getDataGridPreferencesKey,
	reconcileDataGridPreferences,
	serializeDataGridPreferencesSnapshot,
	type DataGridPersistenceIdentity,
	type DataGridPersistenceSlices,
	type DataGridPreferences
} from '$lib/components/data-grid/data-grid-preferences.js';
import type { PatchErrorToastItem } from '$lib/components/data-grid/patch-error-toast.svelte';
import PatchErrorToast from '$lib/components/data-grid/patch-error-toast.svelte';
import type {
	CellPosition,
	CellSaveState,
	ContextMenuState,
	DataGridClearResult,
	DataGridCreateResult,
	DataGridDataAdapter,
	DataGridDeleteResult,
	DataGridMutationResult,
	DataGridStatusProps,
	FileCellData,
	NavigationDirection,
	PasteDialogState,
	RowHeightValue,
	SearchState,
	SelectionState,
	UpdateCell
} from '$lib/components/data-grid/types/data-grid.js';
import {
	parseCellKey as decodeCellKey,
	getCellKey as encodeCellKey,
	getRowHeightValue
} from '$lib/components/data-grid/types/data-grid.js';
import {
	Language,
	MediaCollection,
	translateLocalizedField,
	type Media,
	type Translatable
} from '$lib/db/schemas/0-utils';
import { UI } from '$lib/states/ui.svelte';
import {
	createTable,
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	type ColumnDef,
	type ColumnFiltersState,
	type ColumnOrderState,
	type ColumnPinningState,
	type ColumnSizingInfoState,
	type ColumnSizingState,
	type RowData,
	type RowSelectionState,
	type SortingState,
	type Table,
	type TableOptions,
	type TableOptionsResolved,
	type VisibilityState
} from '@tanstack/table-core';
import {
	Virtualizer,
	elementScroll,
	observeElementOffset,
	observeElementRect,
	type VirtualItem
} from '@tanstack/virtual-core';
import { tick, untrack } from 'svelte';
import { toast } from 'svelte-sonner';
import { SvelteMap, SvelteSet, createSubscriber } from 'svelte/reactivity';

// ============================================
// Types
// ============================================

export type CellUpdate = UpdateCell;
type RowChangeResult = void | {
	validated?: CellPosition[];
	errors?: CellPosition[];
	failed?: CellPosition[];
};
type PatchErrorBody = { errors?: Record<string, string[] | string> };
type PatchErrorDetail = { rowId: string; items: PatchErrorToastItem[] };
type DefaultRowValue<TData extends RowData> =
	| Record<string, unknown>
	| ((params: {
		draft: Partial<TData>;
		rowIndex: number;
		rows: readonly TData[];
	}) => Record<string, unknown> | void);

export interface UploadMediaParams {
	collection: MediaCollection;
	files: File[];
	rowId: string;
	columnId: string;
	onDraftUpdate?: (rowId: string, columnId: string, fileCell: FileCellData[]) => void;
	onLatestUpload?: (rowId: string, columnId: string, media: Media) => void;
}

export const hasTranslatableFields = <TData extends RowData>(
	columns: ColumnDef<TData, unknown>[]
) => {
	return columns.some((c) =>
		['text-translated-short', 'text-translated-long'].includes(c.meta?.cell?.variant ?? '')
	);
};

const formatPatchErrorItems = (body: PatchErrorBody | undefined): PatchErrorToastItem[] => {
	const errors = body?.errors ?? {};
	return Object.entries(errors).map(([field, value]) => {
		const values = Array.isArray(value) ? value : [value];
		return {
			field: field.replaceAll('_', ' '),
			messages: values.filter(Boolean)
		};
	});
};

export const uploadMedia = async ({
	collection: inputCollection,
	files,
	rowId,
	columnId
}: UploadMediaParams): Promise<FileCellData[]> => {
	const file = files[0];
	if (!file) return [];
	const formData = new FormData();
	formData.set('file', file);
	const res = await fetch(
		`/api/media/${inputCollection}/${file.name.toLowerCase().replace(' ', '-')}`,
		{ method: 'POST', body: formData }
	);
	if (!res.ok) throw new Error(`Failed to upload ${columnId}`);

	const { collection, filename } = (await res.json()) as Media;
	return [
		{
			id: filename,
			collection,
			filename
		}
	];
};

export class DataGridAdapterError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly body?: unknown
	) {
		super(message);
		this.name = 'DataGridAdapterError';
	}
}

async function readErrorBody(response: Response): Promise<unknown> {
	const contentType = response.headers.get('content-type') ?? '';
	try {
		return contentType.includes('json') ? await response.json() : await response.text();
	} catch {
		return undefined;
	}
}

async function requireJsonResponse<T>(response: Response, action: string): Promise<T> {
	if (!response.ok) {
		throw new DataGridAdapterError(
			`Failed to ${action}`,
			response.status,
			await readErrorBody(response)
		);
	}
	return (await response.json()) as T;
}

export function createEndpointDataGridAdapter<TData extends RowData>(
	endpoint: string
): DataGridDataAdapter<TData> {
	const jsonHeaders = { 'Content-Type': 'application/json' };
	return {
		async create({ row }) {
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify(row)
			});
			return requireJsonResponse<TData>(response, 'create row');
		},
		async update({ rowId, changes }) {
			const response = await fetch(`${endpoint}/${encodeURIComponent(rowId)}`, {
				method: 'PATCH',
				headers: jsonHeaders,
				body: JSON.stringify(changes)
			});
			return requireJsonResponse<TData>(response, `update row ${rowId}`);
		},
		async delete({ rowId }) {
			const response = await fetch(`${endpoint}/${encodeURIComponent(rowId)}`, {
				method: 'DELETE'
			});
			return response.ok;
		},
		async download({ rowIds }) {
			if (typeof document === 'undefined') return;
			for (const rowId of rowIds) {
				const response = await fetch(`${endpoint}/${encodeURIComponent(rowId)}/io`);
				if (!response.ok) {
					throw new DataGridAdapterError(
						`Failed to download row ${rowId}`,
						response.status,
						await readErrorBody(response)
					);
				}
				const disposition = response.headers.get('content-disposition') ?? '';
				const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? `row-${rowId}.yaml`;
				const url = URL.createObjectURL(await response.blob());
				const anchor = document.createElement('a');
				anchor.href = url;
				anchor.download = filename;
				anchor.click();
				URL.revokeObjectURL(url);
			}
		}
	};
}

export interface UseDataGridOptions<TData extends RowData> extends DataGridStatusProps {
	columns: ColumnDef<TData, unknown>[];
	/** Pass data as a getter function for reactivity: () => data */
	data: TData[] | (() => TData[]);
	/** API base path for default row handlers (e.g. /api/courses) */
	endpoint?: string;
	/** Overrides the endpoint-backed CRUD/download adapter. */
	dataAdapter?: DataGridDataAdapter<TData>;
	/** Column ids to include in every PATCH payload by default */
	defaultPatchColumnIds?: string[];
	/** Defaults applied when creating a new row through the built-in POST handler */
	defaultRow?: DefaultRowValue<TData>;
	rowHeight?: RowHeightValue;
	autoFocus?: boolean | Partial<CellPosition>;
	enableSearch?: boolean;
	enablePaste?: boolean;
	readOnly?: boolean;
	overscan?: number;
	getRowId?: (row: TData, index: number) => string;
	initialState?: {
		sorting?: SortingState;
		columnFilters?: ColumnFiltersState;
		columnVisibility?: VisibilityState;
		columnPinning?: ColumnPinningState;
		columnSizing?: ColumnSizingState;
		columnOrder?: ColumnOrderState;
		rowSelection?: RowSelectionState;
	};
	onDataChange?: (data: TData[]) => void;
	/** Persistence is disabled unless all explicit identity fields are provided. */
	persistence?: DataGridPersistenceIdentity & {
		debounceMs?: number;
		storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
		slices?: DataGridPersistenceSlices;
	};
	onRowAdd?:
	| ((
		event?: MouseEvent
	) =>
		| Partial<CellPosition>
		| DataGridCreateResult<TData>
		| void
		| Promise<Partial<CellPosition> | DataGridCreateResult<TData> | void>)
	| boolean;
	onRowsAdd?: (count: number) => DataGridCreateResult<TData> | Promise<DataGridCreateResult<TData>>;
	// onRowChange?: (originalRows: TData[], updatedRowIndices: number[], updates: CellUpdate[]) => void | Promise<void>;
	onRowChange?: (updates: CellUpdate[]) => RowChangeResult | Promise<RowChangeResult>;
	onRowsDelete?: (
		rows: TData[],
		rowIndices: number[]
	) => DataGridDeleteResult | boolean | Promise<DataGridDeleteResult | boolean>;
	onDownload?: ((rows: TData[]) => void | Promise<void>) | boolean;
	onPaste?: (updates: UpdateCell[]) => void | Promise<void>;
	onFilesUpload?: (params: {
		files: File[];
		rowIndex: number;
		rowId: string;
		columnId: string;
		row: TData;
	}) => Promise<FileCellData[]>;
	onFilesDelete?: (params: {
		fileIds: string[];
		rowIndex: number;
		rowId: string;
		columnId: string;
		row: TData;
	}) => void | Promise<void>;
}

export interface UseDataGridReturn<TData extends RowData> {
	// Refs
	readonly dataGridRef: HTMLDivElement | null;
	readonly headerRef: HTMLDivElement | null;
	rowMapRef: Map<number, HTMLDivElement>;
	readonly footerRef: HTMLDivElement | null;

	// Table instance
	table: Table<TData>;

	// Virtualizer
	rowVirtualizer: VirtualizerReturn;

	// Selection state - exposed as getters for use in $derived
	selectedCellsSet: SvelteSet<string>;

	// Row selection state - reactive for header checkbox
	getRowSelection: () => RowSelectionState;

	// Search state (if enabled)
	searchState?: SearchState;

	// Column size CSS variables
	columnSizeVars: Record<string, number>;
	preferences: import('$lib/components/data-grid/types/data-grid.js').DataGridPreferencesController;
	status: DataGridStatusProps;

	// Row add handler
	onRowAdd?: (
		event?: MouseEvent
	) => Promise<Partial<CellPosition> | DataGridCreateResult<TData> | void>;

	// Setters for refs (for bind:this)
	setDataGridRef: (el: HTMLDivElement | null) => void;
	setHeaderRef: (el: HTMLDivElement | null) => void;
	setFooterRef: (el: HTMLDivElement | null) => void;
}

// VirtualizerReturn interface for the virtualizer object we expose
interface VirtualizerReturn {
	readonly virtualItems: VirtualItem[];
	readonly totalSize: number;
	readonly isScrolling: boolean;
	scrollToIndex: (index: number, options?: { align?: 'start' | 'center' | 'end' | 'auto' }) => void;
	measureElement: (element: Element | null) => void;
	getVirtualItems: () => VirtualItem[];
	getTotalSize: () => number;
}

// ============================================
// Non-navigable columns (skip during keyboard nav)
// ============================================

// ============================================
// Main Hook
// ============================================

export function useDataGrid<TData extends RowData>(
	options: UseDataGridOptions<TData>
): UseDataGridReturn<TData> {
	const {
		columns,
		data: dataProp,
		endpoint,
		dataAdapter: dataAdapterProp,
		defaultPatchColumnIds = [],
		defaultRow,
		rowHeight: initialRowHeight = DEFAULT_ROW_HEIGHT,
		autoFocus = false,
		enableSearch = true,
		enablePaste = true,
		readOnly = false,
		overscan = OVERSCAN,
		getRowId,
		initialState,
		onDataChange,
		persistence,
		onRowAdd: onRowAddProp,
		onRowsAdd: onRowsAddProp,
		onRowChange: onRowChangeProp,
		onRowsDelete: onRowsDeleteProp,
		onDownload: onDownloadProp,
		onPaste,
		onFilesUpload,
		onFilesDelete
	} = options;
	const status: DataGridStatusProps = {
		loading: options.loading,
		error: options.error,
		loadingMessage: options.loadingMessage,
		errorMessage: options.errorMessage,
		emptyMessage: options.emptyMessage,
		filteredEmptyMessage: options.filteredEmptyMessage,
		loadingState: options.loadingState,
		errorState: options.errorState,
		emptyState: options.emptyState,
		filteredEmptyState: options.filteredEmptyState
	};

	// Support both direct data array and getter function for reactivity
	// Using a getter function () => data allows Svelte 5 to track changes
	const getSourceData = typeof dataProp === 'function' ? dataProp : () => dataProp;
	let dataOverride = $state.raw<TData[] | null>(null);
	let overrideBase: TData[] | null = null;
	let searchRevision = $state(0);
	const getData = () => dataOverride ?? getSourceData();
	const replaceData = (nextRows: TData[]) => {
		overrideBase = getSourceData();
		dataOverride = nextRows;
		searchRevision++;
		onDataChange?.(nextRows);
	};
	const dataAdapter =
		dataAdapterProp ?? (endpoint ? createEndpointDataGridAdapter<TData>(endpoint) : undefined);
	const normalizedColumns: ColumnDef<TData, unknown>[] = columns.map((column) => {
		const columnRecord = column as ColumnDef<TData, unknown> & {
			accessorFn?: (row: TData, index: number) => unknown;
			accessorKey?: string;
		};

		if (columnRecord.accessorFn) {
			return {
				...column,
				accessorFn: (row: TData, index: number) =>
					columnRecord.accessorFn?.(row, index) ?? undefined
			};
		}

		if (columnRecord.accessorKey) {
			return {
				...column,
				accessorFn: (row: TData) =>
					(row as Record<string, unknown>)[columnRecord.accessorKey!] ?? undefined
			};
		}

		return column;
	});

	const rowIdentities = createRowIdentityRegistry<object>();
	let generatedRowId = 0;
	let temporaryRowId = 0;
	const getRowIdValue = (row: TData, index: number): string => {
		if (typeof row === 'object' && row !== null) {
			const temporaryId = rowIdentities.getTemporaryId(row);
			if (temporaryId) return temporaryId;
		}
		const id = getRowId?.(row, index) ?? (row as Record<string, unknown>)?.id;
		if (typeof id === 'string' || typeof id === 'number') return String(id);
		if (typeof row === 'object' && row !== null) {
			const existing = rowIdentities.getGeneratedId(row);
			if (existing) return existing;
			const next = `data-grid-row-${++generatedRowId}`;
			rowIdentities.setGeneratedId(row, next);
			return next;
		}
		return `data-grid-row-${index}`;
	};
	const registerTemporaryRow = (row: TData, _index: number, rows: readonly TData[]): string => {
		const existingIds = new SvelteSet(rows.map((item, index) => getRowIdValue(item, index)));
		let rowId: string;
		do rowId = `new-${++temporaryRowId}`;
		while (existingIds.has(rowId));
		rowIdentities.registerTemporary(row as object, rowId);
		return rowId;
	};

	const carryRowId = (previous: TData, next: TData) => {
		if (
			typeof previous === 'object' &&
			previous !== null &&
			typeof next === 'object' &&
			next !== null
		)
			rowIdentities.carry(previous, next);
	};
	const cellSaveStateMap = new SvelteMap<string, CellSaveState>();
	const sequenceRowMutation = createKeyedSequencer();
	const savedStateTimers = new SvelteMap<string, ReturnType<typeof setTimeout>>();
	const cellMutationGeneration = new SvelteMap<string, number>();
	const pendingCellMutations = new SvelteMap<
		string,
		{ generation: number; previousValue: unknown; update: CellUpdate }
	>();
	let accumulatedValidationUpdates: Map<
		string,
		Map<string, VersionedCellUpdate<CellUpdate>>
	> = new SvelteMap();
	const canonicalCreatedRows = new SvelteMap<string, TData>();

	const replaceRowById = (
		rowId: string,
		updater: (row: TData) => TData,
		carryIdentity = true
	): boolean => {
		const rows = getData();
		const sourceIndex = rows.findIndex((row, index) => getRowIdValue(row, index) === rowId);
		if (sourceIndex < 0) return false;
		const previous = rows[sourceIndex];
		if (!previous) return false;
		const nextRow = updater(previous);
		if (carryIdentity) carryRowId(previous, nextRow);
		const nextRows = [...rows];
		nextRows[sourceIndex] = nextRow;
		replaceData(nextRows);
		return true;
	};
	const markCellSaved = (key: string) => {
		const existing = savedStateTimers.get(key);
		if (existing) clearTimeout(existing);
		cellSaveStateMap.set(key, { status: 'saved' });
		savedStateTimers.set(
			key,
			setTimeout(() => {
				if (cellSaveStateMap.get(key)?.status === 'saved')
					cellSaveStateMap.set(key, { status: 'idle' });
				savedStateTimers.delete(key);
			}, 1200)
		);
	};
	const mirrorCellStateToCanonicalRow = (temporaryId: string, canonicalId: string) => {
		accumulatedValidationUpdates = migrateAccumulatedValidationRow(
			accumulatedValidationUpdates,
			temporaryId,
			canonicalId
		);
		for (const column of table.getAllLeafColumns()) {
			const temporaryKey = encodeCellKey(temporaryId, column.id);
			const canonicalKey = encodeCellKey(canonicalId, column.id);
			const saveState = cellSaveStateMap.get(temporaryKey);
			if (saveState) cellSaveStateMap.set(canonicalKey, saveState);
			const generation = cellMutationGeneration.get(temporaryKey);
			if (generation !== undefined) cellMutationGeneration.set(canonicalKey, generation);
			const pending = pendingCellMutations.get(temporaryKey);
			if (pending) {
				pendingCellMutations.set(canonicalKey, {
					...pending,
					update: { ...pending.update, rowId: canonicalId }
				});
			}
			if (cellValueMap.has(temporaryKey))
				cellValueMap.set(canonicalKey, cellValueMap.get(temporaryKey));
		}
	};
	const migrateCellKeySet = (keys: Set<string>, temporaryId: string, canonicalId: string) => {
		for (const key of [...keys]) {
			const migratedKey = migrateCellKeyRowId(key, temporaryId, canonicalId);
			if (migratedKey === key) continue;
			keys.delete(key);
			keys.add(migratedKey);
		}
	};
	const migrateUiIdentityToCanonicalRow = (temporaryId: string, canonicalId: string) => {
		focusedCell = migrateCellPositionRowId(focusedCell, temporaryId, canonicalId);
		editingCell = migrateCellPositionRowId(editingCell, temporaryId, canonicalId);
		selectionAnchor = migrateCellPositionRowId(selectionAnchor, temporaryId, canonicalId);
		if (editingSession?.rowId === temporaryId)
			editingSession = { ...editingSession, rowId: canonicalId };
		if (selectionState.selectionRange) {
			selectionState = {
				...selectionState,
				selectionRange: {
					start: migrateCellPositionRowId(
						selectionState.selectionRange.start,
						temporaryId,
						canonicalId
					)!,
					end: migrateCellPositionRowId(
						selectionState.selectionRange.end,
						temporaryId,
						canonicalId
					)!
				}
			};
		}
		migrateCellKeySet(selectedCellsSet, temporaryId, canonicalId);
		migrateCellKeySet(cancelledCellKeys, temporaryId, canonicalId);
		migrateCellKeySet(hasErrorMatchSet, temporaryId, canonicalId);
		migrateCellKeySet(searchMatchSet, temporaryId, canonicalId);
		searchMatches = searchMatches.map((position) =>
			migrateCellPositionRowId(position, temporaryId, canonicalId)!
		);
		if (temporaryId in rowSelection) {
			const nextRowSelection = { ...rowSelection };
			nextRowSelection[canonicalId] = nextRowSelection[temporaryId] ?? false;
			delete nextRowSelection[temporaryId];
			rowSelection = nextRowSelection;
		}
	};
	const getReconciliationRowId = (rowId: string) =>
		getData().some((item, index) => getRowIdValue(item, index) === rowId)
			? rowId
			: rowIdentities.resolve(rowId);
	const restoreCanonicalCreatedRow = (canonicalId: string) => {
		const created = canonicalCreatedRows.get(canonicalId);
		if (!created) return;
		if (!getData().some((row, index) => getRowIdValue(row, index) === canonicalId)) {
			replaceData([...getData(), created]);
		}
		canonicalCreatedRows.delete(canonicalId);
	};
	const setMutationCellSaveState = (rowId: string, columnId: string, state: CellSaveState) => {
		cellSaveStateMap.set(encodeCellKey(rowId, columnId), state);
		const canonicalId = rowIdentities.resolve(rowId);
		if (canonicalId !== rowId) cellSaveStateMap.set(encodeCellKey(canonicalId, columnId), state);
	};
	const getImmutableCellValue = (row: TData, rowIndex: number, columnId: string) => {
		const accessor = table.getColumn(columnId)?.accessorFn;
		return accessor ? accessor(row, rowIndex) : (row as Record<string, unknown>)[columnId];
	};

	function getCellKey(rowIndexOrId: number | string, columnId: string): string {
		const rowId =
			typeof rowIndexOrId === 'number' ? table?.getRowModel().rows[rowIndexOrId]?.id : rowIndexOrId;
		return encodeCellKey(rowId ?? `missing-row-${rowIndexOrId}`, columnId);
	}

	function parseCellKey(cellKey: string): CellPosition {
		const decoded = decodeCellKey(cellKey);
		const rowIndex = decoded.rowId
			? table?.getRowModel().rows.findIndex((row) => row.id === decoded.rowId)
			: -1;
		return { ...decoded, rowIndex: rowIndex >= 0 ? rowIndex : decoded.rowIndex };
	}

	function getCellMutationSnapshot(
		rowId: string,
		columnId: string
	): { generation: number; value: unknown } | undefined {
		const rows = getData();
		const rowIndex = rows.findIndex((row, index) => getRowIdValue(row, index) === rowId);
		const row = rows[rowIndex];
		if (!row) return undefined;
		const key = encodeCellKey(rowId, columnId);
		return {
			generation: cellMutationGeneration.get(key) ?? 0,
			value: cloneEditValue(
				cellValueMap.has(key)
					? cellValueMap.get(key)
					: getImmutableCellValue(row, rowIndex, columnId)
			)
		};
	}

	function getCellPosition(rowIndex: number, columnId: string): CellPosition {
		return { rowIndex, rowId: table?.getRowModel().rows[rowIndex]?.id, columnId };
	}

	const resolveDefaultRow = (draft: Partial<TData>, rowIndex: number, rows: readonly TData[]) =>
		({
			...(typeof defaultRow === 'function'
				? (defaultRow({ draft, rowIndex, rows }) ?? {})
				: (defaultRow ?? {})),
			...draft
		}) as Partial<TData>;

	const defaultOnRowAdd = dataAdapter?.create
		? () => {
			const added = appendLocalDraftRows(getData(), 1, resolveDefaultRow, registerTemporaryRow);
			replaceData(added.rows);
			return { rows: added.drafts, rowIds: added.rowIds, failedCount: 0 };
		}
		: undefined;

	const defaultOnRowsAdd = dataAdapter?.create
		? (count: number) => {
			const added = appendLocalDraftRows(
				getData(),
				count,
				resolveDefaultRow,
				registerTemporaryRow
			);
			replaceData(added.rows);
			return { rows: added.drafts, rowIds: added.rowIds, failedCount: 0 };
		}
		: undefined;

	const defaultOnRowsDelete =
		dataAdapter?.delete || dataAdapter?.create
			? async (removedrows: TData[], rowIndices: number[]) => {
				const removals = removedrows.map((row, index) => ({
					row,
					rowId: getRowIdValue(row, rowIndices[index] ?? index)
				}));

				const result = await deleteRowsByPersistence(
					removals,
					(rowId) => rowIdentities.isTemporary(rowId),
					(rowId) => rowIdentities.resolve(rowId),
					(rowId) => rowIdentities.getSequenceKey(rowId),
					(key, mutation) => sequenceRowMutation(key, mutation),
					dataAdapter.delete
						? ({ row }, rowId) => dataAdapter.delete!({ row, rowId })
						: undefined,
					(temporary) => {
						const temporaryIdSet = new SvelteSet(temporary.map(({ rowId }) => rowId));
						if (temporaryIdSet.size === 0) return;
						replaceData(
							getData().filter((row, index) => !temporaryIdSet.has(getRowIdValue(row, index)))
						);
					},
					(_row, canonicalId) => restoreCanonicalCreatedRow(canonicalId)
				);
				const deletedIdentitySet = new SvelteSet(
					result.deletedRowIds.flatMap((rowId) => [rowId, rowIdentities.resolve(rowId)])
				);
				accumulatedValidationUpdates = removeAccumulatedValidationRows(
					accumulatedValidationUpdates,
					deletedIdentitySet
				);

				if (result.deletedPersistedRowIds.length > 0) {
					const removedPersistedIdSet = new SvelteSet(result.deletedPersistedRowIds);
					for (const rowId of removedPersistedIdSet) canonicalCreatedRows.delete(rowId);
					replaceData(
						getData().filter(
							(row, index) => !removedPersistedIdSet.has(getRowIdValue(row, index))
						)
					);
				}
				return {
					deletedRowIds: result.deletedRowIds,
					failedRowIds: result.failedRowIds
				};
			}
			: undefined;

	const defaultOnDownload = dataAdapter?.download
		? async (rowsToDownload: TData[], rowIndices?: number[]) => {
			const rowIds = rowsToDownload.map((row, index) =>
				getRowIdValue(row, rowIndices?.[index] ?? index)
			);
			await dataAdapter.download!({ rows: rowsToDownload, rowIds });
		}
		: undefined;

	const defaultOnRowChange =
		dataAdapter?.update || dataAdapter?.create
			? async (updates: CellUpdate[], options?: { suppressToast?: boolean }) => {
				const updatesByRow = groupCellUpdates(updates);
				const getPatchPayload = (row: TData, patchData: Record<string, unknown>) => {
					if (!defaultPatchColumnIds.length) return patchData;
					const rowRecord = row as Record<string, unknown>;
					const extraData: Record<string, unknown> = {};
					for (const columnId of defaultPatchColumnIds) {
						if (columnId in rowRecord) extraData[columnId] = rowRecord[columnId];
					}
					return { ...extraData, ...patchData };
				};

				const pos = (rowId: string, columnIds: string[]) => {
					const rowIndex = table.getRowModel().rows.findIndex((row) => row.id === rowId);
					return columnIds.map((columnId) => ({
						rowId,
						rowIndex: Math.max(0, rowIndex),
						columnId
					}));
				};
				const errorDetails: PatchErrorDetail[] = [];
				const results = await Promise.all(
					Object.entries(updatesByRow).map(async ([rowId]) => {
						const directEntries = mergeVersionedCellUpdates(
							undefined,
							updates
								.filter((update) => update.rowId === rowId)
								.flatMap((update) => {
									const pending = pendingCellMutations.get(encodeCellKey(rowId, update.columnId));
									return pending ? [pending] : [];
								})
						);
						const patchColumns = table.getAllLeafColumns().map((column) => ({
							id: column.id,
							valuePath: column.columnDef.meta?.valuePath
						}));
						const validationColumns = table.getAllLeafColumns().map((column) => ({
							id: column.id,
							validationDependencies: column.columnDef.meta?.validationDependencies
						}));
						let submittedEntries = Array.from(directEntries.values());
						let columnIds = submittedEntries.map(({ update }) => update.columnId);
						let mutationRowId = rowId;
						let generations: Map<string, number> = new SvelteMap(
							submittedEntries.map(({ generation, update }) => [update.columnId, generation])
						);

						try {
							const mutationResult = await sequenceRowMutation(
								rowIdentities.getSequenceKey(rowId),
								async () => {
									const resolvedRowId = rowIdentities.resolve(rowId);
									mutationRowId = resolvedRowId;
									const latestRows = getData();
									const latestIndex = latestRows.findIndex((item, index) => {
										const currentId = getRowIdValue(item, index);
										return currentId === rowId || currentId === resolvedRowId;
									});
									const latestRow = latestRows[latestIndex];
									if (!latestRow) throw new Error(`Row ${resolvedRowId} no longer exists`);
									submittedEntries = mergeVersionedCellUpdatesForRow(
										accumulatedValidationUpdates,
										[rowId, resolvedRowId],
										Array.from(directEntries.values()),
										resolvedRowId
									);
									columnIds = submittedEntries.map(({ update }) => update.columnId);
									generations = new SvelteMap(
										submittedEntries.map(({ generation, update }) => [
											update.columnId,
											generation
										])
									);
									const patchData: Record<string, unknown> = {};
									for (const { update } of submittedEntries) {
										mergePatchData(
											patchData,
											buildPatchData(
												latestRow,
												update.columnId,
												update.value,
												table.getColumn(update.columnId)?.columnDef.meta
											)
										);
									}

									if (rowIdentities.isTemporary(rowId) && dataAdapter.create) {
										const resolvedDefaultRow =
											typeof defaultRow === 'function'
												? (defaultRow({
													draft: latestRow,
													rowIndex: latestIndex,
													rows: latestRows
												}) ?? {})
												: (defaultRow ?? {});
										const created = await dataAdapter.create!({
											row: { ...resolvedDefaultRow, ...latestRow }
										});
										const canonicalId = getRowIdValue(created, latestIndex);
										rowIdentities.recordCanonical(rowId, canonicalId);
										canonicalCreatedRows.set(canonicalId, created);
										mutationRowId = canonicalId;
										return { row: created, created: true, canonicalId };
									}
									if (!dataAdapter.update)
										throw new Error(`No update capability for row ${resolvedRowId}`);
									return {
										row: await dataAdapter.update({
											row: latestRow,
											rowId: resolvedRowId,
											changes: getPatchPayload(latestRow, patchData) as Partial<TData>
										}),
										created: false,
										canonicalId: resolvedRowId
									};
								}
							);
							const canonicalRow = mutationResult.row;
							if (mutationResult.created)
								mirrorCellStateToCanonicalRow(rowId, mutationResult.canonicalId);
							accumulatedValidationUpdates = clearAccumulatedValidationUpdates(
								accumulatedValidationUpdates,
								submittedEntries
							);
							if (mutationResult.created)
								migrateUiIdentityToCanonicalRow(rowId, mutationResult.canonicalId);
							const reconciled = replaceRowById(
								getReconciliationRowId(rowId),
								(currentRow) => {
									const merged = { ...(currentRow as Record<string, unknown>) };
									for (const [field, value] of Object.entries(
										canonicalRow as Record<string, unknown>
									)) {
										const fieldColumnIds = getColumnIdsForPatchError(field, patchColumns);
										if (
											fieldColumnIds.some((columnId) => {
												const key = encodeCellKey(mutationResult.canonicalId, columnId);
												const state = cellSaveStateMap.get(key);
												return generations.has(columnId)
													? cellMutationGeneration.get(key) !== generations.get(columnId)
													: state?.status === 'saving';
											})
										)
											continue;
										merged[field] = value;
									}
									return merged as TData;
								},
								!mutationResult.created
							);
							if (mutationResult.created && reconciled)
								canonicalCreatedRows.delete(mutationResult.canonicalId);
							for (const columnId of columnIds) {
								const key = encodeCellKey(mutationResult.canonicalId, columnId);
								if (cellMutationGeneration.get(key) === generations.get(columnId)) {
									markCellSaved(key);
									pendingCellMutations.delete(key);
									pendingCellMutations.delete(encodeCellKey(rowId, columnId));
									cellValueMap.delete(key);
									cellValueMap.delete(encodeCellKey(rowId, columnId));
								}
							}
							const settledColumnIds = columnIds.filter(
								(columnId) =>
									cellMutationGeneration.get(
										encodeCellKey(mutationResult.canonicalId, columnId)
									) === generations.get(columnId)
							);
							const validatedColumnIds = expandValidationColumnIds(
								settledColumnIds,
								validationColumns
							);
							return {
								validated: pos(mutationResult.canonicalId, validatedColumnIds),
								errors: [] as CellPosition[],
								failed: [] as CellPosition[]
							};
						} catch (error) {
							const errorBody =
								error instanceof DataGridAdapterError && error.status === 422
									? ((error.body as PatchErrorBody | undefined) ?? {})
									: undefined;
							if (errorBody) {
								accumulatedValidationUpdates = mergeAccumulatedValidationUpdates(
									accumulatedValidationUpdates,
									submittedEntries
								);
								errorDetails.push({
									rowId: mutationRowId,
									items: formatPatchErrorItems(errorBody)
								});
								const errorCols = new SvelteSet(Object.keys(errorBody.errors ?? {}));
								const matchedErrorColumnIds = new SvelteSet<string>();
								const matchedErrorMessages = new SvelteMap<string, string>();
								for (const errorCol of errorCols) {
									const rawMessages = errorBody.errors?.[errorCol];
									const message = (Array.isArray(rawMessages) ? rawMessages : [rawMessages])
										.filter((item): item is string => Boolean(item))
										.join(', ');
									for (const id of getColumnIdsForPatchError(errorCol, patchColumns)) {
										matchedErrorColumnIds.add(id);
										if (message) matchedErrorMessages.set(id, message);
									}
								}
								const currentSubmittedColumnIds = columnIds.filter(
									(columnId) =>
										cellMutationGeneration.get(encodeCellKey(mutationRowId, columnId)) ===
										generations.get(columnId)
								);
								const relevantErrorColumnIds = new SvelteSet(
									Array.from(matchedErrorColumnIds).filter((columnId) => {
										const pending = pendingCellMutations.get(
											encodeCellKey(mutationRowId, columnId)
										);
										return !pending || pending.generation === generations.get(columnId);
									})
								);
								const disposition = getDraftValidationDisposition(
									currentSubmittedColumnIds,
									relevantErrorColumnIds
								);
								const latestRows = getData();
								const latestIndex = latestRows.findIndex(
									(item, index) => getRowIdValue(item, index) === mutationRowId
								);
								const latestRow = latestRows[latestIndex];
								for (const columnId of columnIds) {
									const key = encodeCellKey(mutationRowId, columnId);
									const pending = pendingCellMutations.get(key);
									if (cellMutationGeneration.get(key) !== generations.get(columnId)) continue;
									if (disposition.invalidColumnIds.includes(columnId)) {
										setMutationCellSaveState(mutationRowId, columnId, {
											status: 'error',
											error:
												matchedErrorMessages.get(columnId) ??
												(error instanceof Error ? error.message : 'Failed to save cell')
										});
									} else setMutationCellSaveState(mutationRowId, columnId, { status: 'idle' });
									if (pending?.generation === generations.get(columnId))
										pendingCellMutations.delete(key);
									if (
										latestRow &&
										areEditValuesEqual(
											getImmutableCellValue(latestRow, latestIndex, columnId),
											submittedEntries.find(({ update }) => update.columnId === columnId)?.update
												.value
										)
									)
										cellValueMap.delete(key);
								}
								return {
									errors: pos(mutationRowId, disposition.errorColumnIds),
									validated: pos(mutationRowId, disposition.validColumnIds),
									failed: pos(
										mutationRowId,
										Array.from(directEntries.values())
											.filter(
												(entry) =>
													cellMutationGeneration.get(
														encodeCellKey(mutationRowId, entry.update.columnId)
													) === entry.generation
											)
											.map((entry) => entry.update.columnId)
									)
								};
							}
							accumulatedValidationUpdates = clearAccumulatedValidationUpdates(
								accumulatedValidationUpdates,
								submittedEntries
							);
							for (const entry of submittedEntries) {
								const { columnId } = entry.update;
								const key = encodeCellKey(mutationRowId, columnId);
								if (cellMutationGeneration.get(key) !== entry.generation) continue;
								setMutationCellSaveState(mutationRowId, columnId, {
									status: 'error',
									error: error instanceof Error ? error.message : 'Failed to save cell'
								});
								pendingCellMutations.delete(key);
								cellValueMap.delete(key);
								replaceRowById(getReconciliationRowId(mutationRowId), (currentRow) =>
									setImmutableValue(
										currentRow,
										columnId,
										entry.previousValue,
										table.getColumn(columnId)?.columnDef.meta
									)
								);
							}
							return {
								validated: [] as CellPosition[],
								errors: pos(
									mutationRowId,
									columnIds.filter(
										(columnId) =>
											cellMutationGeneration.get(encodeCellKey(mutationRowId, columnId)) ===
											generations.get(columnId)
									)
								),
								failed: pos(mutationRowId, columnIds)
							};
						}
					})
				);

				const validated = results.flatMap((r) => r.validated);
				const errors = results.flatMap((r) => r.errors);
				const failed = results.flatMap((r) => r.failed);

				if (options?.suppressToast) {
					// The caller reports one aggregate outcome after all selected cells settle.
				} else if (errors.length || errorDetails.length) {
					if (errorDetails.length) {
						toast.dismiss();
						for (const errorDetail of errorDetails) {
							toast(PatchErrorToast, {
								componentProps: {
									items: errorDetail.items
								},
								closeButton: true,
								duration: Infinity
							});
						}
					} else {
						toast.dismiss();
						toast.error('Failed to patch all rows', { closeButton: true, duration: Infinity });
					}
				} else {
					toast.dismiss();
					toast.success('All rows patched');
				}

				return { validated, errors, failed };
			}
			: undefined;

	const resolvedOnRowAdd =
		typeof onRowAddProp === 'boolean'
			? onRowAddProp === false
				? undefined
				: defaultOnRowAdd
			: (onRowAddProp ?? defaultOnRowAdd);
	const resolvedOnRowsAdd = onRowsAddProp ?? defaultOnRowsAdd;
	const resolvedOnRowsDelete = onRowsDeleteProp ?? defaultOnRowsDelete;
	const resolvedOnRowChange = onRowChangeProp ?? defaultOnRowChange;
	const resolvedOnDownload =
		typeof onDownloadProp === 'boolean'
			? onDownloadProp
				? defaultOnDownload
				: undefined
			: onDownloadProp;

	// SvelteMap for CELL-LEVEL fine-grained reactivity
	// Key is "rowIndex:columnId", value is the cell value
	// Only the specific cell that changed will re-render
	const cellValueMap = new SvelteMap<string, unknown>();

	// Expose the map directly so cells can access it in $derived for proper reactivity
	// When a cell calls cellValueMap.get(key) inside $derived, Svelte tracks that specific key
	function getCellValueMap(): SvelteMap<string, unknown> {
		return cellValueMap;
	}

	// Helper to clear cell value cache (called when table state changes)
	function clearCellValueCache(): void {
		cellValueMap.clear();
	}

	// ========================================
	// Reactive State using Svelte 5 runes
	// ========================================

	// Refs
	let dataGridRef = $state<HTMLDivElement | null>(null);
	let headerRef = $state<HTMLDivElement | null>(null);
	let footerRef = $state<HTMLDivElement | null>(null);
	const rowMapRef = new SvelteMap<number, HTMLDivElement>();
	const cellMapRef = new SvelteMap<string, HTMLDivElement>();

	// Table state - use initialState if provided
	const currentColumnIds = normalizedColumns
		.map((column) =>
			typeof column.id === 'string'
				? column.id
				: 'accessorKey' in column && typeof column.accessorKey === 'string'
					? column.accessorKey
					: undefined
		)
		.filter((id): id is string => typeof id === 'string');
	const defaultColumnSizing = Object.fromEntries(
		normalizedColumns.flatMap((column) => {
			const id =
				typeof column.id === 'string'
					? column.id
					: 'accessorKey' in column && typeof column.accessorKey === 'string'
						? column.accessorKey
						: undefined;
			return id && typeof column.size === 'number' ? [[id, column.size]] : [];
		})
	);
	const codeDefaults = {
		sorting: [...(initialState?.sorting ?? [])],
		columnFilters: [...(initialState?.columnFilters ?? [])],
		columnVisibility: { ...(initialState?.columnVisibility ?? {}) },
		columnPinning: {
			left: [...(initialState?.columnPinning?.left ?? [])],
			right: [...(initialState?.columnPinning?.right ?? [])]
		},
		columnSizing: { ...defaultColumnSizing, ...(initialState?.columnSizing ?? {}) },
		columnOrder: [...(initialState?.columnOrder ?? currentColumnIds)],
		rowHeight: initialRowHeight
	};
	let sorting = $state<SortingState>([...codeDefaults.sorting]);
	let columnFilters = $state<ColumnFiltersState>([...codeDefaults.columnFilters]);
	let rowSelection = $state<RowSelectionState>(initialState?.rowSelection ?? {});
	let isDownloading = $state(false);
	let columnPinning = $state<ColumnPinningState>({ ...codeDefaults.columnPinning });
	let columnVisibility = $state<VisibilityState>({ ...codeDefaults.columnVisibility });
	let columnSizing = $state<ColumnSizingState>({ ...codeDefaults.columnSizing });
	let columnOrder = $state<ColumnOrderState>([...codeDefaults.columnOrder]);
	let columnSizingInfo = $state<ColumnSizingInfoState>({
		startOffset: null,
		startSize: null,
		deltaOffset: null,
		deltaPercentage: null,
		isResizingColumn: false,
		columnSizingStart: []
	});
	let rowHeight = $state<RowHeightValue>(codeDefaults.rowHeight);
	let rowHeightRemeasureVersion = $state(0);
	const persistenceEnabled = Boolean(
		persistence?.gridId.trim() && persistence.tenantId.trim() && persistence.userId.trim()
	);
	const preferencesKey =
		persistence && persistenceEnabled ? getDataGridPreferencesKey(persistence) : null;
	let preferencesReady = $state(!persistenceEnabled);
	const persistenceSlices = { ...DEFAULT_DATA_GRID_PERSISTENCE_SLICES, ...persistence?.slices };
	let suppressedPreferenceSnapshot: string | null = null;
	let latestPreferenceValue: string | null = null;
	let appliedPreferenceState = getAppliedDataGridPreferenceState(null);
	let preferenceWriteTimer: ReturnType<typeof setTimeout> | null = null;
	const preferenceCapabilities = normalizedColumns.flatMap((column) => {
		const id =
			typeof column.id === 'string'
				? column.id
				: 'accessorKey' in column && typeof column.accessorKey === 'string'
					? column.accessorKey
					: undefined;
		return id
			? [
				{
					id,
					canSort: column.enableSorting !== false,
					canFilter: column.enableColumnFilter !== false,
					canHide: column.enableHiding !== false,
					minSize: column.minSize ?? MIN_COLUMN_SIZE,
					maxSize: column.maxSize ?? MAX_COLUMN_SIZE
				}
			]
			: [];
	});

	function applyPreferences(preferences: DataGridPreferences) {
		const reconciled = reconcileDataGridPreferences(preferences, preferenceCapabilities);
		if (persistenceSlices.sorting) sorting = [...(reconciled.sorting ?? codeDefaults.sorting)];
		if (persistenceSlices.filters)
			columnFilters = [...(reconciled.columnFilters ?? codeDefaults.columnFilters)];
		if (persistenceSlices.visibility)
			columnVisibility = {
				...codeDefaults.columnVisibility,
				...(reconciled.columnVisibility ?? {})
			};
		if (persistenceSlices.pinning)
			columnPinning = {
				left: [...(reconciled.columnPinning?.left ?? codeDefaults.columnPinning.left)],
				right: [...(reconciled.columnPinning?.right ?? codeDefaults.columnPinning.right)]
			};
		if (persistenceSlices.sizing)
			columnSizing = { ...codeDefaults.columnSizing, ...(reconciled.columnSizing ?? {}) };
		if (persistenceSlices.columnOrder) {
			const restoredOrder = reconciled.columnOrder ?? codeDefaults.columnOrder;
			columnOrder = [
				...restoredOrder,
				...currentColumnIds.filter((id) => !restoredOrder.includes(id))
			];
		}
		if (persistenceSlices.rowHeight) {
			const restoredRowHeight = reconciled.rowHeight ?? codeDefaults.rowHeight;
			if (rowHeight !== restoredRowHeight) rowHeightRemeasureVersion++;
			rowHeight = restoredRowHeight;
		}
	}

	function restoreCodeDefaults(removeStored: boolean) {
		cancelPendingPreferenceWrite();
		appliedPreferenceState = getAppliedDataGridPreferenceState(null);
		if (removeStored && preferencesKey && typeof window !== 'undefined') {
			try {
				const storage = persistence?.storage ?? window.localStorage;
				storage.removeItem(preferencesKey);
			} catch {
				// Storage can be unavailable in privacy-restricted browser contexts.
			}
		}
		sorting = [...codeDefaults.sorting];
		columnFilters = [...codeDefaults.columnFilters];
		columnVisibility = { ...codeDefaults.columnVisibility };
		columnPinning = {
			left: [...codeDefaults.columnPinning.left],
			right: [...codeDefaults.columnPinning.right]
		};
		columnSizing = { ...codeDefaults.columnSizing };
		columnOrder = [...codeDefaults.columnOrder];
		if (rowHeight !== codeDefaults.rowHeight) rowHeightRemeasureVersion++;
		rowHeight = codeDefaults.rowHeight;
	}

	function cancelPendingPreferenceWrite() {
		if (preferenceWriteTimer) clearTimeout(preferenceWriteTimer);
		preferenceWriteTimer = null;
		latestPreferenceValue = null;
	}

	function resetPreferences() {
		restoreCodeDefaults(true);
		suppressedPreferenceSnapshot = getPreferenceSnapshot();
	}

	function getPreferenceSnapshot() {
		return serializeDataGridPreferencesSnapshot({
			version: DATA_GRID_PREFERENCES_VERSION,
			...(persistenceSlices.sorting ? { sorting } : {}),
			...(persistenceSlices.filters ? { columnFilters } : {}),
			...(persistenceSlices.visibility ? { columnVisibility } : {}),
			...(persistenceSlices.pinning ? { columnPinning } : {}),
			...(persistenceSlices.sizing ? { columnSizing } : {}),
			...(persistenceSlices.columnOrder ? { columnOrder } : {}),
			...(persistenceSlices.rowHeight ? { rowHeight } : {})
		});
	}

	function getCodeDefaultPreferenceSnapshot() {
		return serializeDataGridPreferencesSnapshot({
			version: DATA_GRID_PREFERENCES_VERSION,
			...(persistenceSlices.sorting ? { sorting: codeDefaults.sorting } : {}),
			...(persistenceSlices.filters ? { columnFilters: codeDefaults.columnFilters } : {}),
			...(persistenceSlices.visibility ? { columnVisibility: codeDefaults.columnVisibility } : {}),
			...(persistenceSlices.pinning ? { columnPinning: codeDefaults.columnPinning } : {}),
			...(persistenceSlices.sizing ? { columnSizing: codeDefaults.columnSizing } : {}),
			...(persistenceSlices.columnOrder ? { columnOrder: codeDefaults.columnOrder } : {}),
			...(persistenceSlices.rowHeight ? { rowHeight: codeDefaults.rowHeight } : {})
		});
	}

	const hasPreferences = $derived.by(
		() => preferencesReady && getPreferenceSnapshot() !== getCodeDefaultPreferenceSnapshot()
	);

	function flushPreferences() {
		if (!preferencesKey || !latestPreferenceValue || typeof window === 'undefined') return;
		const preferenceValue = latestPreferenceValue;
		cancelPendingPreferenceWrite();
		const decoded = decodeDataGridPreferences(preferenceValue);
		if (!decoded.preferences) return;
		const snapshot = getDataGridPreferencesContentSnapshot(decoded.preferences);
		if (snapshot === appliedPreferenceState.snapshot) return;
		try {
			const storage = persistence?.storage ?? window.localStorage;
			storage.setItem(preferencesKey, preferenceValue);
			appliedPreferenceState = getAppliedDataGridPreferenceState(decoded.preferences);
		} catch {
			// Persistence is best-effort.
		}
	}

	$effect(() => {
		if (!preferencesKey || typeof window === 'undefined') return;
		let storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
		try {
			storage = persistence?.storage ?? window.localStorage;
			const stored = storage.getItem(preferencesKey);
			if (stored && persistence) storage.setItem(preferencesKey, stored);
			const decoded = decodeDataGridPreferences(stored);
			if (decoded.status === 'malformed') storage.removeItem(preferencesKey);
			if (decoded.preferences) {
				untrack(() => applyPreferences(decoded.preferences!));
				appliedPreferenceState = getAppliedDataGridPreferenceState(decoded.preferences);
			}
		} catch {
			preferencesReady = true;
			return;
		}
		preferencesReady = true;

		const onStorage = (event: StorageEvent) => {
			if (event.key !== preferencesKey) return;
			const decoded = decodeDataGridPreferences(event.newValue);
			if (decoded.status === 'future') return;
			if (decoded.status === 'malformed') {
				try {
					storage.removeItem(preferencesKey);
				} catch {
					/* best-effort */
				}
				return;
			}
			if (decoded.preferences) {
				const incomingSnapshot = getDataGridPreferencesContentSnapshot(decoded.preferences);
				if (decoded.preferences.updatedAt < appliedPreferenceState.updatedAt) return;
				cancelPendingPreferenceWrite();
				if (incomingSnapshot === appliedPreferenceState.snapshot) {
					appliedPreferenceState = {
						...appliedPreferenceState,
						updatedAt: Math.max(appliedPreferenceState.updatedAt, decoded.preferences.updatedAt)
					};
					return;
				}
				applyPreferences(decoded.preferences);
				appliedPreferenceState = getAppliedDataGridPreferenceState(decoded.preferences);
				suppressedPreferenceSnapshot = getPreferenceSnapshot();
			} else {
				restoreCodeDefaults(false);
				suppressedPreferenceSnapshot = getPreferenceSnapshot();
			}
		};
		const onPageHide = () => flushPreferences();
		window.addEventListener('storage', onStorage);
		window.addEventListener('pagehide', onPageHide);
		return () => {
			flushPreferences();
			window.removeEventListener('storage', onStorage);
			window.removeEventListener('pagehide', onPageHide);
		};
	});

	$effect(() => {
		if (!preferencesKey || !preferencesReady || typeof window === 'undefined') return;
		const snapshot = getPreferenceSnapshot();
		if (suppressedPreferenceSnapshot === snapshot) {
			suppressedPreferenceSnapshot = null;
			return;
		}
		const serialized = JSON.stringify({ ...JSON.parse(snapshot), updatedAt: Date.now() });
		latestPreferenceValue = serialized;
		if (preferenceWriteTimer) clearTimeout(preferenceWriteTimer);
		preferenceWriteTimer = setTimeout(
			flushPreferences,
			persistence?.debounceMs ?? DEBOUNCE_DELAY.preferences
		);
	});

	// Cell state
	let focusedCell = $state<CellPosition | null>(null);
	let editingCell = $state<CellPosition | null>(null);
	let editingSession: { rowId: string; columnId: string; value: unknown } | null = null;
	const cancelledCellKeys = new SvelteSet<string>();
	// Shared by rendering and metadata consumers; do not mirror selected keys in a second Set.
	const selectedCellsSet = new SvelteSet<string>();
	let selectionState = $state<SelectionState>({
		selectedCells: selectedCellsSet,
		selectionRange: null,
		isSelecting: false
	});
	// SvelteSet for fine-grained reactivity on cell selection
	// Cells can call selectedCellsSet.has(key) in $derived for proper Svelte tracking

	// Track the anchor cell for shift+arrow range selection
	let selectionAnchor = $state<CellPosition | null>(null);

	// Context menu state
	let contextMenu = $state<ContextMenuState>({
		open: false,
		x: 0,
		y: 0
	});

	// Paste dialog state
	let pasteDialog = $state<PasteDialogState>({
		open: false,
		rowsNeeded: 0,
		clipboardText: ''
	});

	// SvelteSet for O(1) reactive error match lookups
	const hasErrorMatchSet = new SvelteSet<string>();

	// Search state
	let searchOpen = $state(false);
	let searchQuery = $state('');
	let searchMatches = $state<CellPosition[]>([]);
	let matchIndex = $state(0);

	// SvelteSet for O(1) reactive search match lookups
	const searchMatchSet = new SvelteSet<string>();

	// Helper to sync SvelteSet with regular Set for selection
	function syncSelectedCellsSet(newCells: Set<string>) {
		selectedCellsSet.clear();
		for (const key of newCells) {
			selectedCellsSet.add(key);
		}
	}

	// Track last clicked row for shift-click selection
	let lastClickedRowIndex = $state<number | null>(null);

	// Virtualizer state
	let virtualItems = $state<VirtualItem[]>([]);
	let totalSize = $state(0);
	let isScrolling = $state(false);

	// ========================================
	// Derived values (declared later after table is created)
	// ========================================

	// ========================================
	// Helper Functions
	// ========================================

	function getNavigableColumns() {
		return table
			.getAllColumns()
			.filter(
				(col) =>
					col.getIsVisible() &&
					col.columnDef.meta?.navigable !== false &&
					col.columnDef.meta?.cell?.variant !== 'row-select'
			);
	}

	function getFirstNavigableColumnId(): string | null {
		const cols = getNavigableColumns();
		return cols[0]?.id ?? null;
	}

	function getLastNavigableColumnId(): string | null {
		const cols = getNavigableColumns();
		return cols[cols.length - 1]?.id ?? null;
	}

	function getTabTarget(
		rowIndex: number,
		columnId: string,
		direction: 'left' | 'right'
	): CellPosition | null {
		const rows = table.getRowModel().rows;
		const columns = getNavigableColumns();
		const columnIndex = columns.findIndex((column) => column.id === columnId);
		if (columnIndex < 0 || rows.length === 0) return null;

		if (direction === 'right') {
			const nextColumn = columns[columnIndex + 1];
			if (nextColumn) return getCellPosition(rowIndex, nextColumn.id);
			const firstColumn = columns[0];
			return rowIndex < rows.length - 1 && firstColumn
				? getCellPosition(rowIndex + 1, firstColumn.id)
				: null;
		}

		const previousColumn = columns[columnIndex - 1];
		if (previousColumn) return getCellPosition(rowIndex, previousColumn.id);
		const lastColumn = columns.at(-1);
		return rowIndex > 0 && lastColumn ? getCellPosition(rowIndex - 1, lastColumn.id) : null;
	}

	function resolvePosition(position: CellPosition): CellPosition | null {
		const rows = table.getRowModel().rows;
		const rowIndex = position.rowId
			? rows.findIndex((row) => row.id === position.rowId)
			: position.rowIndex;
		return rowIndex >= 0 && rows[rowIndex]
			? { rowIndex, rowId: rows[rowIndex].id, columnId: position.columnId }
			: null;
	}

	function getNextNavigableColumnId(
		currentColumnId: string,
		direction: 'left' | 'right'
	): string | null {
		const cols = getNavigableColumns();
		const currentIndex = cols.findIndex((col) => col.id === currentColumnId);
		if (currentIndex === -1) return null;

		const nextIndex = direction === 'right' ? currentIndex + 1 : currentIndex - 1;
		return cols[nextIndex]?.id ?? null;
	}

	function getIsCellSelected(rowIndex: number, columnId: string): boolean {
		return selectedCellsSet.has(
			getCellKey(getCellPosition(rowIndex, columnId).rowId ?? rowIndex, columnId)
		);
	}

	function getIsSearchMatch(rowIndex: number, columnId: string): boolean {
		// O(1) lookup using the derived Set instead of O(n) .some()
		return searchMatchSet.has(getCellKey(rowIndex, columnId));
	}

	function getIsActiveSearchMatch(rowIndex: number, columnId: string): boolean {
		const activeMatch = searchMatches[matchIndex];
		return activeMatch?.rowIndex === rowIndex && activeMatch?.columnId === columnId;
	}

	function getIsCellReadOnly(rowIndex: number, columnId: string): boolean {
		if (readOnly) return true;
		const column = table.getColumn(columnId);
		const cellMeta = column?.columnDef?.meta;
		if (cellMeta?.readOnly) return true;
		return false;
	}

	// ========================================
	// Cell Focus & Navigation
	// ========================================

	function focusCell(rowIndex: number, columnId: string, opts?: { keepAnchor?: boolean }) {
		const position = getCellPosition(rowIndex, columnId);
		focusedCell = position;

		const cellKey = getCellKey(position.rowId ?? rowIndex, columnId);

		// Clear selection when focusing new cell (unless holding shift or explicitly keeping anchor)
		if (!selectionState.isSelecting && !opts?.keepAnchor) {
			const newCells = new SvelteSet([cellKey]);
			syncSelectedCellsSet(newCells);
			selectionState = {
				selectedCells: selectedCellsSet,
				selectionRange: null,
				isSelecting: false
			};
			// Set anchor to the newly focused cell
			selectionAnchor = position;
		}

		// Scroll to row if needed (for virtualization)
		if (virtualizer) {
			virtualizer.scrollToIndex(rowIndex, { align: 'auto' });
		}

		// Focus the cell element - use multiple attempts to handle virtualization
		const attemptFocus = (attempts = 0) => {
			const cellElement = cellMapRef.get(cellKey);
			if (cellElement) {
				cellElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
				cellElement.focus();
			} else if (attempts < 3) {
				// Retry if cell not in DOM yet (virtualization)
				requestAnimationFrame(() => attemptFocus(attempts + 1));
			}
		};

		// Start first attempt immediately, then use RAF for subsequent attempts
		requestAnimationFrame(() => attemptFocus());
	}

	function blurCell() {
		focusedCell = null;
		editingCell = null;
	}

	function navigateCell(direction: NavigationDirection) {
		if (!focusedCell) return;

		const rows = table.getRowModel().rows;
		const current = resolvePosition(focusedCell);
		if (!current) return;
		const { rowIndex, columnId } = current;

		let newRowIndex = rowIndex;
		let newColumnId: string | null = columnId;

		switch (direction) {
			case 'up':
				newRowIndex = Math.max(0, rowIndex - 1);
				break;
			case 'down':
				newRowIndex = Math.min(rows.length - 1, rowIndex + 1);
				break;
			case 'left': {
				const prevCol = getNextNavigableColumnId(columnId, 'left');
				if (prevCol) {
					newColumnId = prevCol;
				} else if (rowIndex > 0) {
					// Wrap to end of previous row
					newRowIndex = rowIndex - 1;
					newColumnId = getLastNavigableColumnId();
				}
				break;
			}
			case 'right': {
				const nextCol = getNextNavigableColumnId(columnId, 'right');
				if (nextCol) {
					newColumnId = nextCol;
				} else if (rowIndex < rows.length - 1) {
					// Wrap to beginning of next row
					newRowIndex = rowIndex + 1;
					newColumnId = getFirstNavigableColumnId();
				}
				break;
			}
			case 'home':
				newColumnId = getFirstNavigableColumnId();
				break;
			case 'end':
				newColumnId = getLastNavigableColumnId();
				break;
			case 'ctrl+home':
				newRowIndex = 0;
				newColumnId = getFirstNavigableColumnId();
				break;
			case 'ctrl+end':
				newRowIndex = rows.length - 1;
				newColumnId = getLastNavigableColumnId();
				break;
			case 'pageup':
				newRowIndex = Math.max(0, rowIndex - 10);
				break;
			case 'pagedown':
				newRowIndex = Math.min(rows.length - 1, rowIndex + 10);
				break;
		}

		if (newColumnId && (newRowIndex !== rowIndex || newColumnId !== columnId)) {
			focusCell(newRowIndex, newColumnId);
		}
	}

	// ========================================
	// Cell Editing
	// ========================================

	function startEditing(rowIndex: number, columnId: string) {
		if (getIsCellReadOnly(rowIndex, columnId)) return;
		const position = getCellPosition(rowIndex, columnId);
		if (!position.rowId) return;
		const key = encodeCellKey(position.rowId, columnId);
		const row = table.getRowModel().rows[rowIndex];
		const value = cellValueMap.has(key) ? cellValueMap.get(key) : row?.getValue(columnId);
		editingSession = {
			rowId: position.rowId,
			columnId,
			value: cloneEditValue(value)
		};
		editingCell = position;
	}

	function stopEditing(opts?: { direction?: NavigationDirection; moveToNextRow?: boolean }) {
		editingCell = null;
		editingSession = null;

		if (opts?.direction) {
			navigateCell(opts.direction);
		} else if (opts?.moveToNextRow && focusedCell) {
			navigateCell('down');
		}
	}

	function cancelEditing() {
		const session = editingSession;
		if (!session) {
			editingCell = null;
			return;
		}
		const key = encodeCellKey(session.rowId, session.columnId);
		const row = table.getRowModel().rows.find((item) => item.id === session.rowId);
		const currentValue = cellValueMap.has(key)
			? cellValueMap.get(key)
			: row?.getValue(session.columnId);
		cancelledCellKeys.add(key);
		if (!areEditValuesEqual(currentValue, session.value) && row) {
			handleDataUpdate(
				{
					rowIndex: row.index,
					rowId: session.rowId,
					columnId: session.columnId,
					value: cloneEditValue(session.value)
				},
				true
			);
		}
		editingCell = null;
		editingSession = null;
		setTimeout(() => cancelledCellKeys.delete(key), 0);
	}

	// ========================================
	// Cell Selection
	// ========================================

	function selectCell(rowIndex: number, columnId: string, event?: MouseEvent) {
		const cellKey = getCellKey(getCellPosition(rowIndex, columnId).rowId ?? rowIndex, columnId);

		if (event?.ctrlKey || event?.metaKey) {
			// Toggle selection
			const newSelected = new SvelteSet(selectionState.selectedCells);
			if (newSelected.has(cellKey)) {
				newSelected.delete(cellKey);
			} else {
				newSelected.add(cellKey);
			}
			syncSelectedCellsSet(newSelected);
			selectionState = {
				...selectionState,
				selectedCells: selectedCellsSet
			};
		} else if (event?.shiftKey && focusedCell) {
			// Range selection
			selectRange(focusedCell, getCellPosition(rowIndex, columnId));
		} else {
			// Single selection
			const newCells = new SvelteSet([cellKey]);
			syncSelectedCellsSet(newCells);
			selectionState = {
				selectedCells: selectedCellsSet,
				selectionRange: null,
				isSelecting: false
			};
		}

		focusCell(rowIndex, columnId);
	}

	function selectRange(start: CellPosition, end: CellPosition, keepSelecting = false) {
		const resolvedStart = resolvePosition(start);
		const resolvedEnd = resolvePosition(end);
		if (!resolvedStart || !resolvedEnd) return;
		start = resolvedStart;
		end = resolvedEnd;
		const cols = getNavigableColumns();
		const startColIndex = cols.findIndex((c) => c.id === start.columnId);
		const endColIndex = cols.findIndex((c) => c.id === end.columnId);

		const minRow = Math.min(start.rowIndex, end.rowIndex);
		const maxRow = Math.max(start.rowIndex, end.rowIndex);
		const minCol = Math.min(startColIndex, endColIndex);
		const maxCol = Math.max(startColIndex, endColIndex);

		const newSelected = new SvelteSet<string>();
		for (let row = minRow; row <= maxRow; row++) {
			for (let col = minCol; col <= maxCol; col++) {
				const colId = cols[col]?.id;
				if (colId) {
					newSelected.add(getCellKey(row, colId));
				}
			}
		}

		syncSelectedCellsSet(newSelected);
		selectionState = {
			selectedCells: selectedCellsSet,
			selectionRange: { start, end },
			isSelecting: keepSelecting ? selectionState.isSelecting : false
		};
	}

	function selectAll() {
		const rows = table.getRowModel().rows;
		const cols = getNavigableColumns();
		const newSelected = new SvelteSet<string>();

		for (let row = 0; row < rows.length; row++) {
			for (const col of cols) {
				newSelected.add(getCellKey(row, col.id));
			}
		}

		syncSelectedCellsSet(newSelected);
		selectionState = {
			selectedCells: selectedCellsSet,
			selectionRange: null,
			isSelecting: false
		};
	}

	function clearSelection() {
		const newCells = new SvelteSet<string>();
		syncSelectedCellsSet(newCells);
		selectionState = {
			selectedCells: selectedCellsSet,
			selectionRange: null,
			isSelecting: false
		};
		blurCell();
	}

	// ========================================
	// Mouse Selection (Drag)
	// ========================================

	function onCellMouseDown(rowIndex: number, columnId: string, event: MouseEvent) {
		if (event.button !== 0) return; // Only left click

		// Set selection anchor for drag selection
		const cellKey = getCellKey(getCellPosition(rowIndex, columnId).rowId ?? rowIndex, columnId);

		if (event.ctrlKey || event.metaKey) {
			// Toggle selection - don't start drag, keep anchor
			const newSelected = new SvelteSet(selectionState.selectedCells);
			if (newSelected.has(cellKey)) {
				newSelected.delete(cellKey);
			} else {
				newSelected.add(cellKey);
			}
			syncSelectedCellsSet(newSelected);
			selectionState = {
				...selectionState,
				selectedCells: selectedCellsSet,
				isSelecting: false
			};
			// Update focused cell but keep anchor for future shift-clicks
			focusedCell = getCellPosition(rowIndex, columnId);
			scrollAndFocusCell(rowIndex, columnId);
		} else if (event.shiftKey && (selectionAnchor || focusedCell)) {
			// Range selection from anchor (or focused cell if no anchor) to this cell
			const anchor = selectionAnchor || focusedCell!;
			selectRange(anchor, getCellPosition(rowIndex, columnId));
			selectionState = { ...selectionState, isSelecting: false };
			// Update focused cell but keep anchor for future shift-clicks
			focusedCell = getCellPosition(rowIndex, columnId);
			scrollAndFocusCell(rowIndex, columnId);
		} else {
			// Start drag selection - set this cell as anchor
			const newCells = new SvelteSet([cellKey]);
			syncSelectedCellsSet(newCells);
			selectionState = {
				selectedCells: selectedCellsSet,
				selectionRange: null,
				isSelecting: true
			};
			selectionAnchor = getCellPosition(rowIndex, columnId);
			focusCell(rowIndex, columnId);
		}
	}

	// Helper to scroll to cell and focus it without changing selection anchor
	function scrollAndFocusCell(rowIndex: number, columnId: string) {
		const cellKey = getCellKey(getCellPosition(rowIndex, columnId).rowId ?? rowIndex, columnId);

		// Scroll to row if needed (for virtualization)
		if (virtualizer) {
			virtualizer.scrollToIndex(rowIndex, { align: 'auto' });
		}

		// Focus the cell element
		requestAnimationFrame(() => {
			const cellElement = cellMapRef.get(cellKey);
			if (cellElement) {
				cellElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
				cellElement.focus();
			}
		});
	}

	function onCellMouseEnter(rowIndex: number, columnId: string, event: MouseEvent) {
		if (!selectionState.isSelecting || !selectionAnchor) return;

		// Extend selection from anchor to current cell, keeping isSelecting true
		selectRange(selectionAnchor, getCellPosition(rowIndex, columnId), true);
	}

	function onCellMouseUp() {
		selectionState = { ...selectionState, isSelecting: false };
	}

	// ========================================
	// Clipboard Operations
	// ========================================

	async function copySelectedCells(
		selectedCellKeys: ReadonlySet<string> = selectionState.selectedCells,
		valueSnapshots?: ReadonlyMap<string, { value: unknown }>
	): Promise<boolean> {
		if (selectedCellKeys.size === 0) return false;

		const rows = table.getRowModel().rows;
		const cols = getNavigableColumns();

		// Get bounds of selection
		let minRow = Infinity,
			maxRow = -Infinity;
		let minCol = Infinity,
			maxCol = -Infinity;

		for (const cellKey of selectedCellKeys) {
			const { rowIndex, columnId } = parseCellKey(cellKey);
			const colIndex = cols.findIndex((c) => c.id === columnId);
			if (colIndex >= 0) {
				minRow = Math.min(minRow, rowIndex);
				maxRow = Math.max(maxRow, rowIndex);
				minCol = Math.min(minCol, colIndex);
				maxCol = Math.max(maxCol, colIndex);
			}
		}

		// Build TSV string
		const lines: string[] = [];
		for (let row = minRow; row <= maxRow; row++) {
			const rowData = rows[row];
			if (!rowData) continue;

			const cells: string[] = [];
			for (let col = minCol; col <= maxCol; col++) {
				const column = cols[col];
				if (!column) continue;
				const colId = column.id;

				const cellKey = getCellKey(row, colId);
				if (selectedCellKeys.has(cellKey)) {
					const capturedValue = valueSnapshots?.get(cellKey)?.value;
					const cachedValue = cellValueMap.get(cellKey);
					const value = valueSnapshots?.has(cellKey)
						? capturedValue
						: cellValueMap.has(cellKey)
							? cachedValue
							: rowData.getValue(colId);
					const serialize = column.columnDef.meta?.clipboard?.serialize;
					cells.push(serialize ? serialize(value, rowData.original) : serializeCellValue(value));
				} else {
					cells.push('');
				}
			}
			lines.push(cells.join('\t'));
		}

		const text = lines.join('\n');
		try {
			await navigator.clipboard.writeText(text);
			const cellCount = selectedCellKeys.size;
			toast.success(`${cellCount} cell${cellCount !== 1 ? 's' : ''} copied`);
			return true;
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to copy to clipboard');
			return false;
		}
	}

	async function cutSelectedCells() {
		const selectedCellKeys = snapshotCellKeys(selectionState.selectedCells);
		const mutationSnapshots = snapshotCellMutations(selectedCellKeys, (cellKey) => {
			const { rowIndex, rowId, columnId } = parseCellKey(cellKey);
			if (!rowId || getIsCellReadOnly(rowIndex, columnId)) return undefined;
			return getCellMutationSnapshot(rowId, columnId);
		});
		if (mutationSnapshots.size === 0) return;

		if (!(await copySelectedCells(selectedCellKeys, mutationSnapshots))) return;
		await clearSelectedCells(selectedCellKeys, mutationSnapshots);
	}

	async function pasteFromClipboard() {
		if (readOnly || !enablePaste) return;

		try {
			const text = await navigator.clipboard.readText();
			if (text.length === 0) return;

			const rows = table.getRowModel().rows;
			const cols = getNavigableColumns();

			// Parse clipboard as TSV
			const lines = parseClipboardRows(text);

			// Determine paste target
			const startPos = resolvePosition(focusedCell || getCellPosition(0, cols[0]?.id || ''));
			if (!startPos) return;
			const startColIndex = cols.findIndex((c) => c.id === startPos.columnId);

			// Check if we need more rows
			const rowsNeeded = startPos.rowIndex + lines.length - rows.length;

			if (rowsNeeded > 0 && resolvedOnRowsAdd) {
				pasteDialog = {
					open: true,
					rowsNeeded,
					clipboardText: text
				};
				return;
			}

			// Perform paste
			performPaste(text, startPos, startColIndex);
		} catch {
			// Clipboard access denied
		}
	}

	function performPaste(
		text: string,
		startPos: CellPosition,
		startColIndex: number,
		targetRowIds?: readonly string[]
	) {
		const rows = table.getRowModel().rows;
		const cols = getNavigableColumns();
		const lines = parseClipboardRows(text);

		const updates: UpdateCell[] = [];

		for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
			const line = lines[lineIdx];
			if (!line) continue;

			const rowIndex = targetRowIds
				? rows.findIndex((row) => row.id === targetRowIds[lineIdx])
				: startPos.rowIndex + lineIdx;
			if (rowIndex < 0 || rowIndex >= rows.length) break;
			const targetRow = rows[rowIndex];
			if (!targetRow) break;

			for (let cellIdx = 0; cellIdx < line.length; cellIdx++) {
				const colIndex = startColIndex + cellIdx;
				const col = cols[colIndex];
				if (!col) break;

				const textValue = line[cellIdx] ?? '';
				const value = col.columnDef.meta?.clipboard?.parse
					? col.columnDef.meta.clipboard.parse(textValue, targetRow.original)
					: parseCellValue(textValue, col.columnDef.meta?.cell?.variant);
				updates.push({ rowIndex, rowId: targetRow.id, columnId: col.id, value });
			}
		}

		if (updates.length > 0) {
			const editableUpdates = updates.filter(
				(update) => !getIsCellReadOnly(update.rowIndex, update.columnId)
			);
			if (editableUpdates.length === 0) return;

			handleDataUpdate(editableUpdates);
			onPaste?.(editableUpdates);

			toast.success(
				`${editableUpdates.length} cell${editableUpdates.length !== 1 ? 's' : ''} pasted`
			);
		}
	}

	// ========================================
	// Delete/Clear Operations
	// ========================================

	async function clearSelectedCells(
		selectedCellKeys: ReadonlySet<string> = selectionState.selectedCells,
		expectedSnapshots?: ReadonlyMap<string, { generation: number; value: unknown }>
	): Promise<DataGridClearResult> {
		const emptyResult = {
			clearedCellCount: 0,
			failedCellCount: 0,
			deletedMediaCount: 0,
			retainedMediaCount: 0,
			failedMediaCount: 0
		};
		if (readOnly) return emptyResult;

		type ClearContext = {
			rowIndex: number;
			rowId: string;
			columnId: string;
			row: TData;
			update: UpdateCell;
			snapshot: { generation: number; value: unknown };
		};
		const cells: Array<{ key: string; value: unknown; context: ClearContext }> = [];
		const rows = table.getRowModel().rows;
		for (const cellKey of selectedCellKeys) {
			const { rowId, columnId } = parseCellKey(cellKey);
			if (!rowId) continue;
			const rowIndex = rows.findIndex((item) => item.id === rowId);
			if (rowIndex < 0 || getIsCellReadOnly(rowIndex, columnId)) continue;
			const row = rows[rowIndex];
			if (!row) continue;
			const meta = table.getColumn(columnId)?.columnDef.meta;
			const isFileCell = meta?.cell?.variant === 'file' || meta?.cell?.variant === 'file-or-url';
			const emptyValue = isFileCell
				? null
				: typeof meta?.clipboard?.emptyValue === 'function'
					? meta.clipboard.emptyValue(row.original)
					: (meta?.clipboard?.emptyValue ?? getEmptyCellValue(meta?.cell?.variant));
			const update = { rowIndex, rowId, columnId, value: emptyValue };
			const snapshot = expectedSnapshots?.get(cellKey) ?? getCellMutationSnapshot(rowId, columnId);
			if (!snapshot) continue;
			const value = cloneEditValue(snapshot.value);
			cells.push({
				key: cellKey,
				value: isFileCell ? value : null,
				context: {
					rowIndex,
					rowId,
					columnId,
					row: row.original,
					update,
					snapshot
				}
			});
		}

		const mediaResult = await clearCellMedia(
			cells,
			async ({ key, context }) => {
				const result = await handleDataUpdate(
					context.update,
					false,
					new SvelteMap([[key, context.snapshot]]),
					true
				);
				const mutation = result[0];
				return {
					success: mutation?.success === true && !mutation.superseded,
					generation: mutation?.generation ?? context.snapshot.generation
				};
			},
			({ context }, generation) =>
				isAcknowledgedNullClearCurrent(
					generation,
					getCellMutationSnapshot(context.rowId, context.columnId)
				),
			async (file, context) => {
				if (onFilesDelete) {
					await onFilesDelete({
						fileIds: [file.id],
						rowIndex: context.rowIndex,
						rowId: context.rowId,
						columnId: context.columnId,
						row: context.row
					});
					return 'deleted';
				}

				const response = await fetch(
					`/api/media/${encodeURIComponent(file.collection)}/${encodeURIComponent(file.filename)}`,
					{ method: 'DELETE' }
				);
				if (response.status === 409) return 'retained';
				if (!response.ok) throw new Error(`Failed to delete ${file.filename}`);
				return 'deleted';
			}
		);

		return {
			clearedCellCount: mediaResult.successfulCellKeys.size,
			failedCellCount: mediaResult.failedCellKeys.size,
			deletedMediaCount: mediaResult.deletedMediaCount,
			retainedMediaCount: mediaResult.retainedMediaCount,
			failedMediaCount: mediaResult.failedMediaCount
		};
	}

	async function deleteRows(rowIndices: number[]): Promise<DataGridDeleteResult> {
		if (!resolvedOnRowsDelete) return { deletedRowIds: [], failedRowIds: [] };
		const rows = table.getRowModel().rows;
		const selectedRows = rowIndices
			.map((rowIndex) => rows[rowIndex])
			.filter((row): row is NonNullable<typeof row> => Boolean(row));
		const rowIds = selectedRows.map((row) => row.id);
		const runDelete = () =>
			Promise.resolve(
				resolvedOnRowsDelete(
					selectedRows.map((row) => row.original),
					rowIndices
				)
			);
		const result =
			resolvedOnRowsDelete === defaultOnRowsDelete
				? await runDelete()
				: await sequenceRowMutation.sequenceKeys(
					rowIds.map((rowId) => rowIdentities.getSequenceKey(rowId)),
					runDelete
				);

		if (typeof result === 'object') return result;
		return result
			? { deletedRowIds: rowIds, failedRowIds: [] }
			: { deletedRowIds: [], failedRowIds: rowIds };
	}

	function getSelectedRowIndices(): number[] {
		const rows = table.getRowModel().rows;
		const rowIndexById = new SvelteMap(rows.map((row, index) => [row.id, index]));
		const selectedRowIndices = new SvelteSet<number>();

		for (const cellKey of selectionState.selectedCells) {
			const { rowId, rowIndex } = parseCellKey(cellKey);
			const currentRowIndex = rowId ? rowIndexById.get(rowId) : rowIndex;
			if (currentRowIndex !== undefined && rows[currentRowIndex]) {
				selectedRowIndices.add(currentRowIndex);
			}
		}

		return Array.from(selectedRowIndices).sort((a, b) => a - b);
	}

	async function deleteSelectedRows() {
		if (readOnly || !resolvedOnRowsDelete) return;

		const rowIndices = getSelectedRowIndices();
		if (rowIndices.length > 0) {
			const result = await deleteRows(rowIndices);
			if (result.deletedRowIds.length > 0) clearSelection();
		}
	}

	// ========================================
	// Errors
	// ========================================

	function highlightErrors(validated: CellPosition[], errors: CellPosition[]) {
		for (const { rowIndex, rowId, columnId } of validated) {
			hasErrorMatchSet.delete(
				rowId ? encodeCellKey(rowId, columnId) : getCellKey(rowIndex, columnId)
			);
		}
		for (const { rowIndex, rowId, columnId } of errors) {
			hasErrorMatchSet.add(rowId ? encodeCellKey(rowId, columnId) : getCellKey(rowIndex, columnId));
		}
	}

	function applyRowChangeResult(result: RowChangeResult | undefined) {
		if (!result) return;
		highlightErrors(result.validated ?? [], result.errors ?? []);
	}

	// ========================================
	// Search
	// ========================================

	function performSearch(query: string, scrollToFirstMatch = true) {
		if (!query.trim()) {
			searchMatches = [];
			searchMatchSet.clear();
			matchIndex = 0;
			return;
		}

		const rows = table.getRowModel().rows;
		const cols = getNavigableColumns();
		const matches: CellPosition[] = [];
		const lowerQuery = query.toLowerCase();

		// Clear set before building - we'll add during the same loop
		searchMatchSet.clear();

		for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
			const row = rows[rowIndex];
			if (!row) continue;

			for (const col of cols) {
				let value = row.getValue(col.id);
				if (value && typeof value === 'object') {
					if ('label' in value) value = value.label;
					else if ('default' in value || Language.English in value)
						value = translateLocalizedField(value as Translatable, UI.language);
				}

				const strValue = String(value ?? '').toLowerCase();
				if (strValue.includes(lowerQuery)) {
					const columnId = col.id;
					matches.push({ rowIndex, rowId: row.id, columnId });
					// Build Set in same loop - single pass
					searchMatchSet.add(getCellKey(rowIndex, columnId));
				}
			}
		}

		searchMatches = matches;
		matchIndex = matches.length > 0 ? 0 : 0;

		// Scroll to first match (like React version - just scroll, don't focus)
		if (scrollToFirstMatch && matches.length > 0 && matches[0]) {
			virtualizer?.scrollToIndex(matches[0].rowIndex, { align: 'center' });
		}
	}

	function navigateToNextMatch() {
		if (searchMatches.length === 0) return;

		const newIndex = (matchIndex + 1) % searchMatches.length;
		matchIndex = newIndex;

		const match = searchMatches[newIndex];
		if (match) {
			const resolved = resolvePosition(match);
			if (resolved) virtualizer?.scrollToIndex(resolved.rowIndex, { align: 'center' });
		}
	}

	function navigateToPrevMatch() {
		if (searchMatches.length === 0) return;

		const newIndex = (matchIndex - 1 + searchMatches.length) % searchMatches.length;
		matchIndex = newIndex;

		const match = searchMatches[newIndex];
		if (match) {
			const resolved = resolvePosition(match);
			if (resolved) virtualizer?.scrollToIndex(resolved.rowIndex, { align: 'center' });
		}
	}

	// ========================================
	// Context Menu
	// ========================================

	function onCellContextMenu(rowIndex: number, columnId: string, event: MouseEvent) {
		event.preventDefault();
		const row = table.getRowModel().rows[rowIndex];
		const isSelectedRow = !!row && !!rowSelection[row.id];

		// Preserve row selection on right-click so the selected row highlight stays visible.
		const cellKey = getCellKey(row?.id ?? rowIndex, columnId);
		if (!isSelectedRow && !selectionState.selectedCells.has(cellKey)) {
			selectCell(rowIndex, columnId);
		}

		contextMenu = {
			open: true,
			x: event.clientX,
			y: event.clientY,
			isSelectedRow
		};
	}

	// ========================================
	// Keyboard Handler
	// ========================================

	function handleKeyDown(event: KeyboardEvent) {
		// Search shortcut
		if ((event.ctrlKey || event.metaKey) && event.key === 'f' && enableSearch) {
			event.preventDefault();
			event.stopPropagation();
			searchOpen = !searchOpen;
			return;
		}

		// Copy
		if (!editingCell && (event.ctrlKey || event.metaKey) && event.key === 'c') {
			event.preventDefault();
			event.stopPropagation();
			copySelectedCells();
			return;
		}

		// Cut
		if (!editingCell && (event.ctrlKey || event.metaKey) && event.key === 'x') {
			event.preventDefault();
			event.stopPropagation();
			void cutSelectedCells();
			return;
		}

		// Paste
		if (!editingCell && (event.ctrlKey || event.metaKey) && event.key === 'v') {
			event.preventDefault();
			event.stopPropagation();
			pasteFromClipboard();
			return;
		}

		// Select all
		if (!editingCell && (event.ctrlKey || event.metaKey) && event.key === 'a') {
			event.preventDefault();
			event.stopPropagation();
			selectAll();
			return;
		}

		// Delete/Backspace
		if (event.key === 'Delete' || event.key === 'Backspace') {
			if (!editingCell) {
				event.preventDefault();
				event.stopPropagation();
				void clearSelectedCells();
				return;
			}
		}

		// Escape
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			if (editingCell) {
				cancelEditing();
			} else if (searchOpen) {
				searchOpen = false;
			} else {
				clearSelection();
			}
			return;
		}

		// Don't handle navigation while editing
		if (editingCell) return;

		// Row-selection checkboxes are removed from the tab order; Ctrl/Cmd+Space
		// keeps row selection available from the active roving gridcell.
		if (focusedCell && event.key === ' ' && (event.ctrlKey || event.metaKey)) {
			const current = resolvePosition(focusedCell);
			if (!current) return;
			event.preventDefault();
			event.stopPropagation();
			const selected = Boolean(rowSelection[current.rowId!]);
			meta.onRowSelect?.(current.rowIndex, !selected, event.shiftKey);
			return;
		}

		// Navigation
		const navigationMap: Record<string, NavigationDirection> = {
			ArrowUp: 'up',
			ArrowDown: 'down',
			ArrowLeft: 'left',
			ArrowRight: 'right',
			Home: event.ctrlKey || event.metaKey ? 'ctrl+home' : 'home',
			End: event.ctrlKey || event.metaKey ? 'ctrl+end' : 'end',
			PageUp: 'pageup',
			PageDown: 'pagedown'
		};

		const direction = navigationMap[event.key];
		if (direction) {
			event.preventDefault();
			event.stopPropagation();

			if (event.shiftKey && focusedCell) {
				// Extend selection from anchor
				const anchor = selectionAnchor || focusedCell;
				const newPos = getNavigationTarget(direction);
				if (newPos) {
					// Select range from anchor to new position
					selectRange(anchor, newPos);
					// Update focused cell position to the new position for continued shift-selection
					focusedCell = newPos;

					// Scroll to the new position
					if (virtualizer) {
						virtualizer.scrollToIndex(newPos.rowIndex, { align: 'auto' });
					}

					// Focus the cell element
					requestAnimationFrame(() => {
						const cellKey = getCellKey(newPos.rowIndex, newPos.columnId);
						const cellElement = cellMapRef.get(cellKey);
						if (cellElement) {
							cellElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
							cellElement.focus();
						}
					});
				}
			} else {
				navigateCell(direction);
			}
			return;
		}

		// Tab navigation
		if (event.key === 'Tab') {
			if (!focusedCell) return;
			const current = resolvePosition(focusedCell);
			if (!current) return;
			const target = getTabTarget(
				current.rowIndex,
				current.columnId,
				event.shiftKey ? 'left' : 'right'
			);
			if (!target) return;
			event.preventDefault();
			event.stopPropagation();
			focusCell(target.rowIndex, target.columnId);
			return;
		}

		// Enter to start editing or move down
		if (event.key === 'Enter' && focusedCell) {
			const current = resolvePosition(focusedCell);
			if (!current) return;
			event.preventDefault();
			event.stopPropagation();
			startEditing(current.rowIndex, current.columnId);
			return;
		}

		// F2 to start editing
		if (event.key === 'F2' && focusedCell) {
			const current = resolvePosition(focusedCell);
			if (!current) return;
			event.preventDefault();
			event.stopPropagation();
			startEditing(current.rowIndex, current.columnId);
			return;
		}

		// Typing starts editing
		if (
			focusedCell &&
			!getIsCellReadOnly(focusedCell.rowIndex, focusedCell.columnId) &&
			event.key.length === 1 &&
			!event.ctrlKey &&
			!event.metaKey
		) {
			const current = resolvePosition(focusedCell);
			if (current) startEditing(current.rowIndex, current.columnId);
		}
	}

	function getNavigationTarget(direction: NavigationDirection): CellPosition | null {
		if (!focusedCell) return null;

		const rows = table.getRowModel().rows;
		const current = resolvePosition(focusedCell);
		if (!current) return null;
		const { rowIndex, columnId } = current;

		let newRowIndex = rowIndex;
		let newColumnId: string | null = columnId;

		switch (direction) {
			case 'up':
				newRowIndex = Math.max(0, rowIndex - 1);
				break;
			case 'down':
				newRowIndex = Math.min(rows.length - 1, rowIndex + 1);
				break;
			case 'left':
				newColumnId = getNextNavigableColumnId(columnId, 'left');
				break;
			case 'right':
				newColumnId = getNextNavigableColumnId(columnId, 'right');
				break;
			case 'home':
				newColumnId = getFirstNavigableColumnId();
				break;
			case 'end':
				newColumnId = getLastNavigableColumnId();
				break;
			case 'ctrl+home':
				newRowIndex = 0;
				newColumnId = getFirstNavigableColumnId();
				break;
			case 'ctrl+end':
				newRowIndex = rows.length - 1;
				newColumnId = getLastNavigableColumnId();
				break;
			case 'pageup':
				newRowIndex = Math.max(0, rowIndex - 10);
				break;
			case 'pagedown':
				newRowIndex = Math.min(rows.length - 1, rowIndex + 10);
				break;
		}

		if (newColumnId) {
			return getCellPosition(newRowIndex, newColumnId);
		}
		return null;
	}

	// ========================================
	// Row Add Handler
	// ========================================

	async function handleRowAdd(event?: MouseEvent) {
		if (!resolvedOnRowAdd) return;

		const result = await resolvedOnRowAdd(event);
		if (result) {
			await tick();
			const rows = table.getRowModel().rows;
			const returnedRowId = 'rowIds' in result ? result.rowIds[0] : result.rowId;
			const fallbackRowIndex = 'rowIndex' in result ? result.rowIndex : undefined;
			const newRowIndex = returnedRowId
				? rows.findIndex((row) => row.id === returnedRowId)
				: (fallbackRowIndex ?? rows.length - 1);
			const newColumnId = getFirstNavigableColumnId();

			if (newColumnId && newRowIndex >= 0) {
				// Wait for table to update
				queueMicrotask(() => {
					focusCell(newRowIndex, newColumnId);
				});
			}
		}
		return result;
	}

	// ========================================
	// Data Update Handler
	// ========================================

	function handleDataUpdate(
		updates: UpdateCell | UpdateCell[],
		allowCancelledCell = false,
		expectedSnapshots?: ReadonlyMap<string, { generation: number; value: unknown }>,
		rollbackFailed = false
	): Promise<DataGridMutationResult[]> {
		const updateArray = Array.isArray(updates) ? updates : [updates];
		if (updateArray.length === 0) return Promise.resolve([]);
		const displayRows = table.getRowModel().rows;
		const sourceRows = getData();
		const nextRows = [...sourceRows];
		const resolvedUpdates: CellUpdate[] = [];
		const submitted: Array<VersionedCellUpdate<CellUpdate> & { key: string }> = [];
		const skippedResults: DataGridMutationResult[] = [];

		for (const update of updateArray) {
			const displayRow = update.rowId
				? displayRows.find((row) => row.id === update.rowId)
				: displayRows[update.rowIndex];
			if (!displayRow) continue;
			const displayRowIndex = displayRows.indexOf(displayRow);
			if (getIsCellReadOnly(displayRowIndex, update.columnId)) continue;
			const rowId = displayRow.id;
			const key = encodeCellKey(rowId, update.columnId);
			if (!allowCancelledCell && cancelledCellKeys.has(key)) continue;
			const expected = expectedSnapshots?.get(key);
			const effectiveValue = cellValueMap.has(key)
				? cellValueMap.get(key)
				: displayRow.getValue(update.columnId);
			if (
				expected &&
				!isCellMutationSnapshotCurrent(
					expected,
					cellMutationGeneration.get(key) ?? 0,
					effectiveValue,
					areEditValuesEqual
				)
			) {
				skippedResults.push({
					rowId,
					columnId: update.columnId,
					generation: cellMutationGeneration.get(key) ?? 0,
					success: false,
					superseded: true
				});
				continue;
			}
			const sourceIndex = sourceRows.findIndex((row, index) => getRowIdValue(row, index) === rowId);
			const previous = nextRows[sourceIndex];
			if (!previous) continue;
			const columnMeta = table.getColumn(update.columnId)?.columnDef.meta;
			const previousValue = displayRow.getValue(update.columnId);
			const nextRow = setImmutableValue(previous, update.columnId, update.value, columnMeta);
			carryRowId(previous, nextRow);
			nextRows[sourceIndex] = nextRow;

			const resolvedUpdate = { ...update, rowId, rowIndex: displayRowIndex };
			resolvedUpdates.push(resolvedUpdate);
			const generation = (cellMutationGeneration.get(key) ?? 0) + 1;
			cellMutationGeneration.set(key, generation);
			pendingCellMutations.set(key, {
				generation,
				previousValue: getEarliestPendingValue(pendingCellMutations.get(key), previousValue),
				update: resolvedUpdate
			});
			submitted.push({
				generation,
				previousValue: cloneEditValue(expected?.value ?? previousValue),
				update: resolvedUpdate,
				key
			});
			cellSaveStateMap.set(key, { status: resolvedOnRowChange ? 'saving' : 'idle' });
			cellValueMap.set(key, update.value);
		}

		if (resolvedUpdates.length === 0) return Promise.resolve(skippedResults);
		replaceData(nextRows);
		if (!resolvedOnRowChange) {
			return Promise.resolve([
				...skippedResults,
				...submitted.map(({ generation, update }) => ({
					rowId: update.rowId,
					columnId: update.columnId,
					generation,
					success: true,
					superseded: false
				}))
			]);
		}

		const mutation =
			resolvedOnRowChange === defaultOnRowChange
				? Promise.resolve(defaultOnRowChange(resolvedUpdates, { suppressToast: rollbackFailed }))
				: sequenceRowMutation.sequenceKeys(
					resolvedUpdates.map((update) => rowIdentities.getSequenceKey(update.rowId)),
					() => Promise.resolve(resolvedOnRowChange(resolvedUpdates))
				);
		return mutation
			.then((result) => {
				applyRowChangeResult(result);
				const failedPositions = result?.failed ?? result?.errors ?? [];
				const isFailed = (entry: (typeof submitted)[number]) =>
					failedPositions.some(
						(position) =>
							position.columnId === entry.update.columnId &&
							(position.rowId === entry.update.rowId ||
								position.rowId === rowIdentities.resolve(entry.update.rowId))
					);
				if (resolvedOnRowChange !== defaultOnRowChange) {
					for (const entry of submitted) {
						const pending = pendingCellMutations.get(entry.key);
						if (pending?.generation === cellMutationGeneration.get(entry.key)) {
							markCellSaved(entry.key);
							pendingCellMutations.delete(entry.key);
							cellValueMap.delete(entry.key);
						}
					}
				}
				if (rollbackFailed) {
					const failedEntries = submitted.filter(isFailed);
					accumulatedValidationUpdates = clearAccumulatedValidationUpdates(
						accumulatedValidationUpdates,
						failedEntries
					);
					for (const entry of failedEntries) {
						if (
							!shouldRestoreCellMutation(
								entry.generation,
								cellMutationGeneration.get(entry.key) ?? 0
							)
						)
							continue;
						pendingCellMutations.delete(entry.key);
						cellValueMap.delete(entry.key);
						replaceRowById(getReconciliationRowId(entry.update.rowId), (row) =>
							setImmutableValue(
								row,
								entry.update.columnId,
								entry.previousValue,
								table.getColumn(entry.update.columnId)?.columnDef.meta
							)
						);
					}
				}
				return [
					...skippedResults,
					...submitted.map((entry) => ({
						rowId: entry.update.rowId,
						columnId: entry.update.columnId,
						generation: entry.generation,
						success: !isFailed(entry),
						superseded: cellMutationGeneration.get(entry.key) !== entry.generation
					}))
				];
			})
			.catch((error: unknown) => {
				for (const entry of submitted) {
					const pending = pendingCellMutations.get(entry.key);
					if (!pending || pending.generation !== cellMutationGeneration.get(entry.key)) continue;
					cellSaveStateMap.set(entry.key, {
						status: 'error',
						error: error instanceof Error ? error.message : 'Failed to save cell'
					});
					pendingCellMutations.delete(entry.key);
					cellValueMap.delete(entry.key);
					replaceRowById(entry.update.rowId, (row) =>
						setImmutableValue(
							row,
							entry.update.columnId,
							rollbackFailed ? entry.previousValue : pending.previousValue,
							table.getColumn(entry.update.columnId)?.columnDef.meta
						)
					);
				}
				return [
					...skippedResults,
					...submitted.map((entry) => ({
						rowId: entry.update.rowId,
						columnId: entry.update.columnId,
						generation: entry.generation,
						success: false,
						superseded: cellMutationGeneration.get(entry.key) !== entry.generation
					}))
				];
			});
	}

	// ========================================
	// Create TanStack Table
	// ========================================

	// Initialize column sizing state from column definitions (only if not provided in initialState)
	$effect.pre(() => {
		if (Object.keys(columnSizing).length === 0) {
			const sizing: Record<string, number> = {};
			for (const col of columns) {
				if (col.size) {
					sizing[col.id as string] = col.size;
				}
			}
			if (Object.keys(sizing).length > 0) {
				columnSizing = sizing;
			}
		}
	});

	const preferencesController = {
		get enabled() {
			return persistenceEnabled;
		},
		get ready() {
			return preferencesReady;
		},
		get hasPreferences() {
			return hasPreferences;
		},
		reset: resetPreferences,
		get rowHeightRemeasureVersion() {
			return rowHeightRemeasureVersion;
		}
	};

	// Create a reactive meta object using getters so that components always get fresh values
	// This is critical - without getters, the meta values are captured at creation time and never update
	const meta = {
		get dataGridRef() {
			return dataGridRef;
		},
		get cellMapRef() {
			return cellMapRef;
		},
		get focusedCell() {
			return focusedCell;
		},
		get editingCell() {
			return editingCell;
		},
		get selectionState() {
			return selectionState;
		},
		get searchOpen() {
			return searchOpen;
		},
		get readOnly() {
			return readOnly;
		},
		get rowHeight() {
			return rowHeight;
		},
		get rowHeightRemeasureVersion() {
			return rowHeightRemeasureVersion;
		},
		get preferences() {
			return preferencesController;
		},
		get contextMenu() {
			return contextMenu;
		},
		get pasteDialog() {
			return pasteDialog;
		},
		getIsCellSelected,
		// Expose cellValueMap directly for fine-grained cell-level reactivity
		// Cells access map.get(key) inside $derived for proper Svelte tracking
		get cellValueMap() {
			return getCellValueMap();
		},
		cellSaveStateMap,
		getCellMutationSnapshot,
		// Expose SvelteSet directly for fine-grained cell selection reactivity
		// Cells can call selectedCellsSet.has(key) in $derived for proper Svelte tracking
		selectedCellsSet,
		// Expose SvelteSet directly for fine-grained reactivity
		// Cells can call searchMatchSet.has(key) directly in template
		searchMatchSet,
		// Expose SvelteSet directly for reactive error highlighting
		hasErrorMatchSet,
		get activeSearchMatch() {
			return searchMatches[matchIndex] ?? null;
		},
		// Keep functions for backwards compatibility
		getIsSearchMatch,
		getIsActiveSearchMatch,
		onRowHeightChange: (value: RowHeightValue) => {
			if (rowHeight !== value) rowHeightRemeasureVersion++;
			rowHeight = value;
		},
		onCellClick: selectCell,
		onCellDoubleClick: (ri: number, colId: string) => startEditing(ri, colId),
		onCellMouseDown,
		onCellMouseEnter,
		onCellMouseUp,
		onCellContextMenu,
		onCellEditingStart: startEditing,
		onCellEditingStop: stopEditing,
		onCellEditingCancel: cancelEditing,
		canNavigateToCell: (rowIndex: number, columnId: string, direction: 'left' | 'right') =>
			getTabTarget(rowIndex, columnId, direction) !== null,
		onDataUpdate: handleDataUpdate,
		onDataUpdateAwaited: (
			updates: UpdateCell | UpdateCell[],
			expectedSnapshots?: ReadonlyMap<string, { generation: number; value: unknown }>
		) => handleDataUpdate(updates, false, expectedSnapshots, true),
		onRowsDelete: deleteRows,
		onDownload: resolvedOnDownload
			? async () => {
				if (isDownloading) return;
				const selectedRows = getSelectedRows(table.getRowModel().rows, rowSelection);
				if (selectedRows.length === 0) return;

				isDownloading = true;
				try {
					const rowsToDownload = selectedRows.map(({ row }) => row.original);
					const rowIndices = selectedRows.map(({ rowIndex }) => rowIndex);
					if (resolvedOnDownload === defaultOnDownload) {
						await defaultOnDownload?.(rowsToDownload, rowIndices);
					} else {
						await resolvedOnDownload(rowsToDownload);
					}
				} catch (error) {
					toast.error(
						error instanceof Error ? error.message : 'Failed to download selected rows'
					);
				} finally {
					isDownloading = false;
				}
			}
			: undefined,
		getSelectedRowCount: () => getSelectedRows(table.getRowModel().rows, rowSelection).length,
		getIsDownloading: () => isDownloading,
		onCellsCopy: copySelectedCells,
		onCellsCut: cutSelectedCells,
		onCellsClear: clearSelectedCells,
		onFilesUpload,
		onFilesDelete,
		onRowSelect: (rowIndex: number, selected: boolean, shiftKey: boolean) => {
			const rows = table.getRowModel().rows;
			const currentRow = rows[rowIndex];
			if (!currentRow) return;

			let newRowSelection: RowSelectionState;

			if (shiftKey && lastClickedRowIndex !== null) {
				// Shift-click range selection
				const startIndex = Math.min(lastClickedRowIndex, rowIndex);
				const endIndex = Math.max(lastClickedRowIndex, rowIndex);

				newRowSelection = { ...rowSelection };
				for (let i = startIndex; i <= endIndex; i++) {
					const row = rows[i];
					if (row) {
						newRowSelection[row.id] = selected;
					}
				}
			} else {
				// Regular click
				newRowSelection = {
					...rowSelection,
					[currentRow.id]: selected
				};
			}

			// Update rowSelection state
			rowSelection = newRowSelection;

			// Also update selectionState.selectedCells to highlight all cells in selected rows
			// This matches the React behavior where selecting a row highlights the entire row
			const selectedRows = Object.keys(newRowSelection).filter((key) => newRowSelection[key]);
			const newSelectedCells = new SvelteSet<string>();
			const allColumnIds = table.getAllColumns().map((col) => col.id);

			for (const rowId of selectedRows) {
				if (!rows.some((row) => row.id === rowId)) continue;

				for (const columnId of allColumnIds) {
					newSelectedCells.add(encodeCellKey(rowId, columnId));
				}
			}

			syncSelectedCellsSet(newSelectedCells);
			selectionState = {
				selectedCells: selectedCellsSet,
				selectionRange: null,
				isSelecting: false
			};

			// Clear focused/editing cell when selecting rows
			focusedCell = null;
			editingCell = null;

			lastClickedRowIndex = rowIndex;
		},
		onContextMenuOpenChange: (open: boolean) => {
			contextMenu = { ...contextMenu, open };
		},
		onPasteDialogOpenChange: (open: boolean) => {
			pasteDialog = { ...pasteDialog, open };
		},
		onPasteWithExpansion: async () => {
			if (resolvedOnRowsAdd) {
				const cols = getNavigableColumns();
				const startPos = resolvePosition(focusedCell || getCellPosition(0, cols[0]?.id || ''));
				if (!startPos) return;
				const lines = parseClipboardRows(pasteDialog.clipboardText);
				const existingRowIds = table
					.getRowModel()
					.rows.slice(startPos.rowIndex, startPos.rowIndex + lines.length - pasteDialog.rowsNeeded)
					.map((row) => row.id);
				const created = await resolvedOnRowsAdd(pasteDialog.rowsNeeded);
				await tick();
				const targetRowIds = [...existingRowIds, ...created.rowIds];
				const visibleIds = new SvelteSet(table.getRowModel().rows.map((row) => row.id));
				if (
					targetRowIds.length !== lines.length ||
					targetRowIds.some((id) => !visibleIds.has(id))
				) {
					toast.error('Created rows are hidden by the active filter; paste was not applied');
					pasteDialog = { ...pasteDialog, open: false };
					return;
				}
				const startColIndex = cols.findIndex((c) => c.id === startPos.columnId);
				performPaste(pasteDialog.clipboardText, startPos, startColIndex, targetRowIds);
			}
			pasteDialog = { ...pasteDialog, open: false };
		},
		onPasteWithoutExpansion: () => {
			const cols = getNavigableColumns();
			const startPos = focusedCell || getCellPosition(0, cols[0]?.id || '');
			const startColIndex = cols.findIndex((c) => c.id === startPos.columnId);
			performPaste(pasteDialog.clipboardText, startPos, startColIndex);
			pasteDialog = { ...pasteDialog, open: false };
		}
	};

	// Create the base table options
	const baseTableOptions: TableOptionsResolved<TData> = {
		data: getData(),
		columns: normalizedColumns,
		getRowId: getRowIdValue,
		state: {
			sorting,
			columnFilters,
			rowSelection,
			columnPinning,
			columnVisibility,
			columnSizing,
			columnOrder,
			columnSizingInfo
		},
		onColumnOrderChange: (updater) => {
			columnOrder = typeof updater === 'function' ? updater(columnOrder) : updater;
			searchRevision++;
		},
		onColumnSizingChange: (updater) => {
			columnSizing = typeof updater === 'function' ? updater(columnSizing) : updater;
		},
		onColumnSizingInfoChange: (updater) => {
			columnSizingInfo = typeof updater === 'function' ? updater(columnSizingInfo) : updater;
		},
		onColumnPinningChange: (updater) => {
			columnPinning = typeof updater === 'function' ? updater(columnPinning) : updater;
			searchRevision++;
		},
		onColumnVisibilityChange: (updater) => {
			columnVisibility = typeof updater === 'function' ? updater(columnVisibility) : updater;
			searchRevision++;
			// No version counter needed - visibilityKey is derived from columnVisibility
			// and will automatically update when visibility changes
		},
		onSortingChange: (updater) => {
			sorting = typeof updater === 'function' ? updater(sorting) : updater;
			searchRevision++;
		},
		onColumnFiltersChange: (updater) => {
			columnFilters = typeof updater === 'function' ? updater(columnFilters) : updater;
			searchRevision++;
		},
		onRowSelectionChange: (updater) => {
			const newRowSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
			rowSelection = newRowSelection;

			// Also update selectionState.selectedCells to highlight all cells in selected rows
			// This matches the React behavior where selecting a row highlights the entire row
			const rows = table.getRowModel().rows;
			const selectedRows = Object.keys(newRowSelection).filter((key) => newRowSelection[key]);
			const newSelectedCells = new SvelteSet<string>();
			const allColumnIds = table.getAllColumns().map((col) => col.id);

			for (const rowId of selectedRows) {
				if (!rows.some((row) => row.id === rowId)) continue;

				for (const columnId of allColumnIds) {
					newSelectedCells.add(encodeCellKey(rowId, columnId));
				}
			}

			syncSelectedCellsSet(newSelectedCells);
			selectionState = {
				selectedCells: selectedCellsSet,
				selectionRange: null,
				isSelecting: false
			};

			// Clear focused/editing cell when selecting rows
			focusedCell = null;
			editingCell = null;
		},
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		columnResizeMode: 'onChange',
		enableColumnResizing: true,
		defaultColumn: {
			minSize: MIN_COLUMN_SIZE,
			maxSize: MAX_COLUMN_SIZE,
			size: DEFAULT_COLUMN_SIZE,
			sortUndefined: 'last'
		},
		enableRowSelection: true,
		enableColumnFilters: true,
		enableFilters: true,
		renderFallbackValue: null,
		onStateChange: () => { },
		mergeOptions: (
			defaultOptions: TableOptions<TData>,
			newOptions: Partial<TableOptions<TData>>
		) => {
			return { ...defaultOptions, ...newOptions };
		},
		meta
	};

	const table = createTable(baseTableOptions);

	// Create a subscriber to notify effects when table data changes
	// This is the key to making TanStack Table reactive in Svelte 5
	// When data comes from async sources (like database queries), the table needs
	// to notify consuming components that data has changed so they can re-render
	let notifyTableUpdate: () => void;
	const subscribeToTable = createSubscriber((update) => {
		notifyTableUpdate = update;
		return () => { };
	});

	// Track previous state to detect changes that require cache clearing
	let prevSorting = $state<SortingState>([]);
	let prevColumnFilters = $state<ColumnFiltersState>([]);
	let prevDataLength = $state<number>(0);
	let prevDataReference: TData[] | null = null;
	let prevColumnVisibility = $state<VisibilityState>({});
	let prevLanguage = $state(UI.language);

	// This is the key to reactivity: update table options in $effect.pre
	// whenever any of the state values change
	$effect.pre(() => {
		// Read all reactive state to create dependencies
		const currentState = {
			sorting,
			columnFilters,
			rowSelection,
			columnPinning,
			columnVisibility,
			columnSizing,
			columnOrder,
			columnSizingInfo
		};
		const sourceData = getSourceData();
		if (dataOverride && overrideBase && sourceData !== overrideBase) {
			dataOverride = null;
			overrideBase = null;
		}
		const currentData = getData();
		if (currentData !== prevDataReference) {
			prevDataReference = currentData;
			searchRevision++;
		}

		// Clear cell value cache when sorting, filtering, row count, or column visibility changes
		// This ensures cells show correct values after re-ordering, add/delete, or column show/hide
		const sortingChanged = sorting !== prevSorting;
		const filtersChanged = columnFilters !== prevColumnFilters;
		const dataLengthChanged = currentData.length !== prevDataLength;
		const visibilityChanged = columnVisibility !== prevColumnVisibility;
		const languageChanged = UI.language !== prevLanguage;

		if (sortingChanged || filtersChanged || dataLengthChanged || visibilityChanged) {
			clearCellValueCache();
			prevSorting = sorting;
			prevColumnFilters = columnFilters;
			prevDataLength = currentData.length;
			prevColumnVisibility = columnVisibility;
		}
		if (languageChanged) {
			prevLanguage = UI.language;
			searchRevision++;
		}

		// Update table with current state
		table.setOptions((prev) => ({
			...prev,
			// A new array identity forces TanStack to rebuild translated filter values.
			data: languageChanged ? [...currentData] : currentData,
			state: {
				...prev.state,
				...currentState
			},
			meta
		}));

		// Notify any subscribers that table data has changed
		// This triggers re-runs of effects/derived that called subscribeToTable()
		notifyTableUpdate?.();
	});

	$effect(() => {
		const query = searchQuery;
		const revision = searchRevision;
		if (!query) return;

		queueMicrotask(() => {
			if (searchQuery !== query || searchRevision !== revision) return;
			untrack(() => performSearch(query, false));
		});
	});

	// ========================================
	// Compute columnSizeVars (now that table exists)
	// ========================================

	// Compute column sizes based on columnSizing and columnSizingInfo state
	function getColumnSizeVars(): Record<string, number> {
		// Read both columnSizing and columnSizingInfo to create reactive dependencies
		// columnSizingInfo updates during resize drag, columnSizing updates on release
		const _ = columnSizing;
		const __ = columnSizingInfo;

		const vars: Record<string, number> = {};
		try {
			const headers = table.getFlatHeaders();
			for (const header of headers) {
				const size = header.getSize();
				vars[`--header-${header.id}-size`] = size;
				vars[`--col-${header.column.id}-size`] = size;
			}
		} catch {
			// Table not ready yet
		}
		return vars;
	}

	// ========================================
	// Create Virtualizer
	// ========================================

	let virtualizer: Virtualizer<HTMLDivElement, Element> | null = null;

	// Virtualizer onChange handler - called when scroll position or size changes
	function handleVirtualizerChange(instance: Virtualizer<HTMLDivElement, Element>) {
		virtualItems = instance.getVirtualItems();
		totalSize = instance.getTotalSize();
		isScrolling = instance.isScrolling;
	}

	// Effect to create virtualizer when ref becomes available
	$effect(() => {
		const ref = dataGridRef;
		if (!ref) return;

		// Only create virtualizer once
		if (virtualizer) return;

		// Use filtered row count, not raw data length
		const rowCount = untrack(() => table.getRowModel().rows.length);

		// measureElement for better accuracy (except Firefox which has issues)
		const isFirefox =
			typeof navigator !== 'undefined' && navigator.userAgent.indexOf('Firefox') !== -1;

		const instance = new Virtualizer<HTMLDivElement, Element>({
			count: rowCount,
			getScrollElement: () => ref,
			estimateSize: () => getRowHeightValue(untrack(() => rowHeight)),
			overscan,
			observeElementRect,
			observeElementOffset,
			scrollToFn: elementScroll,
			onChange: handleVirtualizerChange,
			measureElement: isFirefox ? undefined : (element) => element?.getBoundingClientRect().height
		});
		virtualizer = instance;
		const cleanup = instance._didMount();
		instance._willUpdate();
		handleVirtualizerChange(instance);

		return () => {
			cleanup();
			if (virtualizer === instance) virtualizer = null;
		};
	});

	// Separate effect to update virtualizer count when filtered rows change
	// Track columnFilters, sorting, and data to trigger updates
	$effect(() => {
		// Read these to create dependencies - when filters/sorting change, row count changes
		const _ = columnFilters;
		const __ = sorting;
		getData();
		const currentRowHeight = rowHeight;
		const remeasureVersion = rowHeightRemeasureVersion;

		// Get the filtered/sorted row count from the table
		const rowCount = table.getRowModel().rows.length;

		let cancelled = false;
		untrack(() => {
			const ref = dataGridRef;
			if (virtualizer && ref) {
				const prevCount = virtualizer.options.count;

				// measureElement for better accuracy (except Firefox which has issues)
				const isFirefox =
					typeof navigator !== 'undefined' && navigator.userAgent.indexOf('Firefox') !== -1;

				virtualizer.setOptions({
					count: rowCount,
					getScrollElement: () => ref,
					estimateSize: () => getRowHeightValue(currentRowHeight),
					overscan,
					observeElementRect,
					observeElementOffset,
					scrollToFn: elementScroll,
					onChange: handleVirtualizerChange,
					measureElement: isFirefox
						? undefined
						: (element) => element?.getBoundingClientRect().height
				});

				// virtual-core exposes these lifecycle hooks for framework adapters.
				virtualizer._willUpdate();

				// If rows were deleted and we're scrolled past the new content,
				// scroll to the last row to avoid gaps
				if (rowCount < prevCount && rowCount > 0) {
					const scrollEl = ref;
					const newTotalSize = virtualizer.getTotalSize();
					if (scrollEl.scrollTop > newTotalSize - scrollEl.clientHeight) {
						// Scroll to show the last rows
						virtualizer.scrollToIndex(rowCount - 1, { align: 'end' });
					}
				}

				void tick().then(() => {
					if (cancelled || remeasureVersion !== rowHeightRemeasureVersion || !virtualizer) return;
					virtualizer.measure();
					handleVirtualizerChange(virtualizer);
				});
			}
		});
		return () => {
			cancelled = true;
		};
	});

	// Setup keyboard handler on data grid element
	$effect(() => {
		if (dataGridRef) {
			dataGridRef.addEventListener('keydown', handleKeyDown);
			return () => {
				dataGridRef?.removeEventListener('keydown', handleKeyDown);
			};
		}
	});

	// Clear focused cell when clicking outside the data grid
	$effect(() => {
		function onDocumentPointerDown(event: PointerEvent) {
			const target = event.target;
			if (!(target instanceof Node)) return;

			const isInDataGrid = dataGridRef?.contains(target) ?? false;
			if (!editingCell && !isInDataGrid && focusedCell) {
				clearSelection();
			}
		}

		document.addEventListener('pointerdown', onDocumentPointerDown, true);
		return () => {
			document.removeEventListener('pointerdown', onDocumentPointerDown, true);
		};
	});

	// Global keyboard handler for search shortcut (Cmd+F / Ctrl+F)
	$effect(() => {
		if (!enableSearch) return;

		function onGlobalKeyDown(event: KeyboardEvent) {
			const target = event.target;
			if (!(target instanceof HTMLElement)) return;

			const { key, ctrlKey, metaKey, shiftKey } = event;
			const isCtrlPressed = ctrlKey || metaKey;

			// Handle Cmd+F / Ctrl+F for search
			if (isCtrlPressed && !shiftKey && key === 'f') {
				const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
				const isInDataGrid = dataGridRef?.contains(target) ?? false;
				const isInSearchInput = target.closest('[role="search"]') !== null;

				if (isInDataGrid || isInSearchInput || !isInInput) {
					event.preventDefault();
					event.stopPropagation();
					searchOpen = !searchOpen;

					if (!isInDataGrid && !isInSearchInput && dataGridRef) {
						requestAnimationFrame(() => {
							dataGridRef?.focus();
						});
					}
				}
			}
		}

		window.addEventListener('keydown', onGlobalKeyDown, true);
		return () => {
			window.removeEventListener('keydown', onGlobalKeyDown, true);
		};
	});

	// Auto-focus on mount
	$effect(() => {
		if (autoFocus && dataGridRef) {
			queueMicrotask(() => {
				dataGridRef?.focus();

				const firstColumnId = getFirstNavigableColumnId();
				if (firstColumnId) {
					if (typeof autoFocus === 'object') {
						focusCell(autoFocus.rowIndex ?? 0, autoFocus.columnId ?? firstColumnId);
					} else {
						focusCell(0, firstColumnId);
					}
				}
			});
		}
	});

	// ========================================
	// Create Search State (if enabled)
	// ========================================

	// Note: searchState is returned as a getter in the return object
	// This allows the consuming component to get fresh values each render

	// ========================================
	// Create Virtualizer Return Object
	// ========================================

	// Use getters to ensure reactivity is preserved when accessing from consuming components
	const rowVirtualizer: VirtualizerReturn = {
		// Reactive getters - these allow Svelte to track dependencies
		get virtualItems() {
			return virtualItems;
		},
		get totalSize() {
			return totalSize;
		},
		get isScrolling() {
			return isScrolling;
		},
		// Methods
		scrollToIndex: (index, options) => virtualizer?.scrollToIndex(index, options),
		measureElement: (element) => virtualizer?.measureElement(element),
		// Legacy function-based accessors (kept for compatibility)
		getVirtualItems: () => virtualItems,
		getTotalSize: () => totalSize
	};

	// ========================================
	// Return
	// ========================================

	// Create a reactive table wrapper that exposes state-dependent getters
	// This is key to making the table reactive in Svelte 5
	// We use subscribeToTable() to register effects as subscribers, so they
	// re-run when notifyTableUpdate() is called after data changes
	const reactiveTable = {
		// Expose all original table methods and properties
		...table,
		// Override methods that depend on state to create reactive dependencies
		getRowModel: () => {
			subscribeToTable();
			return table.getRowModel();
		},
		getHeaderGroups: () => {
			subscribeToTable();
			return table.getHeaderGroups();
		},
		getAllColumns: () => {
			subscribeToTable();
			return table.getAllColumns();
		},
		getVisibleLeafColumns: () => {
			subscribeToTable();
			return table.getVisibleLeafColumns();
		},
		getState: () => {
			subscribeToTable();
			return table.getState();
		},
		getColumn: (columnId: string) => {
			subscribeToTable();
			return table.getColumn(columnId);
		},
		// Forward all other methods to the original table
		setColumnFilters: table.setColumnFilters.bind(table),
		setSorting: table.setSorting.bind(table),
		setColumnPinning: table.setColumnPinning.bind(table),
		setColumnVisibility: table.setColumnVisibility.bind(table),
		setRowSelection: table.setRowSelection.bind(table),
		setColumnSizing: table.setColumnSizing.bind(table),
		setOptions: table.setOptions.bind(table),
		getFlatHeaders: () => {
			subscribeToTable();
			return table.getFlatHeaders();
		},
		getTotalSize: () => {
			subscribeToTable();
			return table.getTotalSize();
		},
		getLeftLeafColumns: () => {
			subscribeToTable();
			return table.getLeftLeafColumns();
		},
		getRightLeafColumns: () => {
			subscribeToTable();
			return table.getRightLeafColumns();
		},
		getCenterLeafColumns: () => {
			subscribeToTable();
			return table.getCenterLeafColumns();
		},
		getIsAllRowsSelected: () => {
			subscribeToTable();
			return table.getIsAllRowsSelected();
		},
		getIsSomeRowsSelected: () => {
			subscribeToTable();
			return table.getIsSomeRowsSelected();
		},
		getIsAllPageRowsSelected: () => {
			subscribeToTable();
			return table.getIsAllPageRowsSelected();
		},
		getIsSomePageRowsSelected: () => {
			subscribeToTable();
			return table.getIsSomePageRowsSelected();
		},
		toggleAllRowsSelected: table.toggleAllRowsSelected.bind(table),
		toggleAllPageRowsSelected: table.toggleAllPageRowsSelected.bind(table),
		// Keep table slug for any other property access
		_getDefaultColumnDef: table._getDefaultColumnDef.bind(table),
		get options() {
			subscribeToTable();
			return table.options;
		},
		initialState: table.initialState
	} as unknown as Table<TData>;

	// Search callbacks - these are stable slugs
	function handleSearchOpenChange(open: boolean) {
		searchOpen = open;
		if (!open) {
			searchQuery = '';
			searchMatches = [];
			searchMatchSet.clear();
			matchIndex = 0;
		}
	}

	function handleSearchQueryChange(query: string) {
		searchQuery = query;
	}

	return {
		get dataGridRef() {
			return dataGridRef;
		},
		get headerRef() {
			return headerRef;
		},
		rowMapRef,
		get footerRef() {
			return footerRef;
		},
		table: reactiveTable,
		rowVirtualizer,
		// Selection state is exposed through the reactive SvelteSet.
		selectedCellsSet,
		getRowSelection: () => rowSelection,
		// Search state with getters for reactive values
		searchState: enableSearch
			? {
				get searchMatches() {
					return searchMatches;
				},
				get matchIndex() {
					return matchIndex;
				},
				get searchOpen() {
					return searchOpen;
				},
				get searchQuery() {
					return searchQuery;
				},
				onSearchOpenChange: handleSearchOpenChange,
				onSearchQueryChange: handleSearchQueryChange,
				onSearch: performSearch,
				onNavigateToNextMatch: navigateToNextMatch,
				onNavigateToPrevMatch: navigateToPrevMatch
			}
			: undefined,
		get columnSizeVars() {
			return getColumnSizeVars();
		},
		preferences: preferencesController,
		status,
		onRowAdd: resolvedOnRowAdd ? handleRowAdd : undefined,
		setDataGridRef: (el: HTMLDivElement | null) => {
			dataGridRef = el;
		},
		setHeaderRef: (el: HTMLDivElement | null) => {
			headerRef = el;
		},
		setFooterRef: (el: HTMLDivElement | null) => {
			footerRef = el;
		}
	};
}

export { groupCellUpdates };

export const fileCellMediaToFileCellData = (media: Media | null): FileCellData[] => {
	if (!media) return [];
	const { collection, filename } = media;
	if (!filename?.length) return [];
	return [{ id: filename, collection, filename }];
};
