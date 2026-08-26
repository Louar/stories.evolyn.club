<script lang="ts" generics="TData">
	import type { CellVariantProps } from '$lib/components/data-grid/types/data-grid.js';
	import * as Button from '$lib/components/ui/button/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
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
	const initialValue = $derived((cellValue as string) ?? '');
	const cellOpts = $derived(cell.column.columnDef.meta?.cell);
	const options = $derived.by(() =>
		cellOpts?.variant === 'input-with-suggestions' ? cellOpts.options : []
	);

	let wrapperRef = $state<HTMLDivElement | null>(null);
	let inputRef = $state<HTMLInputElement | null>(null);
	let searchRef = $state<HTMLInputElement | null>(null);
	let localEditValue = $state<string | null>(null);
	let searchValue = $state('');
	let isTemplateOpen = $state(false);
	const editValue = $derived(localEditValue ?? initialValue);

	const sideOffset = $derived.by(() => -(wrapperRef?.clientHeight ?? 0));

	let previousEditing = $state(false);
	type StopOptions = { direction?: 'up' | 'down' | 'left' | 'right'; moveToNextRow?: boolean };

	$effect(() => {
		if (isEditing === previousEditing) return;
		previousEditing = isEditing;
		if (isEditing) {
			localEditValue = null;
			queueMicrotask(() => inputRef?.focus());
		} else {
			localEditValue = null;
			searchValue = '';
			isTemplateOpen = false;
		}
	});

	function commit(nextValue = editValue, stopOptions?: StopOptions) {
		if (!readOnly && nextValue !== initialValue) {
			meta?.onDataUpdate?.({ rowIndex, rowId: cell.row.id, columnId, value: nextValue });
		}
		meta?.onCellEditingStop?.(stopOptions);
	}

	function cancel() {
		localEditValue = null;
		searchValue = '';
		isTemplateOpen = false;
		if (inputRef) inputRef.value = initialValue;
		meta?.onCellEditingCancel?.();
	}

	function selectTemplate(value: string) {
		if (readOnly) return;
		localEditValue = value;
		isTemplateOpen = false;
		queueMicrotask(() => inputRef?.focus());
	}

	function handleWrapperKeyDown(event: KeyboardEvent) {
		if (isEditing) {
			if (event.key === 'Enter') {
				event.preventDefault();
				commit(editValue, { moveToNextRow: true });
			} else if (event.key === 'Tab') {
				if (!meta?.canNavigateToCell?.(rowIndex, columnId, event.shiftKey ? 'left' : 'right')) {
					commit(editValue);
					return;
				}
				event.preventDefault();
				commit(editValue, { direction: event.shiftKey ? 'left' : 'right' });
			} else if (event.key === 'Escape') {
				event.preventDefault();
				event.stopPropagation();
				cancel();
			}
		}
	}

	function handleOpenAutoFocus(event: Event) {
		event.preventDefault();
		searchRef?.focus();
	}

	function handleBlur(event: FocusEvent) {
		const nextTarget = event.relatedTarget as Node | null;
		if (wrapperRef?.contains(nextTarget)) return;
		if (!isTemplateOpen) commit();
	}
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
		<span data-slot="grid-cell-content">{initialValue}</span>
	{:else}
		<div class="flex size-full items-center gap-1" onfocusout={handleBlur}>
			<input
				bind:this={inputRef}
				value={editValue}
				oninput={(event) => (localEditValue = event.currentTarget.value)}
				readonly={readOnly}
				class="min-w-0 flex-1 bg-transparent px-1 outline-none"
			/>

			<PopoverPrimitive.Root bind:open={isTemplateOpen}>
				<Popover.Trigger>
					{#snippet child({ props })}
						<Button.Root
							{...props}
							variant="ghost"
							size="icon"
							class="size-7 shrink-0"
							disabled={readOnly}
							aria-label="Select suggestion"
						>
							<ChevronsUpDownIcon class="size-4" />
						</Button.Root>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content
					data-grid-cell-editor=""
					align="end"
					{sideOffset}
					class="w-96 rounded-none p-0"
					onOpenAutoFocus={handleOpenAutoFocus}
					customAnchor={wrapperRef}
					onkeydown={handleWrapperKeyDown}
				>
					<Command.Root
						class="**:data-[slot=command-input-wrapper]:h-auto **:data-[slot=command-input-wrapper]:border-none **:data-[slot=command-input-wrapper]:p-0"
					>
						<div class="flex min-h-9 w-full flex-wrap items-center gap-1 border-b px-3 py-1.5">
							<Command.Input
								bind:ref={searchRef}
								bind:value={searchValue}
								placeholder="Search suggestions..."
								class="h-auto w-full flex-1 p-0"
							/>
						</div>

						<Command.List class="max-h-full">
							<Command.Empty>No suggestions found.</Command.Empty>

							<Command.Group class="max-h-75 scroll-py-1 overflow-x-hidden overflow-y-auto">
								{#each options as option (option.value)}
									<Command.Item
										value="{option.value} {option.title} {option.summary ?? ''}"
										onSelect={() => selectTemplate(option.value)}
									>
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
		</div>
	{/if}
</DataGridCellWrapper>
