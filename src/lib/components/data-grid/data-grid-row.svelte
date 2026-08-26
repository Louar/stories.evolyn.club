<script lang="ts" generics="TData">
	/* eslint-disable @typescript-eslint/no-unused-vars */
	import type { CellPosition, RowHeightValue } from '$lib/components/data-grid/types/data-grid.js';
	import { getRowHeightValue } from '$lib/components/data-grid/types/data-grid.js';
	import { cn } from '$lib/utils.js';
	import type {
		ColumnPinningState,
		ColumnSizingState,
		Row,
		Table,
		VisibilityState
	} from '@tanstack/table-core';
	import { SvelteMap, type SvelteSet } from 'svelte/reactivity';
	import DataGridCell from './data-grid-cell.svelte';

	// Use 'any' for VirtualizerReturn to avoid type conflicts between different definitions
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type VirtualizerReturn = any;

	interface Props {
		row: Row<TData>;
		table: Table<TData>;
		columnPinning: ColumnPinningState;
		columnVisibility: VisibilityState;
		columnSizing: ColumnSizingState;
		/** SvelteSet for fine-grained selection reactivity */
		selectedCellsSet: SvelteSet<string> | undefined;
		rowVirtualizer: VirtualizerReturn;
		virtualRowIndex: number;
		virtualStart: number;
		rowMapRef: Map<number, HTMLDivElement>;
		rowHeight: RowHeightValue;
		focusedCell: CellPosition | null;
		headerRowCount: number;
		class?: string;
	}

	let {
		row,
		table,
		columnPinning,
		columnVisibility,
		columnSizing,
		selectedCellsSet,
		virtualRowIndex,
		virtualStart,
		rowVirtualizer,
		rowMapRef,
		rowHeight,
		focusedCell,
		headerRowCount,
		class: className
	}: Props = $props();

	let rowRef = $state<HTMLDivElement | null>(null);

	// Handle row ref changes - measure and track in rowMap
	$effect(() => {
		if (rowRef) {
			rowVirtualizer.measureElement(rowRef);
			rowMapRef.set(virtualRowIndex, rowRef);
		}

		return () => {
			rowMapRef.delete(virtualRowIndex);
		};
	});

	// Row selection is reactive via table state
	const isRowSelected = $derived(row.getIsSelected());

	// Get visible cells in correct order (left pinned -> center -> right pinned)
	// We manually construct the order using table's column methods since Row.getVisibleCells()
	// doesn't automatically update when pinning changes
	const visibleCells = $derived.by(() => {
		// Read columnPinning and columnVisibility to create dependencies
		const _pinning = columnPinning;
		const _visibility = columnVisibility;

		// Helper to check if column is visible
		const isColumnVisible = (colId: string) => columnVisibility[colId] !== false;

		// Get columns in correct order: left pinned, center (unpinned), right pinned
		// Filter by visibility
		const leftCols = table.getLeftLeafColumns().filter((c) => isColumnVisible(c.id));
		const centerCols = table.getCenterLeafColumns().filter((c) => isColumnVisible(c.id));
		const rightCols = table.getRightLeafColumns().filter((c) => isColumnVisible(c.id));

		// Combine in order
		const orderedColumnIds = [
			...leftCols.map((c) => c.id),
			...centerCols.map((c) => c.id),
			...rightCols.map((c) => c.id)
		];

		// Get all cells and create a lookup map
		const allCells = row.getAllCells();
		const cellMap = new Map(allCells.map((cell) => [cell.column.id, cell]));

		// Return cells in the correct order, filtering out any missing ones
		return orderedColumnIds
			.map((id) => cellMap.get(id))
			.filter((cell): cell is NonNullable<typeof cell> => cell != null);
	});

	// Precompute ALL pinning styles - re-runs when columnPinning prop changes
	const pinningStylesMap = $derived.by(() => {
		// Read columnPinning prop to ensure this re-runs when it changes
		const _ = columnPinning;

		const stylesMap = new SvelteMap<string, Record<string, string | number | undefined>>();

		for (const cell of row.getAllCells()) {
			const column = cell.column;
			try {
				const isPinned = column.getIsPinned();
				const isLastLeftPinnedColumn = isPinned === 'left' && column.getIsLastColumn('left');
				const isFirstRightPinnedColumn = isPinned === 'right' && column.getIsFirstColumn('right');

				stylesMap.set(column.id, {
					boxShadow: isLastLeftPinnedColumn
						? '-4px 0 4px -4px var(--border) inset'
						: isFirstRightPinnedColumn
							? '4px 0 4px -4px var(--border) inset'
							: undefined,
					left: isPinned === 'left' ? `${column.getStart('left')}px` : undefined,
					right: isPinned === 'right' ? `${column.getAfter('right')}px` : undefined,
					opacity: isPinned ? 0.97 : 1,
					position: isPinned ? 'sticky' : 'relative',
					background: 'var(--background)',
					zIndex: isPinned ? 1 : undefined
				});
			} catch {
				stylesMap.set(column.id, {
					position: 'relative',
					background: 'var(--background)',
					zIndex: undefined
				});
			}
		}

		return stylesMap;
	});

	// Helper to get pinning styles - just looks up from the reactive map
	function getPinningStyles(columnId: string): Record<string, string | number | undefined> {
		return (
			pinningStylesMap.get(columnId) ?? {
				position: 'relative',
				background: 'var(--background)',
				zIndex: undefined
			}
		);
	}

	// Compute total visible width for this row (sum of visible cell widths)
	// Read columnSizing prop to create reactive dependency on column resize
	const totalVisibleWidth = $derived.by(() => {
		const _ = columnSizing; // Create reactive dependency
		let total = 0;
		for (const cell of visibleCells) {
			total += cell.column.getSize();
		}
		return total;
	});
</script>

<div
	role="row"
	aria-rowindex={headerRowCount + virtualRowIndex + 1}
	aria-selected={isRowSelected}
	data-index={virtualRowIndex}
	data-slot="grid-row"
	bind:this={rowRef}
	tabindex={-1}
	class={cn(
		'absolute top-0 left-0 flex border-b will-change-transform last-of-type:border-0',
		className
	)}
	style="transform: translateY({virtualStart}px); height: {getRowHeightValue(
		rowHeight
	)}px; width: max(100%, {totalVisibleWidth}px); min-width: 100%;"
>
	{#each visibleCells as cell (cell.id)}
		{@const isCellFocused =
			(focusedCell?.rowId
				? focusedCell.rowId === row.id
				: focusedCell?.rowIndex === virtualRowIndex) && focusedCell?.columnId === cell.column.id}
		{@const pinningStyles = getPinningStyles(cell.column.id)}

		<div
			role="presentation"
			data-highlighted={isCellFocused ? '' : undefined}
			data-slot="grid-cell"
			class="border-r last-of-type:border-0"
			style="position: {pinningStyles.position}; left: {pinningStyles.left}; right: {pinningStyles.right}; background: {pinningStyles.background}; z-index: {pinningStyles.zIndex}; width: calc(var(--col-{cell
				.column.id}-size) * 1px);"
		>
			<!-- Use DataGridCell for variant-based rendering (handles all cell types via meta.cell.variant) -->
			<DataGridCell {cell} {table} {selectedCellsSet} />
		</div>
	{/each}
</div>
