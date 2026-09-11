<script lang="ts" generics="TData extends RowData">
	import type { RowData, Table } from '$lib/components/data-grid/data-grid-table.js';
	import type { RowHeightValue } from '$lib/components/data-grid/types/data-grid.js';
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger
	} from '$lib/components/ui/select/index.js';
	import { cn } from '$lib/utils.js';
	import type { Component } from 'svelte';

	// Icons
	import Minus from '@lucide/svelte/icons/minus';
	import Equal from '@lucide/svelte/icons/equal';
	import AlignVerticalSpaceAround from '@lucide/svelte/icons/align-vertical-space-around';
	import ChevronsDownUp from '@lucide/svelte/icons/chevrons-down-up';

	interface RowHeightOption {
		label: string;
		value: RowHeightValue;
		icon: Component<{ class?: string }>;
	}

	const rowHeights: RowHeightOption[] = [
		{ label: 'Short', value: 'short', icon: Minus },
		{ label: 'Medium', value: 'medium', icon: Equal },
		{ label: 'Tall', value: 'tall', icon: AlignVerticalSpaceAround },
		{ label: 'Extra Tall', value: 'extra-tall', icon: ChevronsDownUp }
	];

	interface Props {
		table: Table<TData>;
		align?: 'start' | 'center' | 'end';
		showLabel?: boolean;
		class?: string;
	}

	let { table, align = 'start', showLabel = false, class: className }: Props = $props();

	const rowHeight = $derived(table.options.meta?.rowHeight ?? 'short');
	const onRowHeightChange = $derived(table.options.meta?.onRowHeightChange);

	const selectedRowHeight = $derived(
		rowHeights.find((opt) => opt.value === rowHeight) ?? rowHeights[0]
	);

	function handleValueChange(value: string) {
		onRowHeightChange?.(value as RowHeightValue);
	}
</script>

<Select type="single" value={rowHeight} onValueChange={handleValueChange}>
	<SelectTrigger size="sm" class={cn('[&_svg:nth-child(2)]:hidden', className)}>
		<span
			data-slot="select-value"
			class={cn('flex items-center gap-2', showLabel && 'flex-col items-start gap-0')}
		>
			{#if showLabel}
				<span class="text-muted-foreground text-xs font-medium">Row height</span>
			{/if}
			{#if selectedRowHeight}
				{@const Icon = selectedRowHeight.icon}
				<span class="flex items-center gap-2">
					<Icon class="size-4" />
					{selectedRowHeight.label}
				</span>
			{:else}
				Row height
			{/if}
		</span>
	</SelectTrigger>
	<SelectContent {align}>
		{#each rowHeights as option (option.value)}
			{@const OptionIcon = option.icon}
			<SelectItem value={option.value}>
				<OptionIcon class="size-4" />
				{option.label}
			</SelectItem>
		{/each}
	</SelectContent>
</Select>
