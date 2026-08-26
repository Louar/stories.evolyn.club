<script lang="ts" generics="TData">
	import { getCellKey, type RowHeightValue } from '$lib/components/data-grid/types/data-grid.js';
	import { cn } from '$lib/utils.js';
	import type { Cell, Table } from '@tanstack/table-core';
	import type { Snippet } from 'svelte';

	interface Props {
		cell: Cell<TData, unknown>;
		table: Table<TData>;
		rowIndex: number;
		columnId: string;
		isEditing: boolean;
		isFocused: boolean;
		isSelected: boolean;
		class?: string;
		wrapperRef?: HTMLDivElement | null;
		onclick?: (event: MouseEvent) => void;
		onkeydown?: (event: KeyboardEvent) => void;
		ondragenter?: (event: DragEvent) => void;
		ondragleave?: (event: DragEvent) => void;
		ondragover?: (event: DragEvent) => void;
		ondrop?: (event: DragEvent) => void;
		children?: Snippet;
	}

	let {
		cell,
		table,
		rowIndex,
		columnId,
		isEditing,
		isFocused,
		isSelected,
		class: className,
		wrapperRef = $bindable(null),
		onclick: onClickProp,
		onkeydown: onKeyDownProp,
		ondragenter: onDragEnterProp,
		ondragleave: onDragLeaveProp,
		ondragover: onDragOverProp,
		ondrop: onDropProp,
		children
	}: Props = $props();
	const uid = $props.id();
	const rowId = $derived(cell.row.id);

	let internalRef = $state<HTMLDivElement | null>(null);
	// Track if cell was focused BEFORE mousedown (to prevent single-click opening edit)
	let wasFocusedOnMouseDown = $state(false);

	// Sync internal ref to bindable prop
	$effect(() => {
		if (internalRef) {
			wrapperRef = internalRef;
		}
	});

	// Register/unregister cell in cellMapRef
	$effect(() => {
		const meta = table.options.meta;
		if (internalRef && meta?.cellMapRef) {
			const cellKey = getCellKey(rowId, columnId);
			meta.cellMapRef.set(cellKey, internalRef);

			return () => {
				table.options.meta?.cellMapRef?.delete(cellKey);
			};
		}
	});

	// Compute cellKey reactively for virtualization
	const cellKey = $derived(getCellKey(rowId, columnId));

	const isRowSelected = $derived(cell.row.getIsSelected());
	const showSelectionHighlight = $derived((isSelected || isRowSelected) && !isEditing);
	const columnIndex = $derived.by(() => {
		const orderedColumns = [
			...table.getLeftVisibleLeafColumns(),
			...table.getCenterVisibleLeafColumns(),
			...table.getRightVisibleLeafColumns()
		];
		return orderedColumns.findIndex((column) => column.id === columnId) + 1;
	});

	const hasError = $derived.by(() => {
		const meta = table.options.meta;
		// Direct SvelteSet.has() - Svelte tracks this specific key
		return meta?.hasErrorMatchSet?.has(cellKey) ?? false;
	});
	const isSearchMatch = $derived.by(() => {
		const meta = table.options.meta;
		// Direct SvelteSet.has() - Svelte tracks this specific key
		return meta?.searchMatchSet?.has(cellKey) ?? false;
	});
	const isActiveSearchMatch = $derived.by(() => {
		const meta = table.options.meta;
		const active = meta?.activeSearchMatch;
		return (
			(active?.rowId ? active.rowId === rowId : active?.rowIndex === rowIndex) &&
			active?.columnId === columnId
		);
	});
	const saveState = $derived.by(() => {
		const map = table.options.meta?.cellSaveStateMap;
		return map?.get(cellKey) ?? { status: 'idle' as const };
	});
	const isInvalid = $derived(hasError || saveState.status === 'error');
	const errorDescriptionId = $derived(isInvalid ? `${uid}-error` : undefined);
	const rowHeight = $derived.by<RowHeightValue>(() => {
		const meta = table.options.meta;
		return meta?.rowHeight ?? 'short';
	});

	// Compute cell classes declaratively so Svelte owns the rendered state.
	const cellClasses = $derived(
		cn(
			'relative size-full px-2 py-1.5 text-left text-sm outline-none has-data-[slot=checkbox]:pt-2.5',
			{
				highlight: showSelectionHighlight,
				'ring-1 ring-inset': isFocused,
				'ring-1 ring-inset ring-rose-300 bg-rose-50 dark:ring-rose-500/50 dark:bg-rose-900/30':
					hasError,
				'bg-yellow-100 dark:bg-yellow-900/30': isSearchMatch && !isActiveSearchMatch,
				'bg-orange-200 dark:bg-orange-900/50': isActiveSearchMatch,
				'cursor-default': !isEditing,
				'**:data-[slot=grid-cell-content]:line-clamp-1': !isEditing && rowHeight === 'short',
				'**:data-[slot=grid-cell-content]:line-clamp-2': !isEditing && rowHeight === 'medium',
				'**:data-[slot=grid-cell-content]:line-clamp-3': !isEditing && rowHeight === 'tall',
				'**:data-[slot=grid-cell-content]:line-clamp-4': !isEditing && rowHeight === 'extra-tall'
			},
			className
		)
	);

	function handleClick(event: MouseEvent) {
		if (!isEditing) {
			if (isInteractiveTarget(event)) return;
			event.preventDefault();
			onClickProp?.(event);
			const meta = table.options.meta;
			// Only start editing if cell was ALREADY focused before this mousedown/click
			// Selection is handled by mousedown, so we only handle editing here
			if (wasFocusedOnMouseDown) {
				meta?.onCellEditingStart?.(rowIndex, columnId);
			}
		}
	}

	function handleContextMenu(event: MouseEvent) {
		if (!isEditing) {
			table.options.meta?.onCellContextMenu?.(rowIndex, columnId, event);
		}
	}

	function handleMouseDown(event: MouseEvent) {
		if (!isEditing) {
			if (isInteractiveTarget(event)) return;
			// Capture focus state BEFORE mousedown changes it
			wasFocusedOnMouseDown = isFocused;
			table.options.meta?.onCellMouseDown?.(rowIndex, columnId, event);
		}
	}

	function isInteractiveTarget(event: MouseEvent): boolean {
		const target = event.target;
		return (
			target instanceof Element &&
			target !== event.currentTarget &&
			Boolean(target.closest('button, a, input, select, textarea, [role="button"], [role="link"]'))
		);
	}

	function handleMouseEnter(event: MouseEvent) {
		if (!isEditing) {
			table.options.meta?.onCellMouseEnter?.(rowIndex, columnId, event);
		}
	}

	function handleMouseUp() {
		if (!isEditing) {
			table.options.meta?.onCellMouseUp?.();
		}
	}

	function handleDoubleClick(event: MouseEvent) {
		if (!isEditing) {
			event.preventDefault();
			table.options.meta?.onCellDoubleClick?.(rowIndex, columnId);
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		onKeyDownProp?.(event);

		if (event.defaultPrevented) return;

		// When editing, don't interfere with navigation keys in the input
		if (isEditing) {
			return;
		}

		// Let navigation keys bubble up to grid handler when not editing
		if (
			event.key === 'ArrowUp' ||
			event.key === 'ArrowDown' ||
			event.key === 'ArrowLeft' ||
			event.key === 'ArrowRight' ||
			event.key === 'Home' ||
			event.key === 'End' ||
			event.key === 'PageUp' ||
			event.key === 'PageDown' ||
			event.key === 'Tab' ||
			event.key === 'Escape'
		) {
			// Don't prevent default - let the grid handler deal with it
			return;
		}

		// Handle editing keys when focused
		if (isFocused && !isEditing) {
			const meta = table.options.meta;
			if (event.key === 'F2' || event.key === 'Enter') {
				event.preventDefault();
				event.stopPropagation();
				meta?.onCellEditingStart?.(rowIndex, columnId);
				return;
			}

			if (event.key === ' ') {
				event.preventDefault();
				event.stopPropagation();
				meta?.onCellEditingStart?.(rowIndex, columnId);
				return;
			}

			// Printable character starts editing
			if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
				event.preventDefault();
				event.stopPropagation();
				meta?.onCellEditingStart?.(rowIndex, columnId);
			}
		}
	}
