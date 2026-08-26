// Data Grid Types for TableCN-Svelte
// Exact port of TableCN React types for Svelte 5

import type { MediaCollection } from '$lib/db/schemas/0-utils';
import {
	ROW_HEIGHTS,
	ROW_LINE_COUNTS,
	type DataGridRowHeight
} from '$lib/components/data-grid/config/data-grid.js';
import type { Cell, Column, RowData, Table } from '@tanstack/table-core';
import type { Component, Snippet } from 'svelte';
import type { SvelteMap, SvelteSet } from 'svelte/reactivity';

// ============================================
// Base Types
// ============================================

export interface Option {
	label: string;
	value: string;
}

export type RowHeightValue = DataGridRowHeight;

export interface CellSelectOption {
	title: string;
	summary?: string | null;
	value: string;
	icon?: Component;
	count?: number;
}

// ============================================
// Cell Types
// ============================================

export interface DataGridCellAction<TData> {
	label: string;
	icon?: Component;
	disabled?: boolean | ((row: TData) => boolean);
	onSelect: (row: TData) => void | Promise<void>;
}

export type CellOpts<TData = unknown> =
	| { variant: 'text-short' }
	| { variant: 'text-translated-short' }
	| { variant: 'text-long' }
	| { variant: 'text-translated-long'; markdown?: boolean }
	| { variant: 'json-yaml'; schemaPreview?: string | ((row: unknown) => unknown) }
	| {
			variant: 'jdm-expression';
			expressionType?: 'standard' | 'unary' | 'template';
			placeholder?: string;
			strict?: boolean;
			lint?: boolean;
			maxRows?: number;
			variableType?: unknown;
			expectedVariableType?: unknown;
	  }
	| { variant: 'badge-item'; url?: string }
	| { variant: 'relation-follow'; url?: string }
	| { variant: 'relation-select-single'; options: CellSelectOption[] }
	| { variant: 'input-with-suggestions'; options: CellSelectOption[] }
	| { variant: 'number'; min?: number; max?: number; step?: number }
	| { variant: 'select-icon' }
	| { variant: 'select-single'; options: CellSelectOption[] }
	| { variant: 'select-multiple'; options: CellSelectOption[] }
	| { variant: 'checkbox' }
	| { variant: 'date' }
	| { variant: 'date-time' }
	| { variant: 'url' }
	| { variant: 'row-select' }
	| {
			variant: 'actions';
			actions: DataGridCellAction<TData>[] | ((row: TData) => DataGridCellAction<TData>[]);
	  }
	| {
			variant: 'file' | 'file-or-url';
			maxFileSize?: number;
			maxFiles?: number;
			accept?: string;
			multiple?: boolean;
	  };

export interface UpdateCell {
	rowIndex: number;
	/** Stable TanStack row id. Display indexes are never authoritative for mutations. */
	rowId: string;
	columnId: string;
	value: unknown;
}

// ============================================
// Position & Selection Types
// ============================================

export interface CellPosition {
	rowIndex: number;
	/** Stable TanStack row id when the position is retained beyond immediate navigation. */
	rowId?: string;
	columnId: string;
}

export interface CellRange {
	start: CellPosition;
	end: CellPosition;
}

export interface SelectionState {
	selectedCells: Set<string>;
	selectionRange: CellRange | null;
	isSelecting: boolean;
}

export type CellSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface CellSaveState {
	status: CellSaveStatus;
	error?: string;
}

export interface DataGridMutationContext<TData> {
	row: TData;
	rowId: string;
}

export interface DataGridDataAdapter<TData> {
	create?: (params: { row: Partial<TData> }) => Promise<TData>;
	update?: (params: DataGridMutationContext<TData> & { changes: Partial<TData> }) => Promise<TData>;
	delete?: (params: DataGridMutationContext<TData>) => Promise<boolean>;
	download?: (params: { rows: TData[]; rowIds: string[] }) => Promise<void>;
}

export interface DataGridCreateResult<TData> {
	rows: TData[];
	rowIds: string[];
	failedCount: number;
}

export interface DataGridDeleteResult {
	deletedRowIds: string[];
	failedRowIds: string[];
}

