<script lang="ts" generics="TData extends RowData">
	import type { RowData, Table } from '$lib/components/data-grid/data-grid-table.js';
	import type { Snippet } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import FileDown from '@lucide/svelte/icons/file-down';
	import DataGridFilterMenu from './data-grid-filter-menu.svelte';
	import DataGridKeyboardShortcuts from './data-grid-keyboard-shortcuts.svelte';
	import DataGridSortMenu from './data-grid-sort-menu.svelte';
	import DataGridViewMenu from './data-grid-view-menu.svelte';

	interface Props {
		table: Table<TData>;
		enableSearch?: boolean;
		actions?: Snippet;
	}

	let { table, enableSearch = false, actions }: Props = $props();
	const onDownload = $derived(table.options.meta?.onDownload);
	const selectedRowCount = $derived(table.options.meta?.getSelectedRowCount?.() ?? 0);
	const isDownloading = $derived(table.options.meta?.getIsDownloading?.() ?? false);

	async function downloadSelectedRows() {
		await onDownload?.();
	}
</script>

<div role="toolbar" aria-orientation="horizontal" class="flex items-center justify-between">
	<DataGridKeyboardShortcuts {enableSearch} />
	<div class="flex w-full items-center gap-1">
		<DataGridFilterMenu {table} />
		<DataGridSortMenu {table} />
		<DataGridViewMenu {table} />
		{#if onDownload}
			<Button
				variant="outline"
				size="sm"
				class="h-8 font-normal"
				disabled={selectedRowCount === 0 || isDownloading}
				aria-label={`Download ${selectedRowCount} selected row${selectedRowCount === 1 ? '' : 's'}`}
				title="Download selected rows"
				onclick={downloadSelectedRows}
			>
				<FileDown class="text-muted-foreground" />
				{isDownloading ? 'Downloading' : 'Download'}
				{#if selectedRowCount > 0}({selectedRowCount}){/if}
			</Button>
		{/if}
		{@render actions?.()}
	</div>
</div>