</script>

<div
	bind:this={internalRef}
	role="gridcell"
	aria-colindex={columnIndex}
	aria-selected={isSelected}
	aria-invalid={isInvalid ? 'true' : undefined}
	aria-describedby={errorDescriptionId}
	data-slot="grid-cell-wrapper"
	data-selected={showSelectionHighlight ? '' : undefined}
	data-editing={isEditing ? '' : undefined}
	data-focused={isFocused ? '' : undefined}
	tabindex={isFocused && !isEditing ? 0 : -1}
	class={cellClasses}
	onclick={handleClick}
	oncontextmenu={handleContextMenu}
	ondblclick={handleDoubleClick}
	onmousedown={handleMouseDown}
	onmouseenter={handleMouseEnter}
	onmouseup={handleMouseUp}
	onkeydown={handleKeyDown}
	ondragenter={onDragEnterProp}
	ondragleave={onDragLeaveProp}
	ondragover={onDragOverProp}
	ondrop={onDropProp}
>
	{@render children?.()}
	{#if saveState.status === 'saving'}
		<span
			class="pointer-events-none absolute top-1 right-1 size-2 animate-pulse rounded-full bg-muted-foreground/60"
			title="Saving"
			aria-label="Saving"
		></span>
		<span class="sr-only" role="status">Saving cell</span>
	{:else if saveState.status === 'saved'}
		<span
			class="pointer-events-none absolute top-1 right-1 size-2 rounded-full bg-emerald-500"
			title="Saved"
			aria-label="Saved"
		></span>
		<span class="sr-only" role="status">Cell saved</span>
		<!-- {:else if saveState.status === 'error'}
		<span
			class="text-destructive-foreground pointer-events-none absolute top-1 right-1 flex size-3 items-center justify-center rounded-full bg-destructive text-[9px] font-bold"
			title={saveState.error ?? 'The cell could not be saved'}
			aria-hidden="true"
		>
			!
		</span> -->
	{/if}
	{#if isInvalid}
		<span id={errorDescriptionId} class="sr-only">
			{saveState.status === 'error'
				? (saveState.error ?? 'The cell could not be saved')
				: 'The cell contains an invalid value'}
		</span>
	{/if}
</div>
