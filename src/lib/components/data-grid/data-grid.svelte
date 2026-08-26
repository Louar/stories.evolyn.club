<script lang="ts" generics="TData">
	/* eslint-disable @typescript-eslint/no-unused-vars */
	import type {
		CellPosition,
		DataGridProps,
		RowHeightValue
	} from '$lib/components/data-grid/types/data-grid.js';
	import { FlexRender } from '$lib/components/ui/table-tanstack';
	import { TooltipProvider } from '$lib/components/ui/tooltip/index.js';
	import { cn } from '$lib/utils.js';
	import Plus from '@lucide/svelte/icons/plus';
	import type { Column, RowSelectionState } from '@tanstack/table-core';
	import { setContext } from 'svelte';
	import DataGridColumnHeader from './data-grid-column-header.svelte';
	import DataGridContextMenu from './data-grid-context-menu.svelte';
	import DataGridPasteDialog from './data-grid-paste-dialog.svelte';
	import DataGridRow from './data-grid-row.svelte';
	import DataGridSearch from './data-grid-search.svelte';

	let {
		dataGridRef = $bindable(null),
		headerRef = $bindable(null),
		rowMapRef,
		footerRef = $bindable(null),
		table,
		rowVirtualizer,
		selectedCellsSet,
		getRowSelection,
		height = 600,
		searchState,
		columnSizeVars: _, // We compute this ourselves for reactivity
		onRowAdd,
		setDataGridRef,
		setHeaderRef,
		setFooterRef,
		preferences,
		status,
		loading = status.loading ?? false,
		error = status.error,
		loadingMessage = status.loadingMessage ?? 'Loading data grid',
		errorMessage = status.errorMessage,
		emptyMessage = status.emptyMessage ?? 'No data available',
		filteredEmptyMessage = status.filteredEmptyMessage ?? 'No rows match the current filters',
		loadingState = status.loadingState,
		errorState = status.errorState,
		emptyState = status.emptyState,
		filteredEmptyState = status.filteredEmptyState,
		class: className
	}: DataGridProps<TData> = $props();

	// Provide row selection getter via context for header checkbox reactivity
	// svelte-ignore state_referenced_locally
	setContext<() => RowSelectionState>('getRowSelection', getRowSelection);

	// Visibility key for {#key} block - forces re-render when visibility changes
	// This is computed locally from table state
	const visibilityKey = $derived.by(() => {
		const visibility = table.getState().columnVisibility;
		return Object.entries(visibility)
			.filter(([_, visible]) => visible === false)
			.map(([id]) => id)
			.sort()
			.join(',');
	});

	// Notify hook when refs change - only run once per ref
	let dataGridRefSet = false;
	let headerRefSet = false;
	let footerRefSet = false;

	$effect(() => {
		if (dataGridRef && setDataGridRef && !dataGridRefSet) {
			dataGridRefSet = true;
			setDataGridRef(dataGridRef);
		}
	});

	$effect(() => {
		if (headerRef && setHeaderRef && !headerRefSet) {
			headerRefSet = true;
			setHeaderRef(headerRef);
		}
	});

	$effect(() => {
		if (footerRef && setFooterRef && !footerRefSet) {
			footerRefSet = true;
			setFooterRef(footerRef);
		}
	});

	const rows = $derived(table.getRowModel().rows);
	const rowModelKey = $derived(rows.map((row) => row.id).join('\0'));
	const meta = $derived(table.options.meta);
	const rowHeight = $derived<RowHeightValue>(meta?.rowHeight ?? 'short');
	const focusedCell = $derived<CellPosition | null>(meta?.focusedCell ?? null);
	// Get table state reactively for pinning/visibility/sizing
	const tableState = $derived(table.getState());
	const columnPinning = $derived(tableState.columnPinning);
	const columnVisibility = $derived(tableState.columnVisibility);
	const columnSizing = $derived(tableState.columnSizing);
	const columnSizingInfo = $derived(tableState.columnSizingInfo);

	// Get visible headers reactively
	const visibleLeafColumns = $derived(table.getVisibleLeafColumns());
	const headerGroups = $derived(table.getHeaderGroups());
	const headerRowCount = $derived(headerGroups.length);
	const hasActiveFilters = $derived(tableState.columnFilters.length > 0);
	const hasUnfilteredRows = $derived(table.getPreFilteredRowModel().rows.length > 0);
	const isFilteredEmpty = $derived(
		!loading && !error && rows.length === 0 && hasActiveFilters && hasUnfilteredRows
	);
	const isEmpty = $derived(!loading && !error && rows.length === 0 && !isFilteredEmpty);
	const statusRowVisible = $derived(Boolean(loading || error || isEmpty || isFilteredEmpty));
	const footerVisible = $derived(Boolean(onRowAdd && !loading && !error));
	const bodyRowCount = $derived(statusRowVisible ? 1 : rows.length);
	const ariaRowCount = $derived(headerRowCount + bodyRowCount + (footerVisible ? 1 : 0));
	const ariaColumnCount = $derived(Math.max(1, visibleLeafColumns.length));
	const preferencesRestoring = $derived(preferences.enabled && !preferences.ready);

	const normalizedErrorMessage = $derived.by(() => {
		if (errorMessage) return errorMessage;
		if (error instanceof Error && error.message.trim()) return error.message;
		if (typeof error === 'string' && error.trim()) return error;
		return 'Unable to load the data grid';
	});

	function getVisibleHeaderSpan(header: ReturnType<typeof table.getFlatHeaders>[number]) {
		return header.getLeafHeaders().filter((leaf) => leaf.column.getIsVisible()).length;
	}

	function getHeaderColumnIndex(header: ReturnType<typeof table.getFlatHeaders>[number]) {
		const visibleLeafIds = visibleLeafColumns.map((column) => column.id);
		const firstVisibleLeaf = header.getLeafHeaders().find((leaf) => leaf.column.getIsVisible())
			?.column.id;
		return firstVisibleLeaf ? visibleLeafIds.indexOf(firstVisibleLeaf) + 1 : 0;
	}

	// Compute total visible width (only visible columns)
	const totalVisibleWidth = $derived.by(() => {
		// Read column sizing to create reactive dependency
		const _ = columnSizing;
		const __ = columnSizingInfo;
		const ___ = columnVisibility;

		let total = 0;
		for (const col of visibleLeafColumns) {
			total += col.getSize();
		}
		return total;
	});

	// Compute pinning styles reactively based on state
	function getPinningStyles(
		column: Column<TData, unknown>
	): Record<string, string | number | undefined> {
		// Read pinning state to create reactive dependency
		const _ = columnPinning;

		try {
			const isPinned = column.getIsPinned();
			const isLastLeftPinnedColumn = isPinned === 'left' && column.getIsLastColumn('left');
			const isFirstRightPinnedColumn = isPinned === 'right' && column.getIsFirstColumn('right');

			return {
				boxShadow: isLastLeftPinnedColumn
					? '-4px 0 4px -4px var(--border) inset'
					: isFirstRightPinnedColumn
						? '4px 0 4px -4px var(--border) inset'
						: undefined,
				left: isPinned === 'left' ? `${column.getStart('left')}px` : undefined,
				right: isPinned === 'right' ? `${column.getAfter('right')}px` : undefined,
				opacity: isPinned ? 0.97 : 1,
				position: isPinned ? 'sticky' : 'relative',
				background: 'var(--background)',
				zIndex: isPinned ? 20 : undefined
			};
		} catch {
			return {
				position: 'relative',
				background: 'var(--background)',
				zIndex: undefined
			};
		}
	}

	function onGridContextMenu(event: MouseEvent) {
		event.preventDefault();
	}

	function onGridFocus(event: FocusEvent) {
		if (event.target !== event.currentTarget || focusedCell || rows.length === 0) return;
		if ((meta?.getSelectedRowCount?.() ?? 0) > 0) return;
		const firstColumn = visibleLeafColumns.find(
			(column) =>
				column.columnDef.meta?.navigable !== false &&
				column.columnDef.meta?.cell?.variant !== 'row-select'
		);
		if (firstColumn) meta?.onCellClick?.(0, firstColumn.id);
	}

	// Handle mouseup anywhere to end drag selection
	function handleGridMouseUp() {
		meta?.onCellMouseUp?.();
	}

	// Compute column size CSS variables reactively from table state
	// We read both columnSizing and columnSizingInfo to create reactive dependencies
	// columnSizingInfo updates during resize drag, columnSizing updates on release
	const columnSizeStyle = $derived.by(() => {
		// Read both states to ensure reactivity when columns are resized
		const _ = columnSizing;
		const __ = columnSizingInfo;

		const vars: string[] = [];
		try {
			const headers = table.getFlatHeaders();
			for (const header of headers) {
				const size = header.getSize();
				vars.push(`--header-${header.id}-size: ${size - 5}`);
				vars.push(`--col-${header.column.id}-size: ${size - 5}`);
			}
		} catch {
			// Table not ready yet
		}
		return vars.join('; ');
	});

	// Get virtual items - use getters for reactive access
	const virtualItems = $derived(rowVirtualizer.virtualItems);
	const totalSize = $derived(rowVirtualizer.totalSize);

	// Handler for global mouseup - ends drag selection even when mouse leaves grid
	function handleWindowMouseUp() {
		meta?.onCellMouseUp?.();
	}
