<script lang="ts" generics="TData extends RowData">
	import type { RowData } from '../data-grid-table.js';
	import type { CellVariantProps } from '$lib/components/data-grid/types/data-grid.js';
	import FileOrUrlCell from './file-or-url-cell.svelte';

	let props: CellVariantProps<TData> = $props();
</script>

<FileOrUrlCell {...props} enableLibrary />
