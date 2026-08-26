<script lang="ts" generics="TData, TValue">
	import type { CellOpts } from '$lib/components/data-grid/types/data-grid.js';
	import {
		DropdownMenu,
		DropdownMenuCheckboxItem,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSeparator,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu/index.js';
	import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip/index.js';
	import { cn } from '$lib/utils.js';
	import type {
		ColumnSort,
		Header,
		SortDirection,
		SortingState,
		Table
	} from '@tanstack/table-core';
	import type { Component } from 'svelte';
	// Icons
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import Baseline from '@lucide/svelte/icons/baseline';
	import Calendar from '@lucide/svelte/icons/calendar';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import CheckSquare from '@lucide/svelte/icons/check-square';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import FileIcon from '@lucide/svelte/icons/file';
	import FileSymlinkIcon from '@lucide/svelte/icons/file-symlink';
	import Hash from '@lucide/svelte/icons/hash';
	import Languages from '@lucide/svelte/icons/languages';
	import Link from '@lucide/svelte/icons/link';
	import Link2 from '@lucide/svelte/icons/link-2';
	import List from '@lucide/svelte/icons/list';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import MoveLeft from '@lucide/svelte/icons/move-left';
	import MoveRight from '@lucide/svelte/icons/move-right';
	import Pin from '@lucide/svelte/icons/pin';
	import PinOff from '@lucide/svelte/icons/pin-off';
	import SquareDashedText from '@lucide/svelte/icons/square-dashed-text';
	import StarIcon from '@lucide/svelte/icons/star';
	import Tag from '@lucide/svelte/icons/tag';
	import Terminal from '@lucide/svelte/icons/terminal';
	import TextInitial from '@lucide/svelte/icons/text';
	import Workflow from '@lucide/svelte/icons/workflow';
	import X from '@lucide/svelte/icons/x';

	interface Props {
		header: Header<TData, TValue>;
		table: Table<TData>;
		class?: string;
	}

	let { header, table, class: className }: Props = $props();

	const column = $derived(header.column);
	const label = $derived.by(() => {
		if (column.columnDef.meta?.label) {
			return column.columnDef.meta.label;
		}
		if (typeof column.columnDef.header === 'string') {
			return column.columnDef.header;
		}
		return column.id;
	});

	const isAnyColumnResizing = $derived(
		table.getState().columnSizingInfo?.isResizingColumn ?? false
	);

	const cellVariant = $derived(column.columnDef.meta?.cell);
	const columnVariant = $derived.by(() => getColumnVariant(cellVariant?.variant));

	// Get pinning state reactively from table state
	const columnPinning = $derived(table.getState().columnPinning);
	const pinnedPosition = $derived.by(() => {
		// Read columnPinning to create dependency, then call column method
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const _ = columnPinning;
		return column.getIsPinned();
	});
	const isPinnedLeft = $derived(pinnedPosition === 'left');
	const isPinnedRight = $derived(pinnedPosition === 'right');

	// Get current sort state for this column
	const currentSort = $derived.by(() => {
		const sortState = table.getState().sorting;
		return sortState.find((sort) => sort.id === column.id);
	});
	const isSorted = $derived(!!currentSort);
	const sortDirection = $derived(currentSort ? (currentSort.desc ? 'desc' : 'asc') : null);

	// Check if this column has an active filter
	const hasActiveFilter = $derived.by(() => {
		const filters = table.getState().columnFilters;
		return filters.some((f) => f.id === column.id);
	});

	// Safe getter for column size that handles SSR edge cases
	const columnSize = $derived.by(() => {
		try {
			return column.getSize();
		} catch {
			return column.columnDef.size ?? 150;
		}
	});

	// Safe getter for resizing state that handles SSR edge cases
	const isColumnResizing = $derived.by(() => {
		try {
			return header.column.getIsResizing();
		} catch {
			return false;
		}
	});

	// Safe getter for canResize that handles SSR edge cases
	const canResize = $derived.by(() => {
		try {
			return header.column.getCanResize();
		} catch {
			return false;
		}
	});

	function getColumnVariant(variant?: CellOpts['variant']): {
		icon: Component<{ class?: string }>;
		label: string;
	} | null {
		switch (variant) {
			case 'actions':
				return { icon: Workflow, label: 'Actions' };
			case 'text-short':
				return { icon: Baseline, label: 'Short text' };
			case 'text-translated-short':
				return { icon: Languages, label: 'Short translated text' };
			case 'text-long':
				return { icon: TextInitial, label: 'Long text' };
			case 'text-translated-long':
				return { icon: Languages, label: 'Long translated text' };
			case 'badge-item':
				return { icon: Tag, label: 'Follow relation' };
			case 'relation-follow':
				return { icon: Link2, label: 'Follow relation' };
			case 'relation-select-single':
				return { icon: Link2, label: 'Select single relation' };
			case 'input-with-suggestions':
				return { icon: SquareDashedText, label: 'Input with suggestions' };
			case 'number':
				return { icon: Hash, label: 'Number' };
			case 'url':
				return { icon: Link, label: 'URL' };
			case 'checkbox':
				return { icon: CheckSquare, label: 'Checkbox' };
			case 'select-single':
				return { icon: List, label: 'Select single' };
			case 'select-multiple':
				return { icon: ListChecks, label: 'Select multiple' };
			case 'select-icon':
				return { icon: StarIcon, label: 'Select icon' };
			case 'date':
				return { icon: Calendar, label: 'Date' };
			case 'date-time':
				return { icon: CalendarClock, label: 'Date & time' };
			case 'file':
				return { icon: FileIcon, label: 'File' };
			case 'file-or-url':
				return { icon: FileSymlinkIcon, label: 'File or URL' };
			case 'json-yaml':
				return { icon: Terminal, label: 'YAML' };
			default:
				return null;
		}
	}

	function onSortingChange(direction: SortDirection) {
		table.setSorting((prev: SortingState) => {
			const existingSortIndex = prev.findIndex((sort) => sort.id === column.id);
			const newSort: ColumnSort = {
				id: column.id,
				desc: direction === 'desc'
			};

			if (existingSortIndex >= 0) {
				const updated = [...prev];
				updated[existingSortIndex] = newSort;
				return updated;
			} else {
				return [...prev, newSort];
			}
		});
	}

	function onSortRemove() {
		table.setSorting((prev: SortingState) => prev.filter((sort) => sort.id !== column.id));
	}

	function onLeftPin() {
		column.pin('left');
	}

	function onRightPin() {
		column.pin('right');
	}

	function onUnpin() {
		column.pin(false);
	}

	function onTriggerPointerDown(event: PointerEvent) {
		if (event.defaultPrevented) return;

		if (event.button !== 0) {
			return;
		}
		table.options.meta?.onColumnClick?.(column.id);
	}

	// Resizer
	const defaultColumnDef = $derived(table.options.defaultColumn ?? {});
	const minColumnSize = $derived(column.columnDef.minSize ?? defaultColumnDef.minSize ?? 40);
	const maxColumnSize = $derived(column.columnDef.maxSize ?? defaultColumnDef.maxSize ?? 1000);
	const orderedLeafColumnIds = $derived(table.getAllLeafColumns().map((item) => item.id));
	const columnOrderIndex = $derived(orderedLeafColumnIds.indexOf(column.id));
	const canMoveLeft = $derived(columnOrderIndex > 0);
	const canMoveRight = $derived(
		columnOrderIndex >= 0 && columnOrderIndex < orderedLeafColumnIds.length - 1
	);
	const resizerClass =
		"absolute top-0 -right-px z-50 h-full w-1 cursor-col-resize touch-none bg-border transition-opacity select-none after:absolute after:inset-y-0 after:-left-1 after:h-full after:w-3 after:content-[''] hover:bg-primary focus:bg-primary focus:outline-none";

	function onResizerDoubleClick() {
		header.column.resetSize();
	}

	function setColumnSize(size: number) {
		const nextSize = Math.min(maxColumnSize, Math.max(minColumnSize, size));
		table.setColumnSizing((current) => ({ ...current, [column.id]: nextSize }));
	}

	function onResizerKeyDown(event: KeyboardEvent) {
		const step = event.shiftKey ? 25 : 10;
		if (event.key === 'ArrowLeft') setColumnSize(columnSize - step);
		else if (event.key === 'ArrowRight') setColumnSize(columnSize + step);
		else if (event.key === 'Home') setColumnSize(minColumnSize);
		else if (event.key === 'End') setColumnSize(maxColumnSize);
		else return;
		event.preventDefault();
		event.stopPropagation();
	}

	function moveColumn(offset: -1 | 1) {
		const from = orderedLeafColumnIds.indexOf(column.id);
		const to = from + offset;
		if (from < 0 || to < 0 || to >= orderedLeafColumnIds.length) return;
		const nextOrder = [...orderedLeafColumnIds];
		[nextOrder[from], nextOrder[to]] = [nextOrder[to], nextOrder[from]];
		table.setColumnOrder(nextOrder);
	}
</script>

<DropdownMenu>
	<DropdownMenuTrigger
		class={cn(
			'flex size-full items-center justify-between gap-2 p-2 text-sm hover:bg-accent/40 data-[state=open]:bg-accent/40 [&_svg]:size-4',
			isAnyColumnResizing && 'pointer-events-none',
			className
		)}
		onpointerdown={onTriggerPointerDown}
	>
		<!-- Left side: icon + label -->
		<div class="flex min-w-0 flex-1 items-center gap-1.5">
			{#if columnVariant}
				{@const Icon = columnVariant.icon}
				<Tooltip delayDuration={100}>
					<TooltipTrigger>
						{#snippet child({ props })}
							<span {...props}>
								<Icon class="size-3.5 shrink-0 text-muted-foreground" />
							</span>
						{/snippet}
					</TooltipTrigger>
					<TooltipContent side="top">
						<p>{columnVariant.label}</p>
					</TooltipContent>
				</Tooltip>
			{/if}
			<span class="truncate">{label}</span>
			{#if hasActiveFilter}
				<span class="ml-1 size-1.5 shrink-0 rounded-full bg-primary" aria-label="Filtered"></span>
			{/if}
			{#if isSorted}
				{#if sortDirection === 'asc'}
					<ArrowUp class="z-10 size-3.5 shrink-0 bg-background text-foreground" />
				{:else}
					<ArrowDown class="z-10 size-3.5 shrink-0 bg-background text-foreground" />
				{/if}
			{/if}
		</div>
		<!-- Right side: chevron -->
		<ChevronDown class="shrink-0 text-muted-foreground" />
	</DropdownMenuTrigger>
	<DropdownMenuContent align="start" sideOffset={0} class="w-60">
		{#if column.getCanSort()}
			<DropdownMenuCheckboxItem
				class="relative pr-8 pl-2 [&_svg]:text-muted-foreground [&>span:first-child]:right-2 [&>span:first-child]:left-auto"
				checked={column.getIsSorted() === 'asc'}
				onCheckedChange={() => onSortingChange('asc')}
			>
				<ChevronUp class="mr-2 size-4" />
				Sort asc
			</DropdownMenuCheckboxItem>
			<DropdownMenuCheckboxItem
				class="relative pr-8 pl-2 [&_svg]:text-muted-foreground [&>span:first-child]:right-2 [&>span:first-child]:left-auto"
				checked={column.getIsSorted() === 'desc'}
				onCheckedChange={() => onSortingChange('desc')}
			>
				<ChevronDown class="mr-2 size-4" />
				Sort desc
			</DropdownMenuCheckboxItem>
			{#if column.getIsSorted()}
				<DropdownMenuItem onclick={onSortRemove}>
					<X class="mr-2 size-4" />
					Remove sort
				</DropdownMenuItem>
			{/if}
		{/if}
		{#if column.getCanPin()}
			{#if column.getCanSort()}
				<DropdownMenuSeparator />
			{/if}

			{#if isPinnedLeft}
				<DropdownMenuItem class="[&_svg]:text-muted-foreground" onclick={onUnpin}>
					<PinOff class="mr-2 size-4" />
					Unpin from left
				</DropdownMenuItem>
			{:else}
				<DropdownMenuItem class="[&_svg]:text-muted-foreground" onclick={onLeftPin}>
					<Pin class="mr-2 size-4" />
					Pin to left
				</DropdownMenuItem>
			{/if}
			{#if isPinnedRight}
				<DropdownMenuItem class="[&_svg]:text-muted-foreground" onclick={onUnpin}>
					<PinOff class="mr-2 size-4" />
					Unpin from right
				</DropdownMenuItem>
			{:else}
				<DropdownMenuItem class="[&_svg]:text-muted-foreground" onclick={onRightPin}>
					<Pin class="mr-2 size-4" />
					Pin to right
				</DropdownMenuItem>
			{/if}
		{/if}
		<DropdownMenuSeparator />
		<DropdownMenuItem disabled={!canMoveLeft} onclick={() => moveColumn(-1)}>
			<MoveLeft class="mr-2 size-4" />
			Move left
		</DropdownMenuItem>
		<DropdownMenuItem disabled={!canMoveRight} onclick={() => moveColumn(1)}>
			<MoveRight class="mr-2 size-4" />
			Move right
		</DropdownMenuItem>
		{#if column.getCanHide()}
			<DropdownMenuSeparator />
			<DropdownMenuCheckboxItem
				class="relative pr-8 pl-2 [&_svg]:text-muted-foreground [&>span:first-child]:right-2 [&>span:first-child]:left-auto"
				checked={!column.getIsVisible()}
				onCheckedChange={() => column.toggleVisibility(false)}
			>
				<EyeOff class="mr-2 size-4" />
				Hide column
			</DropdownMenuCheckboxItem>
		{/if}
	</DropdownMenuContent>
</DropdownMenu>

{#if canResize}
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		role="separator"
		aria-orientation="vertical"
		aria-label={`Resize ${label} column`}
		aria-valuenow={columnSize}
		aria-valuemin={minColumnSize}
		aria-valuemax={maxColumnSize}
		aria-valuetext={`${columnSize} pixels`}
		tabindex={0}
		class={cn(
			resizerClass,
			isColumnResizing ? 'bg-primary opacity-100' : 'opacity-0 hover:opacity-100'
		)}
		ondblclick={onResizerDoubleClick}
		onkeydown={onResizerKeyDown}
		onmousedown={header.getResizeHandler()}
		ontouchstart={header.getResizeHandler()}
	></div>
{/if}
