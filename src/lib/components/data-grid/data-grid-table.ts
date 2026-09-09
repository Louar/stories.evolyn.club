import {
	columnFilteringFeature,
	columnOrderingFeature,
	columnPinningFeature,
	columnResizingFeature,
	columnSizingFeature,
	columnVisibilityFeature,
	createFilteredRowModel,
	createSortedRowModel,
	filterFn_arrIncludes,
	filterFn_equals,
	filterFn_inDateRange,
	filterFn_inNumberRange,
	filterFn_includesString,
	filterFn_weakEquals,
	rowSelectionFeature,
	rowSortingFeature,
	sortFn_alphanumeric,
	sortFn_datetime,
	sortFn_text,
	tableFeatures,
	type Cell as TanStackCell,
	type Column as TanStackColumn,
	type ColumnDef as TanStackColumnDef,
	type FilterFn as TanStackFilterFn,
	type Header as TanStackHeader,
	type Row as TanStackRow,
	type RowData,
	type Table as TanStackTable,
	type TableOptions as TanStackTableOptions
} from '@tanstack/svelte-table';

export const dataGridFeatures = tableFeatures({
	columnFilteringFeature,
	columnOrderingFeature,
	columnPinningFeature,
	columnSizingFeature,
	columnResizingFeature,
	columnVisibilityFeature,
	rowSelectionFeature,
	rowSortingFeature,
	filteredRowModel: createFilteredRowModel(),
	sortedRowModel: createSortedRowModel(),
	filterFns: {
		includesString: filterFn_includesString,
		inNumberRange: filterFn_inNumberRange,
		equals: filterFn_equals,
		arrIncludes: filterFn_arrIncludes,
		inDateRange: filterFn_inDateRange,
		weakEquals: filterFn_weakEquals
	},
	sortFns: {
		alphanumeric: sortFn_alphanumeric,
		text: sortFn_text,
		datetime: sortFn_datetime
	}
});

export type DataGridFeatures = typeof dataGridFeatures;
export type Cell<TData extends RowData, TValue = unknown> = TanStackCell<
	DataGridFeatures,
	TData,
	TValue
>;
export type Column<TData extends RowData, TValue = unknown> = TanStackColumn<
	DataGridFeatures,
	TData,
	TValue
>;
export type ColumnDef<TData extends RowData, TValue = unknown> = TanStackColumnDef<
	DataGridFeatures,
	TData,
	TValue
>;
export type FilterFn<TData extends RowData> = TanStackFilterFn<DataGridFeatures, TData>;
export type Header<TData extends RowData, TValue = unknown> = TanStackHeader<
	DataGridFeatures,
	TData,
	TValue
>;
export type Row<TData extends RowData> = TanStackRow<DataGridFeatures, TData>;
export type Table<TData extends RowData> = TanStackTable<DataGridFeatures, TData>;
export type TableOptions<TData extends RowData> = TanStackTableOptions<DataGridFeatures, TData>;

export type {
	ColumnFilter,
	ColumnFiltersState,
	ColumnOrderState,
	ColumnPinningState,
	columnResizingState as ColumnResizingState,
	ColumnSizingState,
	ColumnVisibilityState as VisibilityState,
	RowData,
	RowSelectionState,
	SortingState,
	ColumnSort,
	SortDirection
} from '@tanstack/svelte-table';