</script>

<svelte:window onmouseup={handleWindowMouseUp} />

<TooltipProvider>
	<div data-slot="grid-wrapper" class="relative flex w-full min-w-0 flex-col">
		{#if searchState}
			<DataGridSearch
				searchOpen={searchState.searchOpen}
				searchQuery={searchState.searchQuery}
				searchMatches={searchState.searchMatches}
				matchIndex={searchState.matchIndex}
				onSearchOpenChange={searchState.onSearchOpenChange}
				onSearchQueryChange={searchState.onSearchQueryChange}
				onSearch={searchState.onSearch}
				onNavigateToNextMatch={searchState.onNavigateToNextMatch}
				onNavigateToPrevMatch={searchState.onNavigateToPrevMatch}
			/>
		{/if}

		<DataGridContextMenu {table} />

		<DataGridPasteDialog {table} />

		<div
			role="grid"
			aria-label="Data grid"
			aria-rowcount={ariaRowCount}
			aria-colcount={ariaColumnCount}
			aria-multiselectable="true"
			aria-busy={loading || preferencesRestoring}
			data-slot="grid"
			tabindex={focusedCell ? -1 : 0}
			bind:this={dataGridRef}
			class={cn(
				'relative no-scrollbar grid overflow-auto overscroll-none rounded-lg border select-none focus:outline-none',
				preferencesRestoring && 'invisible',
				className
			)}
			style="{columnSizeStyle}; max-height: {height}px;"
			oncontextmenu={onGridContextMenu}
			onmouseup={handleGridMouseUp}
			onfocus={onGridFocus}
		>
			<!-- Header -->
			<div
				role="rowgroup"
				data-slot="grid-header"
				bind:this={headerRef}
				class="sticky top-0 z-10 grid"
			>
				{#each headerGroups as headerGroup, rowIndex (headerGroup.id)}
					<div
						role="row"
						aria-rowindex={rowIndex + 1}
						data-slot="grid-header-row"
						tabindex={-1}
						class="flex border-b bg-background"
						style="width: max(100%, {totalVisibleWidth}px); min-width: 100%;"
					>
						{#each headerGroup.headers as header (header.id)}
							{@const visibleSpan = getVisibleHeaderSpan(header)}
							{#if visibleSpan > 0}
								{@const sorting = tableState.sorting}
								{@const currentSort = sorting.find((sort) => sort.id === header.column.id)}
								{@const isSortable = header.column.getCanSort()}
								{@const pinningStyles = getPinningStyles(header.column)}

								<div
									role="columnheader"
									aria-colindex={getHeaderColumnIndex(header)}
									aria-colspan={visibleSpan > 1 ? visibleSpan : undefined}
									aria-sort={currentSort?.desc === false
										? 'ascending'
										: currentSort?.desc === true
											? 'descending'
											: isSortable
												? 'none'
												: undefined}
									data-slot="grid-header-cell"
									tabindex={-1}
									class={cn('group relative border-r last-of-type:border-0')}
									style="position: {pinningStyles.position}; left: {pinningStyles.left}; right: {pinningStyles.right}; background: {pinningStyles.background}; z-index: {pinningStyles.zIndex}; width: calc(var(--header-{header.id}-size) * 1px);"
								>
									{#if header.isPlaceholder}
										<!-- Empty -->
									{:else if typeof header.column.columnDef.header === 'function'}
										<div class="size-full px-3 py-1.5">
											{#key rowModelKey}
												<FlexRender
													content={header.column.columnDef.header}
													context={header.getContext()}
												/>
											{/key}
										</div>
									{:else}
										<DataGridColumnHeader {header} {table} />
									{/if}
								</div>
							{/if}
						{/each}
					</div>
				{/each}
			</div>

			<!-- Body -->
			<div
				role="rowgroup"
				data-slot="grid-body"
				class="relative grid"
				class:-mb-px={!footerVisible}
				style="height: {statusRowVisible ? 96 : totalSize}px;"
			>
				{#if statusRowVisible}
					<div
						role="row"
						aria-rowindex={headerRowCount + 1}
						class="flex h-24 w-full items-center justify-center"
					>
						<div
							role="gridcell"
							aria-colindex="1"
							aria-colspan={ariaColumnCount}
							class="px-6 text-center text-sm text-muted-foreground"
						>
							{#if loading}
								<div role="status" aria-live="polite">
									{#if loadingState}
										{@render loadingState({ message: loadingMessage })}
									{:else}{loadingMessage}{/if}
								</div>
							{:else if error}
								<div role="alert">
									{#if errorState}
										{@render errorState({ message: normalizedErrorMessage, error })}
									{:else}{normalizedErrorMessage}{/if}
								</div>
							{:else if isFilteredEmpty}
								{#if filteredEmptyState}
									{@render filteredEmptyState({ message: filteredEmptyMessage })}
								{:else}{filteredEmptyMessage}{/if}
							{:else if emptyState}
								{@render emptyState({ message: emptyMessage })}
							{:else}{emptyMessage}{/if}
						</div>
					</div>
				{:else}
					{#key visibilityKey}
						{#each virtualItems as virtualItem (virtualItem.key)}
							{@const virtualRowIndex = virtualItem.index}
							{@const row = rows[virtualRowIndex]}
							{#if row}
								<DataGridRow
									{row}
									{table}
									{columnPinning}
									{columnVisibility}
									{columnSizing}
									{selectedCellsSet}
									{rowMapRef}
									{virtualRowIndex}
									{rowVirtualizer}
									{rowHeight}
									{focusedCell}
									{headerRowCount}
									virtualStart={virtualItem.start}
								/>
							{/if}
						{/each}
					{/key}
				{/if}
			</div>

			<!-- Footer / Add Row -->
			{#if footerVisible}
				<div
					role="rowgroup"
					data-slot="grid-footer"
					bind:this={footerRef}
					class="sticky bottom-0 z-10 grid w-full border-t bg-background"
					style="width: max(100%, {totalVisibleWidth}px); min-width: 100%;"
				>
					<div
						role="row"
						aria-rowindex={headerRowCount + bodyRowCount + 1}
						data-slot="grid-add-row"
						tabindex={-1}
						class="flex w-full"
					>
						<div
							role="gridcell"
							aria-colindex="1"
							aria-colspan={ariaColumnCount}
							tabindex={-1}
							class="relative flex h-9 min-w-full grow items-center bg-muted/30"
						>
							<button
								type="button"
								class="sticky left-0 flex h-full items-center gap-2 px-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
								onclick={onRowAdd}
							>
								<Plus class="size-3.5" />
								<span class="text-sm">Add row</span>
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
</TooltipProvider>
