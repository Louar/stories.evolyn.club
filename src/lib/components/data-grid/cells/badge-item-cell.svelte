<script lang="ts" generics="TData">
	import type { CellVariantProps } from '$lib/components/data-grid/types/data-grid.js';
	import { AvatarMedia } from '$lib/components/ui/avatar-media/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import type { Media } from '$lib/db/schemas/0-utils.js';
	import DataGridCellWrapper from '../data-grid-cell-wrapper.svelte';

	type Item = {
		id: string;
		label: string | null;
		image: Media | null;
	} | null;

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

	const item = $derived((cellValue as Item) ?? null);
	const label = $derived(item?.label ?? '?');
	const fallback = $derived(label?.trim()?.[0]?.toUpperCase() ?? '?');

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
	class="flex size-full"
>
	{#if item}
		<Badge href={url} variant="secondary" class="h-5 gap-1 px-1.5 text-xs">
			<AvatarMedia src={item.image} {fallback} class="size-4 rounded-full border" />
			<span class="max-w-32 truncate">{label}</span>
		</Badge>
	{/if}
</DataGridCellWrapper>
