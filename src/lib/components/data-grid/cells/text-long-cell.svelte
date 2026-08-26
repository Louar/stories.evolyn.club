<script lang="ts" generics="TData">
	import type { CellVariantProps } from '$lib/components/data-grid/types/data-grid.js';
	import { PopoverContent } from '$lib/components/ui/popover/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
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

	// Use centralized cellValue prop - fine-grained reactivity is handled by DataGridCell
	const initialValue = $derived((cellValue as string) ?? '');
	let textareaRef = $state<HTMLTextAreaElement | null>(null);
	let containerRef = $state<HTMLDivElement | null>(null);
	const sideOffset = $derived(-(containerRef?.clientHeight ?? 0));

	// Track timeout for debounced save
	let saveTimeoutId: ReturnType<typeof setTimeout> | null = null;

	// Track local edits separately - this only matters during editing
	let localEditValue = $state<string | null>(null);
	let editStartValue = $state('');
	let editingSessionActive = false;

	// Value for display and tracking - use localEditValue if set, otherwise initialValue
	const value = $derived(localEditValue ?? initialValue ?? '');

	// Reset local edit value when editing stops
	$effect(() => {
		if (isEditing && !editingSessionActive) {
			editingSessionActive = true;
			editStartValue = initialValue;
			localEditValue = initialValue;
		} else if (!isEditing) {
			editingSessionActive = false;
			if (saveTimeoutId) clearTimeout(saveTimeoutId);
			saveTimeoutId = null;
			localEditValue = null;
		}
		return () => {
			if (saveTimeoutId) clearTimeout(saveTimeoutId);
		};
	});

	// Debounced auto-save
	function debouncedSave(newValue: string) {
		if (saveTimeoutId) {
			clearTimeout(saveTimeoutId);
		}
		saveTimeoutId = setTimeout(() => {
			if (!readOnly) {
				table.options.meta?.onDataUpdate?.({
					rowIndex,
					rowId: cell.row.id,
					columnId,
					value: newValue
				});
			}
		}, 3000);
	}

	function handleSave() {
		if (saveTimeoutId) {
			clearTimeout(saveTimeoutId);
			saveTimeoutId = null;
		}
		const meta = table.options.meta;
		if (!readOnly && value !== initialValue) {
			meta?.onDataUpdate?.({ rowIndex, rowId: cell.row.id, columnId, value });
		}
		meta?.onCellEditingStop?.();
	}

	function handleCancel() {
		if (saveTimeoutId) {
			clearTimeout(saveTimeoutId);
			saveTimeoutId = null;
		}
		localEditValue = editStartValue;
		const meta = table.options.meta;
		meta?.onCellEditingCancel?.();
	}

	function handleOpenChange(isOpen: boolean) {
		const meta = table.options.meta;
		if (isOpen && !readOnly) {
			meta?.onCellEditingStart?.(rowIndex, columnId);
		} else {
			if (!readOnly && value !== initialValue) {
				meta?.onDataUpdate?.({ rowIndex, rowId: cell.row.id, columnId, value });
			}
			meta?.onCellEditingStop?.();
		}
	}

	function handleOpenAutoFocus(event: Event) {
		event.preventDefault();
		if (textareaRef) {
			textareaRef.focus();
			const length = textareaRef.value.length;
			textareaRef.setSelectionRange(length, length);
		}
	}

	function handleBlur() {
		// const meta = table.options.meta;
		// if (!readOnly && value !== initialValue) {
		// 	meta?.onDataUpdate?.({ rowIndex, columnId, value });
		// }
		// meta?.onCellEditingStop?.();
	}

	function handleInput(event: Event) {
		const target = event.currentTarget as HTMLTextAreaElement;
		const newValue = target.value;
		localEditValue = newValue;
		debouncedSave(newValue);
	}

	function handleKeyDown(event: KeyboardEvent) {
		const meta = table.options.meta;
		if (event.key === 'Escape') {
			event.preventDefault();
			handleCancel();
		} else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			handleSave();
		} else if (event.key === 'Tab') {
			const direction = event.shiftKey ? 'left' : 'right';
			const canNavigate = meta?.canNavigateToCell?.(rowIndex, columnId, direction) ?? false;
			if (!canNavigate) {
				handleSave();
				return;
			}
			event.preventDefault();
			if (value !== initialValue) {
				meta?.onDataUpdate?.({ rowIndex, rowId: cell.row.id, columnId, value });
			}
			meta?.onCellEditingStop?.({
				direction
			});
			return;
		}
		event.stopPropagation();
	}
</script>

<DataGridCellWrapper
	bind:wrapperRef={containerRef}
	{cell}
	{table}
	{rowIndex}
	{columnId}
	{isEditing}
	{isFocused}
	{isSelected}
>
	<span data-slot="grid-cell-content">{value}</span>
</DataGridCellWrapper>

{#if isEditing}
	<PopoverPrimitive.Root open={isEditing} onOpenChange={handleOpenChange}>
		<PopoverContent
			data-grid-cell-editor=""
			align="start"
			side="bottom"
			{sideOffset}
			class="w-100 rounded-none p-0"
			onOpenAutoFocus={handleOpenAutoFocus}
			customAnchor={containerRef}
		>
			<Textarea
				bind:ref={textareaRef}
				placeholder="Enter text..."
				class="min-h-37.5 resize-none rounded-none border-0 shadow-none focus-visible:ring-0"
				{value}
				onblur={handleBlur}
				oninput={handleInput}
				onkeydown={handleKeyDown}
			/>
		</PopoverContent>
	</PopoverPrimitive.Root>
{/if}
