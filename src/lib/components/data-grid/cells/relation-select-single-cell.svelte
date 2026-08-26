<script lang="ts" generics="TData">
	import type { CellVariantProps } from '$lib/components/data-grid/types/data-grid.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { cn } from '$lib/utils.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { Popover as PopoverPrimitive } from 'bits-ui';
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

	const meta = $derived(table.options.meta);

	const cellOpts = $derived(cell.column.columnDef.meta?.cell);
	const options = $derived.by(() =>
		cellOpts?.variant === 'relation-select-single' ? cellOpts.options : []
	);

	let wrapperRef = $state<HTMLDivElement | null>(null);
	let inputRef = $state<HTMLInputElement | null>(null);

	const sideOffset = $derived.by(() => -(wrapperRef?.clientHeight ?? 0));

	let searchValue = $state('');

	// svelte-ignore state_referenced_locally
	let previousValue: string | null = $state((cellValue as string) ?? null);
	// svelte-ignore state_referenced_locally
	let nextValue: string | null = $state((cellValue as string) ?? null);

	const displayLabel = $derived.by(() => {
		const opt = options.find((o) => o.value === nextValue);
		return opt?.title ?? nextValue;
	});

	function commit(value: string | null) {
		if (readOnly) return;

		// match prior behavior: ignore null/empty inputs (selection is always a string)
		if (!value) return;

		// toggle back to null if selecting the original value again
		nextValue = value === previousValue ? null : value;

		meta?.onDataUpdate?.({ rowIndex, rowId: cell.row.id, columnId, value: nextValue });
		meta?.onCellEditingStop?.();
	}

	function handleOpenAutoFocus(event: Event) {
		event.preventDefault();
		inputRef?.focus();
	}

	function handleOpenChange(open: boolean) {
		if (open && !readOnly) meta?.onCellEditingStart?.(rowIndex, columnId);
		else meta?.onCellEditingStop?.();
	}

	function handleWrapperKeyDown(event: KeyboardEvent) {
		if (isEditing && event.key === 'Escape') {
			event.preventDefault();
			nextValue = previousValue;
			meta?.onCellEditingCancel?.();
			return;
		}

		if (!isEditing && isFocused && event.key === 'Tab') {
			if (!meta?.canNavigateToCell?.(rowIndex, columnId, event.shiftKey ? 'left' : 'right')) return;
			event.preventDefault();
			meta?.onCellEditingStop?.({
				direction: event.shiftKey ? 'left' : 'right'
			});
		}
	}

	function handleInputKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			searchValue = '';
			event.stopPropagation();
			meta?.onCellEditingCancel?.();
		}
	}

	// Reset transient state when leaving edit mode
	$effect(() => {
		if (!isEditing) {
			searchValue = '';
			// keep nextValue as-is (it represents the latest committed/optimistic value),
			// but refresh previousValue from the prop source for the next edit session
			previousValue = (cellValue as string) ?? null;
			if (nextValue !== previousValue) nextValue = previousValue;
		} else {
			// snapshot starting value for "toggle-to-null" + cancel
			previousValue = (cellValue as string) ?? null;
			nextValue = previousValue;
		}
	});
</script>

<DataGridCellWrapper
	bind:wrapperRef
	{cell}
	{table}
	{rowIndex}
	{columnId}
	{isEditing}
	{isFocused}
	{isSelected}
	onkeydown={handleWrapperKeyDown}
>
	{#if !isEditing}
		<span data-slot="grid-cell-content">{displayLabel}</span>
	{:else}
		<PopoverPrimitive.Root open={isEditing} onOpenChange={handleOpenChange}>
			<Popover.Content
				data-grid-cell-editor=""
				align="start"
				{sideOffset}
				class="-mt-px -ml-px w-64 rounded-none p-0"
				onOpenAutoFocus={handleOpenAutoFocus}
				customAnchor={wrapperRef}
				onkeydown={handleWrapperKeyDown}
			>
				<Command.Root
					class="**:data-[slot=command-input-wrapper]:h-auto **:data-[slot=command-input-wrapper]:border-none **:data-[slot=command-input-wrapper]:p-0"
				>
					<div class="flex min-h-9 flex-wrap items-center gap-1 border-b px-3 py-1.5">
						<Command.Input
							bind:ref={inputRef}
							bind:value={searchValue}
							onkeydown={handleInputKeyDown}
							placeholder="Search..."
							class="h-auto flex-1 p-0"
						/>
					</div>

					<Command.List class="max-h-full">
						<Command.Empty>No options found.</Command.Empty>

						<Command.Group class="max-h-75 scroll-py-1 overflow-x-hidden overflow-y-auto">
							{#each options as option (option.value)}
								{@const isItemSelected = option.value === nextValue}
								<Command.Item
									value="{option.value} {option.title}"
									onSelect={() => commit(option.value)}
								>
									<CheckIcon
										class={cn(
											'mt-0.5 size-4 shrink-0 self-start',
											isItemSelected ? 'opacity-100' : 'opacity-0'
										)}
									/>
									<div class="grow">
										<p class="line-clamp-1 text-sm">{option.title}</p>
										{#if option.summary?.length}
											<p class="line-clamp-2 text-xs text-muted-foreground">
												{option.summary}
											</p>
										{/if}
									</div>
								</Command.Item>
							{/each}
						</Command.Group>
					</Command.List>
				</Command.Root>
			</Popover.Content>
		</PopoverPrimitive.Root>
	{/if}
</DataGridCellWrapper>