export interface DataGridPreferencesController {
	readonly enabled: boolean;
	readonly ready: boolean;
	readonly hasPreferences: boolean;
	reset: () => void;
	readonly rowHeightRemeasureVersion: number;
}

export interface DataGridStatusSnippetContext {
	message: string;
	error?: unknown;
}

export interface DataGridStatusProps {
	loading?: boolean;
	error?: unknown;
	loadingMessage?: string;
	errorMessage?: string;
	emptyMessage?: string;
	filteredEmptyMessage?: string;
	loadingState?: Snippet<[DataGridStatusSnippetContext]>;
	errorState?: Snippet<[DataGridStatusSnippetContext]>;
	emptyState?: Snippet<[DataGridStatusSnippetContext]>;
	filteredEmptyState?: Snippet<[DataGridStatusSnippetContext]>;
}

// ============================================
// Context Menu Types
// ============================================

export interface ContextMenuState {
	open: boolean;
	x: number;
	y: number;
	isSelectedRow?: boolean;
}

// ============================================
// Paste Dialog Types
// ============================================

export interface PasteDialogState {
	open: boolean;
	rowsNeeded: number;
	clipboardText: string;
}

// ============================================
// Navigation Types
// ============================================

export type NavigationDirection =
	| 'up'
	| 'down'
	| 'left'
	| 'right'
	| 'home'
	| 'end'
	| 'ctrl+home'
	| 'ctrl+end'
	| 'pageup'
	| 'pagedown';

// ============================================
// Search Types
// ============================================

// Type alias for search match - same as CellPosition
export type SearchMatch = CellPosition;

// Data-only search state (used by stores)
export interface SearchStateData {
	searchOpen: boolean;
	searchQuery: string;
	searchMatches: SearchMatch[];
	matchIndex: number;
}

// Full search state with callbacks (used by components)
export interface SearchState extends SearchStateData {
	onSearchOpenChange: (open: boolean) => void;
	onSearchQueryChange: (query: string) => void;
	onSearch: (query: string) => void;
	onNavigateToNextMatch: () => void;
	onNavigateToPrevMatch: () => void;
}

// ============================================
// Cell Variant Props
// ============================================

export interface CellVariantProps<TData> {
	cell: Cell<TData, unknown>;
	table: Table<TData>;
	rowIndex: number;
	columnId: string;
	isEditing: boolean;
	isFocused: boolean;
	isSelected: boolean;
	hasError?: boolean;
	readOnly?: boolean;
	/** Centralized cell value with fine-grained reactivity from SvelteMap */
	cellValue: unknown;
}

// ============================================
// File Cell Types
// ============================================

export interface FileCellData {
	id: string;
	collection: MediaCollection;
	filename: string;
}

export interface DataGridClearResult {
	clearedCellCount: number;
	failedCellCount: number;
	deletedMediaCount: number;
	retainedMediaCount: number;
	failedMediaCount: number;
}

export interface DataGridMutationResult {
	rowId: string;
	columnId: string;
	generation: number;
	success: boolean;
	superseded: boolean;
}

// ============================================
// Filter Types
// ============================================

export type TextFilterOperator =
	| 'contains'
	| 'notContains'
	| 'equals'
	| 'notEquals'
	| 'startsWith'
	| 'endsWith'
	| 'isEmpty'
	| 'isNotEmpty';

export type NumberFilterOperator =
	| 'equals'
	| 'notEquals'
	| 'lessThan'
	| 'lessThanOrEqual'
	| 'greaterThan'
	| 'greaterThanOrEqual'
	| 'between'
	| 'isEmpty'
	| 'isNotEmpty';

export type DateFilterOperator =
	| 'equals'
	| 'notEquals'
	| 'before'
	| 'after'
	| 'onOrBefore'
	| 'onOrAfter'
	| 'between'
	| 'isEmpty'
	| 'isNotEmpty';

export type SelectFilterOperator =
	'is' | 'isNot' | 'isAnyOf' | 'isNoneOf' | 'isEmpty' | 'isNotEmpty';

export type BooleanFilterOperator = 'isTrue' | 'isFalse';

export type FilterOperator =
	| TextFilterOperator
	| NumberFilterOperator
	| DateFilterOperator
	| SelectFilterOperator
	| BooleanFilterOperator;

