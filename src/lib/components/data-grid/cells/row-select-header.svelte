<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import type { RowSelectionState, Table } from '@tanstack/table-core';
	import { getContext } from 'svelte';

	interface Props {
		table: Table<any>;
	}

	let { table }: Props = $props();

	const getRowSelection = getContext<() => RowSelectionState>('getRowSelection');

	const rows = $derived(table.getRowModel().rows);
	const rowSelection = $derived(getRowSelection?.() ?? {});
	const selectedCount = $derived(rows.filter((row) => rowSelection[row.id]).length);

	const isAllSelected = $derived(rows.length > 0 && selectedCount === rows.length);
	const isSomeSelected = $derived(selectedCount > 0 && selectedCount < rows.length);
</script>

<div class="flex size-full items-center justify-center px-3 py-1.5">
	<Checkbox
		aria-label="Select all"
		class="relative transition-[shadow,border] after:absolute after:-inset-2.5 after:content-[''] hover:border-primary/40"
		checked={isAllSelected}
		indeterminate={!isAllSelected && isSomeSelected}
		onCheckedChange={(checked) => table.toggleAllPageRowsSelected(!!checked)}
	/>
</div>
