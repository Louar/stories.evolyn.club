<script lang="ts" generics="TData extends RowData">
	import { getCellKey } from '$lib/components/data-grid/types/data-grid.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import type { Row, RowData, Table } from '$lib/components/data-grid/data-grid-table.js';

	interface Props {
		row: Row<TData>;
		table: Table<TData>;
		rowIndex: number;
		columnId: string;
	}

	let { row, table, rowIndex, columnId }: Props = $props();

	// Read rowSelection from table state to create reactive dependency
	// This ensures the component re-renders when selection changes
	const rowSelection = $derived(table.atoms.rowSelection.get());
	const isSelected = $derived(rowSelection[row.id] ?? false);
	const meta = $derived(table.options.meta);
	const columnIndex = $derived.by(() => {
		const orderedColumns = [
			...table.getStartVisibleLeafColumns(),
			...table.getCenterVisibleLeafColumns(),
			...table.getEndVisibleLeafColumns()
		];
		return orderedColumns.findIndex((column) => column.id === columnId) + 1;
	});

	const hasRowError = $derived.by(() => {
		const hasErrorMatchSet = meta?.hasErrorMatchSet;
		if (!hasErrorMatchSet) return false;
		const cells = row.getAllCells();
		return cells.some((cell) => hasErrorMatchSet.has(getCellKey(row.id, cell.column.id)));
	});

	function handleCheckedChange(checked: boolean | 'indeterminate') {
		const onRowSelect = meta?.onRowSelect;
		if (onRowSelect) {
			onRowSelect(rowIndex, !!checked, false);
		} else {
			row.toggleSelected(!!checked);
		}
	}

	function handleClick(event: MouseEvent) {
		if (event.shiftKey) {
			event.preventDefault();
			const onRowSelect = meta?.onRowSelect;
			if (onRowSelect) {
				onRowSelect(rowIndex, !isSelected, true);
			}
		}
	}

	function handleMouseDown(event: MouseEvent) {
		event.stopPropagation();
	}
</script>

<div
	role="gridcell"
	aria-colindex={columnIndex}
	aria-selected={isSelected}
	aria-invalid={hasRowError ? 'true' : undefined}
	class="flex size-full justify-center px-3 py-2 {isSelected ? 'highlight' : ''} {hasRowError
		? 'bg-rose-50 ring-1 ring-rose-300 ring-inset dark:bg-rose-900/30 dark:ring-rose-500/50'
		: ''}"
>
	<Checkbox
		aria-label="Select row"
		tabindex={-1}
		class="relative transition-[shadow,border] after:absolute after:-inset-2.5 after:content-[''] hover:border-primary/40"
		checked={isSelected}
		onCheckedChange={handleCheckedChange}
		onclick={handleClick}
		onmousedown={handleMouseDown}
	/>
</div>