export interface FilterValue {
	operator: FilterOperator;
	value?: string | number | string[];
	value2?: string | number;
}

// ============================================
// TanStack Table Meta Extension
// ============================================

declare module '@tanstack/table-core' {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	interface ColumnMeta<TData extends RowData, TValue> {
		label?: string;
		cell?: CellOpts<TData>;
		readOnly?: boolean;
		navigable?: boolean;
		/** Property path used for immutable writes when the accessor is nested. */
		valuePath?: string | readonly string[];
		/** Immutable write override for computed or otherwise non-addressable accessors. */
		setValue?: (row: TData, value: unknown) => TData;
		/** PATCH payload override required when setValue cannot be represented by valuePath. */
		serializePatch?: (row: TData, value: unknown) => Partial<TData>;
		/** Columns whose validation state is settled when this column saves successfully. */
		validationDependencies?: string[];
		clipboard?: {
			parse?: (text: string, row: TData) => unknown;
			serialize?: (value: unknown, row: TData) => string;
			emptyValue?: unknown | ((row: TData) => unknown);
		};
	}

	interface TableMeta<TData extends RowData> {
		dataGridRef?: HTMLElement | null;
		cellMapRef?: Map<string, HTMLDivElement>;
		focusedCell?: CellPosition | null;
		editingCell?: CellPosition | null;
		selectionState?: SelectionState;
		searchOpen?: boolean;
		readOnly?: boolean;
		getIsCellSelected?: (rowIndex: number, columnId: string) => boolean;
		// SvelteMap for fine-grained cell value reactivity - cells access map.get(key) in $derived
		cellValueMap?: SvelteMap<string, unknown>;
		cellSaveStateMap?: SvelteMap<string, CellSaveState>;
		getCellMutationSnapshot?: (
			rowId: string,
			columnId: string
		) => { generation: number; value: unknown } | undefined;
		// SvelteSet for fine-grained cell selection reactivity
		selectedCellsSet?: SvelteSet<string>;
		getIsSearchMatch?: (rowIndex: number, columnId: string) => boolean;
		getIsActiveSearchMatch?: (rowIndex: number, columnId: string) => boolean;
		// SvelteSet for fine-grained reactive error match lookups
		hasErrorMatchSet?: SvelteSet<string>;
		// SvelteSet for fine-grained reactive search match lookups
		searchMatchSet?: SvelteSet<string>;
		activeSearchMatch?: CellPosition | null;
		rowHeight?: RowHeightValue;
		rowHeightRemeasureVersion?: number;
		preferences?: DataGridPreferencesController;
		onRowHeightChange?: (value: RowHeightValue) => void;
		onRowSelect?: (rowIndex: number, checked: boolean, shiftKey: boolean) => void;
		onDataUpdate?: (params: UpdateCell | UpdateCell[]) => Promise<DataGridMutationResult[]>;
		onDataUpdateAwaited?: (
			params: UpdateCell | UpdateCell[],
			expectedSnapshots?: ReadonlyMap<string, { generation: number; value: unknown }>
		) => Promise<DataGridMutationResult[]>;
		onRowsDelete?: (rowIndices: number[]) => Promise<DataGridDeleteResult>;
		onDownload?: () => void | Promise<void>;
		getSelectedRowCount?: () => number;
		getIsDownloading?: () => boolean;
		onColumnClick?: (columnId: string) => void;
		onCellClick?: (rowIndex: number, columnId: string, event?: MouseEvent) => void;
		onCellDoubleClick?: (rowIndex: number, columnId: string) => void;
		onCellMouseDown?: (rowIndex: number, columnId: string, event: MouseEvent) => void;
		onCellMouseEnter?: (rowIndex: number, columnId: string, event: MouseEvent) => void;
		onCellMouseUp?: () => void;
		onCellContextMenu?: (rowIndex: number, columnId: string, event: MouseEvent) => void;
		onCellEditingStart?: (rowIndex: number, columnId: string) => void;
		onCellEditingStop?: (opts?: {
			direction?: NavigationDirection;
			moveToNextRow?: boolean;
		}) => void;
		onCellEditingCancel?: () => void;
		canNavigateToCell?: (
			rowIndex: number,
			columnId: string,
			direction: 'left' | 'right'
		) => boolean;
		onCellsCopy?: () => void;
		onCellsCut?: () => void | Promise<void>;
		onCellsClear?: () => Promise<DataGridClearResult>;
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
		contextMenu?: ContextMenuState;
		onContextMenuOpenChange?: (open: boolean) => void;
		pasteDialog?: PasteDialogState;
		onPasteDialogOpenChange?: (open: boolean) => void;
		onPasteWithExpansion?: () => void;
		onPasteWithoutExpansion?: () => void;
	}
}

