<script lang="ts" generics="TData">
	import { parseCellKey } from '$lib/components/data-grid/types/data-grid.js';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSeparator,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu/index.js';
	import Copy from '@lucide/svelte/icons/copy';
	import Eraser from '@lucide/svelte/icons/eraser';
	import FileDownIcon from '@lucide/svelte/icons/file-down';
	import Scissors from '@lucide/svelte/icons/scissors';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import type { Table } from '@tanstack/table-core';
	import { toast } from 'svelte-sonner';

	interface Props {
		table: Table<TData>;
	}

	let { table }: Props = $props();

	const meta = $derived(table.options.meta);
	const contextMenu = $derived(meta?.contextMenu);
	const onContextMenuOpenChange = $derived(meta?.onContextMenuOpenChange);
	const selectionState = $derived(meta?.selectionState);
	const dataGridRef = $derived(meta?.dataGridRef);
	const onRowsDelete = $derived(meta?.onRowsDelete);
	const onDownload = $derived(meta?.onDownload);
	const onCellsCopy = $derived(meta?.onCellsCopy);
	const onCellsCut = $derived(meta?.onCellsCut);
	const onCellsClear = $derived(meta?.onCellsClear);
	const readOnly = $derived(meta?.readOnly ?? false);

	// Trigger style to position the menu at the context menu coordinates
	const triggerStyle = $derived.by(() => {
		if (!contextMenu) return '';
		return `position: fixed; left: ${contextMenu.x}px; top: ${contextMenu.y}px; width: 1px; height: 1px; padding: 0; margin: 0; border: none; background: transparent; pointer-events: none; opacity: 0;`;
	});

	function onCloseAutoFocus(event: Event) {
		event.preventDefault();
		if (dataGridRef instanceof HTMLElement) {
			dataGridRef.focus();
		}
	}

	function onCopy() {
		onCellsCopy?.();
	}

	async function onCut() {
		await onCellsCut?.();
	}

	function resolveCellPosition(cellKey: string) {
		const position = parseCellKey(cellKey);
		const rowIndex = position.rowId
			? table.getRowModel().rows.findIndex((row) => row.id === position.rowId)
			: position.rowIndex;
		return { ...position, rowIndex };
	}

	async function onClear() {
		const result = await onCellsClear?.();
		if (!result) return;
		const parts = [
			`${result.clearedCellCount} cell${result.clearedCellCount === 1 ? '' : 's'} cleared`
		];
		if (result.failedCellCount) parts.push(`${result.failedCellCount} failed`);
		if (result.deletedMediaCount) parts.push(`${result.deletedMediaCount} media deleted`);
		if (result.retainedMediaCount) parts.push(`${result.retainedMediaCount} shared media retained`);
		if (result.failedMediaCount) parts.push(`${result.failedMediaCount} media deletions failed`);
		const message = parts.join(', ');
		if (result.failedCellCount || result.failedMediaCount) toast.error(message);
		else if (result.clearedCellCount) toast.success(message);
	}

	async function onDelete() {
		const rows = table.getRowModel().rows;
		const rowIndices = rows.flatMap((row, rowIndex) => (row.getIsSelected() ? [rowIndex] : []));

		if (rowIndices.length === 0) {
			if (!selectionState?.selectedCells || selectionState.selectedCells.size === 0) return;
			for (const cellKey of selectionState.selectedCells) {
				const { rowIndex } = resolveCellPosition(cellKey);
				if (rowIndex >= 0 && !rowIndices.includes(rowIndex)) rowIndices.push(rowIndex);
			}
		}

		const rowIndicesArray = rowIndices.sort((a, b) => a - b);
		const result = await onRowsDelete?.(rowIndicesArray);
		const rowCount = result?.deletedRowIds.length ?? 0;
		if (rowCount > 0) toast.success(`${rowCount} row${rowCount !== 1 ? 's' : ''} deleted`);
		if (result?.failedRowIds.length) {
			toast.error(
				`${result.failedRowIds.length} row${result.failedRowIds.length !== 1 ? 's' : ''} could not be deleted`
			);
		}
	}

	async function onDownloadRows() {
		await onDownload?.();
	}
</script>

{#if contextMenu}
	<DropdownMenu open={contextMenu.open} onOpenChange={onContextMenuOpenChange}>
		<DropdownMenuTrigger style={triggerStyle}></DropdownMenuTrigger>
		<DropdownMenuContent data-grid-popover="" align="start" class="w-48" {onCloseAutoFocus}>
			<DropdownMenuItem onSelect={onCopy}>
				<Copy class="mr-2 size-4" />
				Copy
			</DropdownMenuItem>
			<DropdownMenuItem onSelect={onCut} disabled={readOnly}>
				<Scissors class="mr-2 size-4" />
				Cut
			</DropdownMenuItem>
			<DropdownMenuItem onSelect={onClear} disabled={readOnly}>
				<Eraser class="mr-2 size-4" />
				Clear
			</DropdownMenuItem>
			{#if onDownload && contextMenu.isSelectedRow}
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={onDownloadRows} disabled={meta?.getIsDownloading?.()}>
					<FileDownIcon class="mr-2 size-4" />
					Download
				</DropdownMenuItem>
			{/if}
			{#if onRowsDelete && contextMenu.isSelectedRow}
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="destructive" onSelect={onDelete}>
					<Trash2 class="mr-2 size-4" />
					Delete rows
				</DropdownMenuItem>
			{/if}
		</DropdownMenuContent>
	</DropdownMenu>
{/if}
