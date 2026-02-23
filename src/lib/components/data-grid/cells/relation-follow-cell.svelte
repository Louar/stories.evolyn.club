<script lang="ts" generics="TData">
	import type { CellVariantProps } from '$lib/components/data-grid/types/data-grid.js';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import DataGridCellWrapper from '../data-grid-cell-wrapper.svelte';

	let {
		cell,
		table,
		rowIndex,
		columnId,
		isEditing,
		isFocused,
		isSelected,
		readOnly = false,
		cellValue
	}: CellVariantProps<TData> = $props();

	const label = $derived((cellValue as string) ?? '');
	const meta = $derived(
		cell.column.columnDef.meta?.cell as
			| Extract<
					NonNullable<CellVariantProps<TData>['cell']['column']['columnDef']['meta']>['cell'],
					{ variant: 'relation-follow' }
			  >
			| undefined
	);
	const url = $derived.by(() => {
		const template = meta?.url;
		if (!template?.length) return '';
		const original = cell.row.original;
		if (original && typeof original === 'object' && 'id' in original) {
			const id = (original as { id?: unknown }).id;
			return template
				.replace('{row}', id == null ? '' : String(id))
				.replace(/\{([^}]+)\}/g, (_, path) => {
					const value = path.split('.').reduce((obj: any, key: string) => obj?.[key], original);

					return value == null ? '' : String(value);
				});
		}
		return template;
	});
</script>

<DataGridCellWrapper
	{cell}
	{table}
	{rowIndex}
	{columnId}
	isEditing={false}
	{isFocused}
	{isSelected}
	class="p-0"
>
	<div data-slot="grid-cell-content" class="size-full overflow-hidden">
		<a
			href={url}
			rel="noopener noreferrer"
			class="group flex size-full items-center px-2 py-1.5 text-muted-foreground decoration-primary/30 underline-offset-4 {url?.length
				? 'hover:decoration-primary/60} hover:text-primary hover:underline'
				: ''}"
			onclick={(event) => {
				if (url?.length) event.stopPropagation();
			}}
		>
			<span class="grow truncate">{label}</span>
			{#if url?.length && !url.includes('{')}
				<ArrowRightIcon
					class="size-4 shrink-0 text-muted-foreground transition-colors {url?.length
						? 'group-hover:text-foreground}'
						: ''}"
				/>
			{/if}
		</a>
	</div>
</DataGridCellWrapper>