// ============================================
// Row Height Constants
// ============================================

export const ROW_HEIGHT_VALUES: Record<RowHeightValue, number> = ROW_HEIGHTS;

// ============================================
// Component Props Types
// ============================================

export type DataGridProps<TData extends RowData> =
	import('$lib/hooks/use-custom-data-grid.svelte.js').UseDataGridReturn<TData> &
		DataGridStatusProps & {
			height?: number;
			class?: string;
		};

// ============================================
// Utility Functions
// ============================================

/**
 * Creates a collision-safe cell key from a stable row id and column id.
 * Numeric row indices remain accepted temporarily for component migration.
 */
export function getCellKey(rowId: string | number, columnId: string): string {
	return JSON.stringify([String(rowId), columnId]);
}

/**
 * Parses a cell key into its stable row id and column id. `rowIndex` is only
 * populated for legacy numeric identities and must not be used for data access.
 */
export function parseCellKey(cellKey: string): CellPosition {
	try {
		const parsed = JSON.parse(cellKey) as unknown;
		if (
			Array.isArray(parsed) &&
			parsed.length === 2 &&
			typeof parsed[0] === 'string' &&
			typeof parsed[1] === 'string'
		) {
			const rowIndex = Number(parsed[0]);
			return {
				rowId: parsed[0],
				rowIndex: Number.isInteger(rowIndex) && rowIndex >= 0 ? rowIndex : 0,
				columnId: parsed[1]
			};
		}
	} catch {
		// Invalid or legacy keys are intentionally not guessed.
	}
	return { rowIndex: 0, columnId: '' };
}

/**
 * Gets the pixel height for a row height value
 */
export function getRowHeightValue(rowHeight: RowHeightValue): number {
	return ROW_HEIGHT_VALUES[rowHeight];
}

/**
 * Gets the line count for a row height value
 */
export function getLineCount(rowHeight: RowHeightValue): number {
	return ROW_LINE_COUNTS[rowHeight];
}

/**
 * Gets common pinning styles for a column (port of TableCN's getCommonPinningStyles)
 */
export function getCommonPinningStyles<TData>(params: {
	column?: Column<TData, unknown>;
	withBorder?: boolean;
}): Record<string, string | number | undefined> {
	const { column, withBorder = false } = params;

	// Return default styles if column is undefined
	if (!column) {
		return {
			position: 'relative',
			background: 'var(--background)',
			zIndex: undefined
		};
	}

	// Wrap in try-catch to handle SSR edge cases where TanStack internal state may not be ready
	try {
		const isPinned = column.getIsPinned();
		const isLastLeftPinnedColumn = isPinned === 'left' && column.getIsLastColumn('left');
		const isFirstRightPinnedColumn = isPinned === 'right' && column.getIsFirstColumn('right');

		return {
			boxShadow: withBorder
				? isLastLeftPinnedColumn
					? '-4px 0 4px -4px var(--border) inset'
					: isFirstRightPinnedColumn
						? '4px 0 4px -4px var(--border) inset'
						: undefined
				: undefined,
			left: isPinned === 'left' ? `${column.getStart('left')}px` : undefined,
			right: isPinned === 'right' ? `${column.getAfter('right')}px` : undefined,
			opacity: isPinned ? 0.97 : 1,
			position: isPinned ? 'sticky' : 'relative',
			background: isPinned ? 'var(--background)' : 'var(--background)',
			width: column.getSize(),
			zIndex: isPinned ? 1 : undefined
		};
	} catch {
		// Return default styles if column methods fail (e.g., during SSR)
		return {
			position: 'relative',
			background: 'var(--background)',
			zIndex: undefined
		};
	}
}
