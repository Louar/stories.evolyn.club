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

import type {
	CellPosition,
	ContextMenuState,
	FileCellData,
	NavigationDirection,
	PasteDialogState,
	RowHeightValue,
	SearchState,
	SelectionState,
	UpdateCell
} from '$lib/components/data-grid/types/data-grid.js';
import { getCellKey, getRowHeightValue, parseCellKey } from '$lib/components/data-grid/types/data-grid.js';
import { Language, MediaCollection, translateLocalizedField, type Media, type Translatable } from '$lib/db/schemas/0-utils';
import { UI } from '$lib/states/ui.svelte';
import {
	createTable,
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	type ColumnDef,
	type ColumnFiltersState,
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
import { untrack } from 'svelte';
import { toast } from 'svelte-sonner';
import { SvelteMap, SvelteSet, createSubscriber } from 'svelte/reactivity';

// ============================================
// Types
// ============================================

export type CellUpdate = UpdateCell & { rowId?: string; };
type RowChangeResult = void | { validated?: CellPosition[], errors?: CellPosition[] };

export interface UploadMediaParams {
	collection: MediaCollection;
	files: File[];
	rowId: string;
	columnId: string;
	missionTemplateId: string;
	onDraftUpdate?: (rowId: string, columnId: string, fileCell: FileCellData[]) => void;
	onLatestUpload?: (rowId: string, columnId: string, media: Media) => void;
}

export const hasTranslatableFields = <TData extends RowData>(
	columns: ColumnDef<TData, unknown>[]
) => {
	return columns.some((c) =>
		['text-translated-short', 'text-translated-long'].includes(c.meta?.cell?.variant ?? '')
	)
};

export const uploadMedia = async ({
	collection: inputCollection,
	files,
	rowId,
	columnId,
	missionTemplateId,
}: UploadMediaParams): Promise<FileCellData[]> => {
	const file = files[0];
	if (!file) return [];
	const formData = new FormData();
	formData.set('file', file);
	const res = await fetch(
		`/api/media/${inputCollection}/${file.name.toLowerCase().replace(' ', '-')}?id=${missionTemplateId}`,
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

export interface UseDataGridOptions<TData extends RowData> {
	columns: ColumnDef<TData, unknown>[];
	/** Pass data as a getter function for reactivity: () => data */
	data: TData[] | (() => TData[]);
	/** API base path for default row handlers (e.g. /api/courses) */
	endpoint?: string;
	rowHeight?: RowHeightValue;
	autoFocus?: boolean | { rowIndex?: number; columnId?: string };
	enableColumnSelection?: boolean;
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
		rowSelection?: RowSelectionState;
	};
	onDataChange?: (data: TData[]) => void;
	onRowAdd?: (
		event?: MouseEvent
	) => Partial<CellPosition> | void | Promise<Partial<CellPosition> | void>;
	onRowsAdd?: (count: number) => void | Promise<void>;
	// onRowChange?: (originalRows: TData[], updatedRowIndices: number[], updates: CellUpdate[]) => void | Promise<void>;
	onRowChange?: (updates: CellUpdate[]) => RowChangeResult | Promise<RowChangeResult>;
	onRowsDelete?: (rows: TData[], rowIndices: number[]) => void | Promise<void>;
	onPaste?: (updates: UpdateCell[]) => void | Promise<void>;
	onFilesUpload?: (params: {
		files: File[];
		rowIndex: number;
		columnId: string;
		row: TData;
	}) => Promise<FileCellData[]>;
	onFilesDelete?: (params: {
		fileIds: string[];
		rowIndex: number;
		columnId: string;
		row: TData;
	}) => void | Promise<void>;
}

export interface UseDataGridReturn<TData extends RowData> {
	// Refs
	dataGridRef: HTMLDivElement | null;
	headerRef: HTMLDivElement | null;
	rowMapRef: Map<number, HTMLDivElement>;
	footerRef: HTMLDivElement | null;

	// Table instance
	table: Table<TData>;

	// Virtualizer
	rowVirtualizer: VirtualizerReturn;

	// Selection state - exposed as getters for use in $derived
	selectedCellsSet: SvelteSet<string>;
	selectionState: { readonly version: number };
	getSelectionVersion: () => number;

	// Row selection state - reactive for header checkbox
	getRowSelection: () => RowSelectionState;

	// Search state (if enabled)
	searchState?: SearchState;

	// Column size CSS variables
	columnSizeVars: Record<string, number>;

	// Row add handler
	onRowAdd?: (event?: MouseEvent) => Promise<void>;

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

const NON_NAVIGABLE_COLUMNS = new Set(['select-single', 'actions']);

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
		rowHeight: initialRowHeight = 'short',
		autoFocus = false,
		enableColumnSelection = false,
		enableSearch = true,
		enablePaste = true,
		readOnly = false,
		overscan = 3,
		getRowId,
		initialState,
		onDataChange,
		onRowAdd: onRowAddProp,
		onRowsAdd: onRowsAddProp,
		onRowChange: onRowChangeProp,
		onRowsDelete: onRowsDeleteProp,
		onPaste,
		onFilesUpload,
		onFilesDelete
	} = options;

	// Support both direct data array and getter function for reactivity
	// Using a getter function () => data allows Svelte 5 to track changes
	const getData = typeof dataProp === 'function' ? dataProp : () => dataProp;

	const setData = onDataChange;

	const getRowIdValue = (row: TData, index: number): string | null => {
		const id = getRowId?.(row, index) ?? (row as Record<string, unknown>)?.id;
		return typeof id === 'string' ? id : null;
	};

	const defaultOnRowAdd = endpoint
		? async () => {
			try {
				const res = await fetch(`${endpoint}`, { method: 'POST' });
				let newrow = {} as TData;
				if (res.ok) newrow = (await res.json()) as TData;
				const nextRows = [...getData(), newrow];
				setData?.(nextRows);

				return {
					rowIndex: nextRows.length - 1
				};
			} catch (error) {
				toast.error(error instanceof Error ? error.message : `Failed to add a row`, {
					closeButton: true,
					duration: Infinity
				});
			}
		}
		: undefined;

	const defaultOnRowsAdd = endpoint
		? async (count: number) => {
			try {
				const newrows = await Promise.all(
					Array.from({ length: count }, async () => {
						const res = await fetch(`${endpoint}`, { method: 'POST' });
						if (!res.ok) throw new Error(`Failed to add rows`);
						return (await res.json()) as TData;
					})
				);
				toast.success(`${newrows.length} row added`);
				setData?.([...getData(), ...newrows]);
			} catch (error) {
				toast.error(error instanceof Error ? error.message : `Failed to add rows`, {
					closeButton: true,
					duration: Infinity
				});
			}
		}
		: undefined;

	const defaultOnRowsDelete = endpoint
		? async (removedrows: TData[], rowIndices: number[]) => {
			const toRemoveSet = new SvelteSet(
				removedrows
					.map((row, index) => getRowIdValue(row, rowIndices[index] ?? index))
					.filter((id): id is string => Boolean(id))
			);
			const toRemove = Array.from(toRemoveSet);

			const wereRemoved = (
				await Promise.all(
					toRemove.map(async (id) => {
						const res = await fetch(`${endpoint}/${id}`, { method: 'DELETE' });
						return res.ok ? id : undefined;
					})
				)
			).filter((id): id is string => id !== undefined);

			if (toRemove.length !== wereRemoved.length)
				toast.error(`Some rows were not removed`, {
					closeButton: true,
					duration: Infinity
				});

			const nextRows = getData().filter((row, index) => {
				const id = getRowIdValue(row, index);
				return id ? !wereRemoved.includes(id) : !rowIndices.includes(index);
			});
			setData?.(nextRows);
		}
		: undefined;

	const defaultOnRowChange = endpoint
		? async (updates: CellUpdate[]) => {
			const patches = groupCellUpdates(updates);

			const pos = (rowIndex: number, columnIds: string[]) =>
				columnIds.map((columnId) => ({ rowIndex, columnId }));

			const results = await Promise.all(
				Object.entries(patches).map(async ([id, patch]) => {
					const rowIndex = patch.index;
					const columnIds = Object.keys(patch.data);

					try {
						let res: Response | undefined;
						if (id?.startsWith('new-')) {
							const rows = getData();
							const row = rows[patch.index];
							if (!row) return { validated: [], errors: [] as CellPosition[] };
							res = await fetch(`${endpoint}`, {
								method: 'POST',
								body: JSON.stringify(row)
							});
							if (res.ok) {
								const nextRows = [...rows];
								nextRows[patch.index] = await res.json();
								setData?.(nextRows);
							}
						} else {
							res = await fetch(`${endpoint}/${id}`, {
								method: 'PATCH',
								body: JSON.stringify(patch.data)
							});
						}

						if (!res) return { validated: [], errors: [] as CellPosition[] };
						if (res.ok) return { validated: pos(rowIndex, columnIds), errors: [] as CellPosition[] };

						if (res.status === 422) {
							const errorCols = new SvelteSet(
								Object.keys((await res.json())?.errors ?? {})
							);
							return {
								errors: pos(rowIndex, Array.from(errorCols)),
								validated: pos(
									rowIndex,
									columnIds.filter((c) => !errorCols.has(c))
								)
							};
						}
					} catch (error) {
						console.error(error);
					}

					return { validated: [] as CellPosition[], errors: [] as CellPosition[] };
				})
			);

			const validated = results.flatMap((r) => r.validated);
			const errors = results.flatMap((r) => r.errors);

			if (errors.length) {
				toast.error('Failed to patch all rows', { closeButton: true, duration: Infinity });
			} else {
				toast.success('All rows patched');
			}

			return { validated, errors };
		}
		: undefined;

	const resolvedOnRowAdd = onRowAddProp ?? defaultOnRowAdd;
	const resolvedOnRowsAdd = onRowsAddProp ?? defaultOnRowsAdd;
	const resolvedOnRowsDelete = onRowsDeleteProp ?? defaultOnRowsDelete;
	const resolvedOnRowChange = onRowChangeProp ?? defaultOnRowChange;

	// SvelteMap for CELL-LEVEL fine-grained reactivity
	// Key is "rowIndex:columnId", value is the cell value
	// Only the specific cell that changed will re-render
	const cellValueMap = new SvelteMap<string, unknown>();

	// Expose the map directly so cells can access it in $derived for proper reactivity
	// When a cell calls cellValueMap.get(key) inside $derived, Svelte tracks that specific key
	function getCellValueMap(): SvelteMap<string, unknown> {
		return cellValueMap;
	}

	// Helper to set cell value with fine-grained reactivity
	function setCellValue(rowIndex: number, columnId: string, value: unknown): void {
		const key = getCellKey(rowIndex, columnId);
		cellValueMap.set(key, value);
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
	let sorting = $state<SortingState>(initialState?.sorting ?? []);
	let columnFilters = $state<ColumnFiltersState>(initialState?.columnFilters ?? []);
	let rowSelection = $state<RowSelectionState>(initialState?.rowSelection ?? {});
	let columnPinning = $state<ColumnPinningState>(initialState?.columnPinning ?? {});
	let columnVisibility = $state<VisibilityState>(initialState?.columnVisibility ?? {});
	let columnSizing = $state<ColumnSizingState>(initialState?.columnSizing ?? {});
	let columnSizingInfo = $state<ColumnSizingInfoState>({
		startOffset: null,
		startSize: null,
		deltaOffset: null,
		deltaPercentage: null,
		isResizingColumn: false,
		columnSizingStart: []
	});
	let rowHeight = $state<RowHeightValue>(initialRowHeight);

	// Cell state
	let focusedCell = $state<CellPosition | null>(null);
	let editingCell = $state<CellPosition | null>(null);
	let selectionState = $state<SelectionState>({
		selectedCells: new SvelteSet(),
		selectionRange: null,
		isSelecting: false
	});
	let cutCells = new SvelteSet<string>();

	// SvelteSet for fine-grained reactivity on cell selection
	// Cells can call selectedCellsSet.has(key) in $derived for proper Svelte tracking
	const selectedCellsSet = new SvelteSet<string>();
	// Version counter to force cell re-renders when selection changes
	// Cells read this in $derived to create a reactive dependency
	let selectionVersion = $state(0);

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

	// Error state
	let errorMatches = $state<CellPosition[]>([]);

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
		const oldCells = new SvelteSet(selectedCellsSet);

		selectedCellsSet.clear();
		for (const key of newCells) {
			selectedCellsSet.add(key);
		}
		// Increment version to trigger re-renders in cells
		selectionVersion++;

		// Direct DOM update - bypass Svelte reactivity for selection highlight
		// This ensures visible cells update immediately
		if (dataGridRef) {
			// Remove highlight from cells no longer selected
			for (const key of oldCells) {
				if (!newCells.has(key)) {
					const cellEl = cellMapRef.get(key);
					if (cellEl) {
						cellEl.classList.remove('highlight');
						cellEl.removeAttribute('data-selected');
					}
				}
			}
			// Add highlight to newly selected cells
			for (const key of newCells) {
				if (!oldCells.has(key)) {
					const cellEl = cellMapRef.get(key);
					if (cellEl) {
						cellEl.classList.add('highlight');
						cellEl.setAttribute('data-selected', '');
					}
				}
			}
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
			.filter((col) => col.getIsVisible() && !NON_NAVIGABLE_COLUMNS.has(col.id));
	}

	function getFirstNavigableColumnId(): string | null {
		const cols = getNavigableColumns();
		return cols[0]?.id ?? null;
	}

	function getLastNavigableColumnId(): string | null {
		const cols = getNavigableColumns();
		return cols[cols.length - 1]?.id ?? null;
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
		return selectionState.selectedCells.has(getCellKey(rowIndex, columnId));
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
		focusedCell = { rowIndex, columnId };

		const cellKey = getCellKey(rowIndex, columnId);

		// Clear selection when focusing new cell (unless holding shift or explicitly keeping anchor)
		if (!selectionState.isSelecting && !opts?.keepAnchor) {
			const newCells = new SvelteSet([cellKey]);
			syncSelectedCellsSet(newCells);
			selectionState = {
				selectedCells: newCells,
				selectionRange: null,
				isSelecting: false
			};
			// Set anchor to the newly focused cell
			selectionAnchor = { rowIndex, columnId };
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
		const { rowIndex, columnId } = focusedCell;

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
		editingCell = { rowIndex, columnId };
	}

	function stopEditing(opts?: { direction?: NavigationDirection; moveToNextRow?: boolean }) {
		editingCell = null;

		if (opts?.direction) {
			navigateCell(opts.direction);
		} else if (opts?.moveToNextRow && focusedCell) {
			navigateCell('down');
		}
	}

	// ========================================
	// Cell Selection
	// ========================================

	function selectCell(rowIndex: number, columnId: string, event?: MouseEvent) {
		const cellKey = getCellKey(rowIndex, columnId);

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
				selectedCells: newSelected
			};
		} else if (event?.shiftKey && focusedCell) {
			// Range selection
			selectRange(focusedCell, { rowIndex, columnId });
		} else {
			// Single selection
			const newCells = new SvelteSet([cellKey]);
			syncSelectedCellsSet(newCells);
			selectionState = {
				selectedCells: newCells,
				selectionRange: null,
				isSelecting: false
			};
		}

		focusCell(rowIndex, columnId);
	}

	function selectRange(start: CellPosition, end: CellPosition, keepSelecting = false) {
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
			selectedCells: newSelected,
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
			selectedCells: newSelected,
			selectionRange: null,
			isSelecting: false
		};
	}

	function clearSelection() {
		const newCells = new SvelteSet<string>();
		syncSelectedCellsSet(newCells);
		selectionState = {
			selectedCells: newCells,
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
		const cellKey = getCellKey(rowIndex, columnId);

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
				selectedCells: newSelected,
				isSelecting: false
			};
			// Update focused cell but keep anchor for future shift-clicks
			focusedCell = { rowIndex, columnId };
			scrollAndFocusCell(rowIndex, columnId);
		} else if (event.shiftKey && (selectionAnchor || focusedCell)) {
			// Range selection from anchor (or focused cell if no anchor) to this cell
			const anchor = selectionAnchor || focusedCell!;
			selectRange(anchor, { rowIndex, columnId });
			selectionState = { ...selectionState, isSelecting: false };
			// Update focused cell but keep anchor for future shift-clicks
			focusedCell = { rowIndex, columnId };
			scrollAndFocusCell(rowIndex, columnId);
		} else {
			// Start drag selection - set this cell as anchor
			const newCells = new SvelteSet([cellKey]);
			syncSelectedCellsSet(newCells);
			selectionState = {
				selectedCells: newCells,
				selectionRange: null,
				isSelecting: true
			};
			selectionAnchor = { rowIndex, columnId };
			focusCell(rowIndex, columnId);
		}
	}

	// Helper to scroll to cell and focus it without changing selection anchor
	function scrollAndFocusCell(rowIndex: number, columnId: string) {
		const cellKey = getCellKey(rowIndex, columnId);

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
		selectRange(selectionAnchor, { rowIndex, columnId }, true);
	}

	function onCellMouseUp() {
		selectionState = { ...selectionState, isSelecting: false };
	}

	// ========================================
	// Clipboard Operations
	// ========================================

	function copySelectedCells() {
		if (selectionState.selectedCells.size === 0) return;

		const rows = table.getRowModel().rows;
		const cols = getNavigableColumns();

		// Get bounds of selection
		let minRow = Infinity,
			maxRow = -Infinity;
		let minCol = Infinity,
			maxCol = -Infinity;

		for (const cellKey of selectionState.selectedCells) {
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
				const colId = cols[col]?.id;
				if (!colId) continue;

				const cellKey = getCellKey(row, colId);
				if (selectionState.selectedCells.has(cellKey)) {
					const value = rowData.getValue(colId);
					cells.push(formatCellValueForCopy(value));
				} else {
					cells.push('');
				}
			}
			lines.push(cells.join('\t'));
		}

		const text = lines.join('\n');
		navigator.clipboard
			.writeText(text)
			.then(() => {
				const cellCount = selectionState.selectedCells.size;
				toast.success(`${cellCount} cell${cellCount !== 1 ? 's' : ''} copied`);
			})
			.catch((error) => {
				toast.error(error instanceof Error ? error.message : 'Failed to copy to clipboard');
			});
	}

	function cutSelectedCells() {
		const selectedEditableCells = new SvelteSet<string>();
		const updates: UpdateCell[] = [];
		for (const cellKey of selectionState.selectedCells) {
			const { rowIndex, columnId } = parseCellKey(cellKey);
			if (getIsCellReadOnly(rowIndex, columnId)) continue;
			selectedEditableCells.add(cellKey);
			updates.push({ rowIndex, columnId, value: null });
		}
		if (selectedEditableCells.size === 0) return;

		const cellCount = selectedEditableCells.size;
		copySelectedCells();
		cutCells = new SvelteSet(selectedEditableCells);
		if (updates.length > 0) {
			handleDataUpdate(updates);
		}
		// Note: Toast for cut is handled separately since copy already shows success
	}

	async function pasteFromClipboard() {
		if (readOnly || !enablePaste) return;

		try {
			const text = await navigator.clipboard.readText();
			if (!text.trim()) return;

			const rows = table.getRowModel().rows;
			const cols = getNavigableColumns();

			// Parse clipboard as TSV
			const lines = text.split('\n').map((line) => line.split('\t'));

			// Determine paste target
			const startPos = focusedCell || { rowIndex: 0, columnId: cols[0]?.id || '' };
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

	function performPaste(text: string, startPos: CellPosition, startColIndex: number) {
		const rows = table.getRowModel().rows;
		const cols = getNavigableColumns();
		const lines = text.split('\n').map((line) => line.split('\t'));

		const updates: UpdateCell[] = [];

		for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
			const line = lines[lineIdx];
			if (!line) continue;

			const rowIndex = startPos.rowIndex + lineIdx;
			if (rowIndex >= rows.length) break;

			for (let cellIdx = 0; cellIdx < line.length; cellIdx++) {
				const colIndex = startColIndex + cellIdx;
				const col = cols[colIndex];
				if (!col) break;

				const value = parseCellValueForPaste(line[cellIdx] || '', col.id);
				updates.push({ rowIndex, columnId: col.id, value });
			}
		}

		if (updates.length > 0) {
			// Clear cut cells first if we had any (to merge all updates together)
			if (cutCells.size > 0) {
				for (const cellKey of cutCells) {
					const { rowIndex, columnId } = parseCellKey(cellKey);
					updates.push({ rowIndex, columnId, value: null });
				}
				cutCells = new SvelteSet();
			}

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

	function formatCellValueForCopy(value: unknown): string {
		if (value === null || value === undefined) return '';
		if (Array.isArray(value)) return JSON.stringify(value);
		return String(value);
	}

	function parseCellValueForPaste(text: string, _columnId: string): unknown {
		// Try to parse as JSON (for arrays)
		if (text.startsWith('[') || text.startsWith('{')) {
			try {
				return JSON.parse(text);
			} catch {
				// Not valid JSON
			}
		}

		// Try to parse as number
		const num = Number(text);
		if (!isNaN(num) && text.trim() !== '') {
			return num;
		}

		// Try to parse as boolean
		if (text.toLowerCase() === 'true') return true;
		if (text.toLowerCase() === 'false') return false;

		return text;
	}

	// ========================================
	// Delete/Clear Operations
	// ========================================

	function clearSelectedCells() {
		if (readOnly) return;

		const updates: UpdateCell[] = [];
		for (const cellKey of selectionState.selectedCells) {
			const { rowIndex, columnId } = parseCellKey(cellKey);
			if (getIsCellReadOnly(rowIndex, columnId)) continue;
			updates.push({ rowIndex, columnId, value: null });
		}

		if (updates.length > 0) {
			handleDataUpdate(updates);
		}
	}

	function deleteSelectedRows() {
		if (readOnly || !resolvedOnRowsDelete) return;

		const rows = table.getRowModel().rows;
		const selectedRowIndices = new SvelteSet<number>();

		for (const cellKey of selectionState.selectedCells) {
			const { rowIndex } = parseCellKey(cellKey);
			selectedRowIndices.add(rowIndex);
		}

		const rowIndices = Array.from(selectedRowIndices).sort((a, b) => b - a);
		const rowsToDelete = rowIndices.map((idx) => rows[idx]?.original).filter(Boolean) as TData[];

		if (rowsToDelete.length > 0) {
			resolvedOnRowsDelete(rowsToDelete, rowIndices);
			clearSelection();
		}
	}

	// ========================================
	// Errors
	// ========================================

	function highlightErrors(validated: CellPosition[], errors: CellPosition[]) {

		for (const { rowIndex, columnId } of validated) {
			hasErrorMatchSet.delete(getCellKey(rowIndex, columnId));
		}
		for (const { rowIndex, columnId } of errors) {
			hasErrorMatchSet.add(getCellKey(rowIndex, columnId));
		}

		errorMatches = Array.from(hasErrorMatchSet, (key) => {
			const [rowIndexStr, columnId] = key.split(":");
			return { rowIndex: Number(rowIndexStr), columnId };
		});
	}

	function applyRowChangeResult(result: RowChangeResult | undefined) {
		if (!result) return;
		highlightErrors(result.validated ?? [], result.errors ?? []);
	}

	// ========================================
	// Search
	// ========================================

	function performSearch(query: string) {
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
					else if ('default' in value || Language.English in value) value = translateLocalizedField(value as Translatable, UI.language);
				}

				const strValue = String(value ?? '').toLowerCase();
				if (strValue.includes(lowerQuery)) {
					const columnId = col.id;
					matches.push({ rowIndex, columnId });
					// Build Set in same loop - single pass
					searchMatchSet.add(getCellKey(rowIndex, columnId));
				}
			}
		}

		searchMatches = matches;
		matchIndex = matches.length > 0 ? 0 : 0;

		// Scroll to first match (like React version - just scroll, don't focus)
		if (matches.length > 0 && matches[0]) {
			virtualizer?.scrollToIndex(matches[0].rowIndex, { align: 'center' });
		}
	}

	function navigateToNextMatch() {
		if (searchMatches.length === 0) return;

		const newIndex = (matchIndex + 1) % searchMatches.length;
		matchIndex = newIndex;

		const match = searchMatches[newIndex];
		if (match) {
			virtualizer?.scrollToIndex(match.rowIndex, { align: 'center' });
		}
	}

	function navigateToPrevMatch() {
		if (searchMatches.length === 0) return;

		const newIndex = (matchIndex - 1 + searchMatches.length) % searchMatches.length;
		matchIndex = newIndex;

		const match = searchMatches[newIndex];
		if (match) {
			virtualizer?.scrollToIndex(match.rowIndex, { align: 'center' });
		}
	}

	// ========================================
	// Context Menu
	// ========================================

	function onCellContextMenu(rowIndex: number, columnId: string, event: MouseEvent) {
		event.preventDefault();

		// Select cell if not already selected
		const cellKey = getCellKey(rowIndex, columnId);
		if (!selectionState.selectedCells.has(cellKey)) {
			selectCell(rowIndex, columnId);
		}

		contextMenu = {
			open: true,
			x: event.clientX,
			y: event.clientY,
			isSelectedRow: !!rowSelection[table.getRowModel().rows[rowIndex]?.id]
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
			cutSelectedCells();
			return;
		}

		// Paste
		if (!editingCell && (event.ctrlKey || event.metaKey) && event.key === 'v') {
			event.preventDefault();
			event.stopPropagation();
			pasteFromClipboard();
			return;
		}

		// Toggle language
		if (!editingCell && (event.ctrlKey || event.metaKey) && event.key === 'k') {
			const getNextLanguage = (
				selected?: Language | 'default' | null
			): Language | 'default' => {
				const languages = ['default', ...Object.values(Language)] as const;
				const currentIndex = selected ? languages.indexOf(selected) : -1;
				return languages[(currentIndex + 1) % languages.length];
			};
			UI.language = getNextLanguage(UI.language);
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
				clearSelectedCells();
				return;
			}
		}

		// Escape
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			if (editingCell) {
				stopEditing();
			} else if (searchOpen) {
				searchOpen = false;
			} else {
				clearSelection();
			}
			return;
		}

		// Don't handle navigation while editing
		if (editingCell) return;

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
			event.preventDefault();
			event.stopPropagation();
			navigateCell(event.shiftKey ? 'left' : 'right');
			return;
		}

		// Enter to start editing or move down
		if (event.key === 'Enter' && focusedCell) {
			event.preventDefault();
			event.stopPropagation();
			startEditing(focusedCell.rowIndex, focusedCell.columnId);
			return;
		}

		// F2 to start editing
		if (event.key === 'F2' && focusedCell) {
			event.preventDefault();
			event.stopPropagation();
			startEditing(focusedCell.rowIndex, focusedCell.columnId);
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
			startEditing(focusedCell.rowIndex, focusedCell.columnId);
		}
	}

	function getNavigationTarget(direction: NavigationDirection): CellPosition | null {
		if (!focusedCell) return null;

		const rows = table.getRowModel().rows;
		const { rowIndex, columnId } = focusedCell;

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
			return { rowIndex: newRowIndex, columnId: newColumnId };
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
			const rows = table.getRowModel().rows;
			const newRowIndex = result.rowIndex ?? rows.length;
			const newColumnId = getFirstNavigableColumnId();

			if (newColumnId) {
				// Wait for table to update
				queueMicrotask(() => {
					focusCell(newRowIndex, newColumnId);
				});
			}
		}
	}

	// ========================================
	// Data Update Handler
	// ========================================

	function handleDataUpdate(updates: UpdateCell | UpdateCell[]) {
		const updateArray = Array.isArray(updates) ? updates : [updates];
		if (updateArray.length === 0) return;

		const filteredUpdates = updateArray.filter(
			(update) => !getIsCellReadOnly(update.rowIndex, update.columnId)
		);
		if (filteredUpdates.length === 0) return;

		const rows = table.getRowModel().rows;

		// Update cellValueMap for immediate UI feedback (fine-grained reactivity)
		// This is the fast path - only the specific cells that changed will re-render
		for (const update of filteredUpdates) {
			const row = rows[update.rowIndex];
			if (!row) continue;

			// Update cellValueMap using DISPLAY row index (update.rowIndex)
			// This matches what the cell components use when rendering
			setCellValue(update.rowIndex, update.columnId, update.value);

			// Also update the underlying row data directly (mutate in place)
			// This ensures sorting/filtering work correctly without triggering full re-render
			const original = row.original as Record<string, unknown>;
			original[update.columnId] = update.value;
		}

		// Notify parent that one or more rows changed.
		if (resolvedOnRowChange) {
			const rowIndicesSet = new SvelteSet(filteredUpdates.map((update) => update.rowIndex));
			const rowIndices = Array.from(rowIndicesSet);
			const originalRows = rowIndices
				.map((rowIndex) => rows[rowIndex]?.original)
				.filter(Boolean) as TData[];
			const updates = filteredUpdates.map((update) => {
				const original = rows[update.rowIndex]?.original as Record<string, unknown> | undefined;
				if (original && 'id' in original && typeof original.id === 'string') {
					return { rowId: original.id, ...update };
				}
				return { ...update };
			});
			// void onRowChange(originalRows, rowIndices, updates);
			const result = resolvedOnRowChange(updates);
			if (result && typeof (result as Promise<RowChangeResult>).then === 'function') {
				void (result as Promise<RowChangeResult>).then(applyRowChangeResult);
			} else {
				applyRowChangeResult(result as RowChangeResult | undefined);
			}
		}

		// NOTE: We intentionally DON'T call onDataChange here!
		// The SvelteMap provides fine-grained reactivity for cell values.
		// Calling onDataChange would trigger a full data re-render which is slow.
		// The parent's data array is updated via mutation above.
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
		// Expose SvelteSet directly for fine-grained cell selection reactivity
		// Cells can call selectedCellsSet.has(key) in $derived for proper Svelte tracking
		selectedCellsSet,
		// Version counter to trigger cell re-renders when selection changes
		get selectionVersion() {
			return selectionVersion;
		},
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
		onDataUpdate: handleDataUpdate,
		onRowsDelete: (rowIndices: number[]) => {
			const rows = table.getRowModel().rows;
			const rowsToDelete = rowIndices.map((idx) => rows[idx]?.original).filter(Boolean) as TData[];
			resolvedOnRowsDelete?.(rowsToDelete, rowIndices);
		},
		onCellsCopy: copySelectedCells,
		onCellsCut: cutSelectedCells,
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
				const rowIdx = rows.findIndex((r) => r.id === rowId);
				if (rowIdx === -1) continue;

				for (const columnId of allColumnIds) {
					newSelectedCells.add(getCellKey(rowIdx, columnId));
				}
			}

			syncSelectedCellsSet(newSelectedCells);
			selectionState = {
				selectedCells: newSelectedCells,
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
				await resolvedOnRowsAdd(pasteDialog.rowsNeeded);
				const cols = getNavigableColumns();
				const startPos = focusedCell || { rowIndex: 0, columnId: cols[0]?.id || '' };
				const startColIndex = cols.findIndex((c) => c.id === startPos.columnId);
				performPaste(pasteDialog.clipboardText, startPos, startColIndex);
			}
			pasteDialog = { ...pasteDialog, open: false };
		},
		onPasteWithoutExpansion: () => {
			const cols = getNavigableColumns();
			const startPos = focusedCell || { rowIndex: 0, columnId: cols[0]?.id || '' };
			const startColIndex = cols.findIndex((c) => c.id === startPos.columnId);
			performPaste(pasteDialog.clipboardText, startPos, startColIndex);
			pasteDialog = { ...pasteDialog, open: false };
		}
	};

	// Create the base table options
	const baseTableOptions: TableOptionsResolved<TData> = {
		data: getData(),
		columns,
		...(getRowId ? { getRowId } : {}),
		state: {
			sorting,
			columnFilters,
			rowSelection,
			columnPinning,
			columnVisibility,
			columnSizing,
			columnSizingInfo
		},
		onColumnSizingChange: (updater) => {
			columnSizing = typeof updater === 'function' ? updater(columnSizing) : updater;
		},
		onColumnSizingInfoChange: (updater) => {
			columnSizingInfo = typeof updater === 'function' ? updater(columnSizingInfo) : updater;
		},
		onColumnPinningChange: (updater) => {
			columnPinning = typeof updater === 'function' ? updater(columnPinning) : updater;
		},
		onColumnVisibilityChange: (updater) => {
			columnVisibility = typeof updater === 'function' ? updater(columnVisibility) : updater;
			// No version counter needed - visibilityKey is derived from columnVisibility
			// and will automatically update when visibility changes
		},
		onSortingChange: (updater) => {
			sorting = typeof updater === 'function' ? updater(sorting) : updater;
		},
		onColumnFiltersChange: (updater) => {
			columnFilters = typeof updater === 'function' ? updater(columnFilters) : updater;
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
				const rowIdx = rows.findIndex((r) => r.id === rowId);
				if (rowIdx === -1) continue;

				for (const columnId of allColumnIds) {
					newSelectedCells.add(getCellKey(rowIdx, columnId));
				}
			}

			syncSelectedCellsSet(newSelectedCells);
			selectionState = {
				selectedCells: newSelectedCells,
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
			minSize: 60,
			maxSize: 1000,
			size: 150
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
	let prevColumnVisibility = $state<VisibilityState>({});

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
			columnSizingInfo
		};
		const currentData = getData();

		// Clear cell value cache when sorting, filtering, row count, or column visibility changes
		// This ensures cells show correct values after re-ordering, add/delete, or column show/hide
		const sortingChanged = JSON.stringify(sorting) !== JSON.stringify(prevSorting);
		const filtersChanged = JSON.stringify(columnFilters) !== JSON.stringify(prevColumnFilters);
		const dataLengthChanged = currentData.length !== prevDataLength;
		const visibilityChanged =
			JSON.stringify(columnVisibility) !== JSON.stringify(prevColumnVisibility);

		if (sortingChanged || filtersChanged || dataLengthChanged || visibilityChanged) {
			clearCellValueCache();
			prevSorting = [...sorting];
			prevColumnFilters = [...columnFilters];
			prevDataLength = currentData.length;
			prevColumnVisibility = { ...columnVisibility };
		}

		// Update table with current state
		table.setOptions((prev) => ({
			...prev,
			data: currentData,
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

		virtualizer = new Virtualizer<HTMLDivElement, Element>({
			count: rowCount,
			getScrollElement: () => ref,
			estimateSize: () => getRowHeightValue(rowHeight),
			overscan,
			observeElementRect,
			observeElementOffset,
			scrollToFn: elementScroll,
			onChange: handleVirtualizerChange,
			measureElement: isFirefox ? undefined : (element) => element?.getBoundingClientRect().height
		});

		virtualizer._willUpdate();
		handleVirtualizerChange(virtualizer);
	});

	// Separate effect to update virtualizer count when filtered rows change
	// Track columnFilters, sorting, and data to trigger updates
	$effect(() => {
		// Read these to create dependencies - when filters/sorting change, row count changes
		const _ = columnFilters;
		const __ = sorting;
		const currentData = getData();

		// Get the filtered/sorted row count from the table
		const rowCount = table.getRowModel().rows.length;

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
					estimateSize: () => getRowHeightValue(rowHeight),
					overscan,
					observeElementRect,
					observeElementOffset,
					scrollToFn: elementScroll,
					onChange: handleVirtualizerChange,
					measureElement: isFirefox
						? undefined
						: (element) => element?.getBoundingClientRect().height
				});

				// Force virtualizer to recalculate
				virtualizer._willUpdate();
				virtualizer.measure();

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

				// Update virtual items immediately
				handleVirtualizerChange(virtualizer);
			}
		});
	});

	// Force virtualItems update when columnVisibility changes
	$effect(() => {
		const visibilitySnapshot = JSON.stringify(columnVisibility);
		if (virtualizer) {
			// Force virtualizer to recalculate
			virtualizer._willUpdate();
			virtualizer.measure();
			// Get fresh items
			const items = virtualizer.getVirtualItems();
			virtualItems = [...items];
		}
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
		// Keep table reference for any other property access
		_getDefaultColumnDef: table._getDefaultColumnDef.bind(table),
		get options() {
			subscribeToTable();
			return table.options;
		},
		initialState: table.initialState
	} as unknown as Table<TData>;

	// Search callbacks - these are stable references
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
		dataGridRef,
		headerRef,
		rowMapRef,
		footerRef,
		table: reactiveTable,
		rowVirtualizer,
		// Selection state - pass the SvelteSet and a reactive object for version
		selectedCellsSet,
		// Wrap selectionVersion in object with getter so components can track it reactively
		selectionState: {
			get version() {
				return selectionVersion;
			}
		},
		getSelectionVersion: () => selectionVersion,
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
		onRowAdd: handleRowAdd,
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

export function groupCellUpdates(updates: CellUpdate[]) {
	type PatchMap = Record<string, { index: number, data: Record<string, unknown> }>;
	return updates.reduce<PatchMap>((acc, item) => {
		let key = item.rowId;
		if (!key) key = `new-${item.rowIndex}`;

		if (!acc[key]) acc[key] = { index: item.rowIndex, data: {} };
		acc[key].data[item.columnId] = item.value;

		return acc;
	}, {});
}

export const fileCellMediaToFileCellData = (media: Media | null): FileCellData[] => {
	if (!media) return [];
	const { collection, filename } = media;
	if (!filename?.length) return [];
	return [{ id: filename, collection, filename }];
};
