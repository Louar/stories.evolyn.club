<script lang="ts" generics="TData">
	import type {
		CellVariantProps,
		DataGridCellAction
	} from '$lib/components/data-grid/types/data-grid.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu/index.js';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis-vertical';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import DataGridCellWrapper from '../data-grid-cell-wrapper.svelte';

	let { cell, table, rowIndex, columnId, isFocused, isSelected }: CellVariantProps<TData> =
		$props();

	let pendingAction = $state<string>();
	const row = $derived(cell.row.original);
	const meta = $derived(
		cell.column.columnDef.meta?.cell as
			| {
					variant: 'actions';
					actions: DataGridCellAction<TData>[] | ((row: TData) => DataGridCellAction<TData>[]);
			  }
			| undefined
	);
	const actions = $derived.by(() => {
		if (!meta) return [];
		return typeof meta.actions === 'function' ? meta.actions(row) : meta.actions;
	});

	function isDisabled(action: DataGridCellAction<TData>) {
		return (
			pendingAction !== undefined ||
			(typeof action.disabled === 'function' ? action.disabled(row) : action.disabled === true)
		);
	}

	async function runAction(action: DataGridCellAction<TData>) {
		if (isDisabled(action)) return;
		pendingAction = action.label;
		try {
			await action.onSelect(row);
		} finally {
			pendingAction = undefined;
		}
	}
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
	<div data-slot="grid-cell-content" class="flex size-full items-center justify-center">
		<DropdownMenu>
			<DropdownMenuTrigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="ghost"
						aria-label="Open row actions"
						disabled={actions.length === 0 || pendingAction !== undefined}
						class="size-full rounded-none"
					>
						{#if pendingAction}
							<LoaderCircleIcon class="size-4 animate-spin" />
						{:else}
							<EllipsisIcon class="size-4" />
						{/if}
					</Button>
				{/snippet}
			</DropdownMenuTrigger>
			<DropdownMenuContent data-grid-popover="" align="end" class="w-56">
				{#each actions as action (action.label)}
					<DropdownMenuItem disabled={isDisabled(action)} onSelect={() => runAction(action)}>
						{#if action.icon}
							{@const Icon = action.icon}
							<Icon class="size-4" />
						{/if}
						{action.label}
					</DropdownMenuItem>
				{/each}
			</DropdownMenuContent>
		</DropdownMenu>
	</div>
</DataGridCellWrapper>
