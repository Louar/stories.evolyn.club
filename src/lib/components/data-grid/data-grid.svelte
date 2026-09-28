<script lang="ts" generics="TData extends RowData">
	/* eslint-disable @typescript-eslint/no-unused-vars */
	import type {
		Column,
		Row,
		RowData,
		RowSelectionState
	} from '$lib/components/data-grid/data-grid-table.js';
	import type {
		CellPosition,
		DataGridProps,
		RowHeightValue
	} from '$lib/components/data-grid/types/data-grid.js';
	import { getRowHeightValue } from '$lib/components/data-grid/types/data-grid.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { TooltipProvider } from '$lib/components/ui/tooltip/index.js';
	import { cn } from '$lib/utils.js';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import Plus from '@lucide/svelte/icons/plus';
	import TableIcon from '@lucide/svelte/icons/table-2';
	import { FlexRender } from '@tanstack/svelte-table';
	import { setContext, tick } from 'svelte';
	import RowSelectHeader from './cells/row-select-header.svelte';
	import DataGridCell from './data-grid-cell.svelte';
	import DataGridColumnHeader from './data-grid-column-header.svelte';
	import DataGridContextMenu from './data-grid-context-menu.svelte';
	import DataGridPasteDialog from './data-grid-paste-dialog.svelte';
	import DataGridRow from './data-grid-row.svelte';
	import DataGridSearch from './data-grid-search.svelte';

	let {
		display = $bindable('table'),
		card,
		cardFields,
		// eslint-disable-next-line no-useless-assignment -- Bindable refs are outputs for consumers.
		dataGridRef = $bindable(null),
		// eslint-disable-next-line no-useless-assignment -- Bindable refs are outputs for consumers.
		headerRef = $bindable(null),
		rowMapRef,
		// eslint-disable-next-line no-useless-assignment -- Bindable refs are outputs for consumers.
		footerRef = $bindable(null),
		table,
		rowVirtualizer,
		selectedCellsSet,
		getRowSelection,
		height = 1200,
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
		const visibility = table.atoms.columnVisibility.get();
		return Object.entries(visibility)
			.filter(([_, visible]) => visible === false)
			.map(([id]) => id)
			.sort()
			.join(',');
	});

	let gridViewportWidth = $state(0);

	const rows = $derived(table.getRowModel().rows);
	const cardColumns = $derived(
		cardFields
			? cardFields.flatMap((id) => table.getAllLeafColumns().filter((column) => column.id === id))
			: table
					.getVisibleLeafColumns()
					.filter((column) => column.columnDef.meta?.cell?.variant !== 'row-select')
	);
	// Keep the ref attachment stable when filtering replaces table column objects.
	const cardColumnKey = $derived(cardColumns.map((column) => column.id).join('\0'));
	const cardColumnIds = $derived(cardColumnKey ? cardColumnKey.split('\0') : []);
	const rowSelection = $derived(getRowSelection());
	const activeSearchRowId = $derived(searchState?.searchMatches[searchState.matchIndex]?.rowId);
	const selectedRowIndices = $derived(
		rows.flatMap((row, index) => (rowSelection[row.id] ? [index] : []))
	);
	const rowModelKey = $derived(rows.map((row) => row.id).join('\0'));
	const meta = $derived(table.options.meta);
	const rowHeight = $derived<RowHeightValue>(meta?.rowHeight ?? 'short');
	const focusedCell = $derived<CellPosition | null>(meta?.focusedCell ?? null);
	// Get table state reactively for pinning/visibility/sizing
	const columnPinning = $derived(table.atoms.columnPinning.get());
	const columnVisibility = $derived(table.atoms.columnVisibility.get());
	const columnSizing = $derived(table.atoms.columnSizing.get());
	const columnResizing = $derived(table.atoms.columnResizing.get());

	// Get visible headers reactively
	const visibleLeafColumns = $derived(table.getVisibleLeafColumns());
	const headerGroups = $derived(table.getHeaderGroups());
	const headerRowCount = $derived(headerGroups.length);
	const hasActiveFilters = $derived(table.atoms.columnFilters.get().length > 0);
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
		const __ = columnResizing;
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
			const isFirstEndPinnedColumn = isPinned === 'end' && column.getIsFirstColumn('end');

			return {
				borderInlineStart: isFirstEndPinnedColumn ? '1px solid var(--border)' : undefined,
				insetInlineStart: isPinned === 'start' ? `${column.getStart('start')}px` : undefined,
				insetInlineEnd: isPinned === 'end' ? `${column.getAfter('end')}px` : undefined,
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

	function onCardContextMenu(event: MouseEvent, row: Row<TData>, rowIndex: number) {
		if (
			event.target instanceof Element &&
			event.target.closest('input, textarea, select, [contenteditable="true"]')
		) {
			event.stopPropagation();
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		if (!row.getIsSelected()) {
			table.resetRowSelection();
			meta?.onRowSelect?.(rowIndex, true, false);
		}
		const columnId = cardColumnIds[0];
		if (columnId) meta?.onCellContextMenu?.(rowIndex, columnId, event);
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
	// We read both columnSizing and columnResizing to create reactive dependencies
	// columnResizing updates during resize drag, columnSizing updates on release
	const columnSizeStyle = $derived.by(() => {
		// Read both states to ensure reactivity when columns are resized
		const _ = columnSizing;
		const __ = columnResizing;

		const vars: string[] = [];
		try {
			const headers = table.getFlatHeaders();
			for (const header of headers) {
				const size = header.getSize();
				vars.push(`--header-${header.id}-size: ${size}`);
				vars.push(`--col-${header.column.id}-size: ${size}`);
			}
		} catch {
			// Table not ready yet
		}
		return vars.join('; ');
	});

	// Get virtual items - use getters for reactive access
	const virtualItems = $derived(rowVirtualizer.virtualItems);
	const totalSize = $derived(rowVirtualizer.totalSize);
	const statusCellWidth = $derived(gridViewportWidth ? `${gridViewportWidth}px` : '100%');

	// Handler for global mouseup - ends drag selection even when mouse leaves grid
	function handleWindowMouseUp() {
		meta?.onCellMouseUp?.();
	}
</script>

<svelte:window onmouseup={handleWindowMouseUp} />

<TooltipProvider>
	<div data-slot="grid-wrapper" class="relative flex w-full min-w-0 flex-col">
		{#if card}
			<div class="mb-3 flex flex-wrap items-center gap-2">
				<Button
					variant={display === 'grid' ? 'secondary' : 'outline'}
					size="sm"
					aria-pressed={display === 'grid'}
					onclick={() => (display = 'grid')}><LayoutGrid />Cards</Button
				>
				<Button
					variant={display === 'table' ? 'secondary' : 'outline'}
					size="sm"
					aria-pressed={display === 'table'}
					onclick={() => (display = 'table')}><TableIcon />Table</Button
				>
				{#if display === 'grid'}
					<label class="flex shrink-0 items-center pr-3 text-sm whitespace-nowrap">
						<RowSelectHeader {table} />Select all
					</label>
					{#if !meta?.readOnly && meta?.onRowsDuplicate}
						<Button
							variant="outline"
							size="sm"
							disabled={!selectedRowIndices.length || meta?.getIsDuplicating?.()}
							onclick={() => meta?.onRowsDuplicate?.()}>Duplicate</Button
						>
					{/if}
					{#if !meta?.readOnly && meta?.onRowsDeleteRequest}
						<Button
							variant="outline"
							size="sm"
							disabled={!selectedRowIndices.length}
							onclick={() => meta?.onRowsDeleteRequest?.(selectedRowIndices)}>Delete</Button
						>
					{/if}
				{/if}
			</div>
		{/if}
		{#if searchState}
			<DataGridSearch
				searchOpen={searchState.searchOpen}
				searchQuery={searchState.searchQuery}
				searchMatches={searchState.searchMatches}
				matchIndex={searchState.matchIndex}
				searchFocusRequest={searchState.searchFocusRequest}
				searchFilterEnabled={searchState.searchFilterEnabled}
				onSearchOpenChange={searchState.onSearchOpenChange}
				onSearchQueryChange={searchState.onSearchQueryChange}
				onSearch={searchState.onSearch}
				onSearchFilterEnabledChange={searchState.onSearchFilterEnabledChange}
				onNavigateToNextMatch={searchState.onNavigateToNextMatch}
				onNavigateToPrevMatch={searchState.onNavigateToPrevMatch}
			/>
		{/if}

		<DataGridContextMenu {table} />

		<DataGridPasteDialog {table} />

		{#if display === 'grid' && card}
			<div
				role="grid"
				aria-label="Card grid"
				aria-rowcount={rows.length}
				aria-colcount={cardColumns.length}
				aria-multiselectable="true"
				tabindex="0"
				onfocus={(event) => {
					if (
						event.target === event.currentTarget &&
						!focusedCell &&
						selectedRowIndices.length === 0 &&
						cardColumnIds[0] &&
						rows.length
					)
						meta?.onCellClick?.(0, cardColumnIds[0]);
				}}
				{@attach (element) => {
					dataGridRef = element;
					setDataGridRef?.(element, cardColumnIds);
					return () => {
						dataGridRef = null;
						setDataGridRef?.(null);
					};
				}}
				class={cn('p-1 outline-none', preferencesRestoring && 'invisible', className)}
				aria-busy={loading || preferencesRestoring}
			>
				{#if statusRowVisible}
					<div
						class="grid min-h-48 place-items-center rounded-lg border border-dashed p-6 text-sm text-muted-foreground"
					>
						{#if loading}
							<div role="status">
								{#if loadingState}{@render loadingState({
										message: loadingMessage
									})}{:else}{loadingMessage}{/if}
							</div>
						{:else if error}
							<div role="alert">
								{#if errorState}{@render errorState({
										message: normalizedErrorMessage,
										error
									})}{:else}{normalizedErrorMessage}{/if}
							</div>
						{:else if isFilteredEmpty}
							{#if filteredEmptyState}{@render filteredEmptyState({
									message: filteredEmptyMessage
								})}{:else}{filteredEmptyMessage}{/if}
						{:else if emptyState}{@render emptyState({
								message: emptyMessage
							})}{:else}{emptyMessage}{/if}
					</div>
				{:else}
					<div
						role="rowgroup"
						class="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3"
					>
						{#each rows as row, rowIndex (row.id)}
							<div
								role="row"
								aria-rowindex={rowIndex + 1}
								aria-selected={rowSelection[row.id] ?? false}
								data-card-row={row.id}
								{@attach (element) => {
									const onContextMenu = (event: MouseEvent) =>
										onCardContextMenu(event, row, rowIndex);
									element.addEventListener('contextmenu', onContextMenu, true);
									return () => element.removeEventListener('contextmenu', onContextMenu, true);
								}}
								{@attach (element) => {
									if (activeSearchRowId === row.id) element.scrollIntoView({ block: 'nearest' });
								}}
								class={cn(
									'relative overflow-hidden rounded-lg border bg-card shadow-xs transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md',
									rowSelection[row.id] && 'ring-2 ring-primary',
									searchState?.searchMatches.some((match) => match.rowId === row.id) &&
										'border-amber-400',
									activeSearchRowId === row.id && 'outline-2 outline-amber-500'
								)}
							>
								<div class="absolute top-2 left-2 z-10 rounded bg-background/90 p-1.5">
									<Checkbox
										aria-label="Select card"
										checked={rowSelection[row.id] ?? false}
										onCheckedChange={(checked) =>
											meta?.onRowSelect
												? meta.onRowSelect(rowIndex, !!checked, false)
												: row.toggleSelected(!!checked)}
									/>
								</div>
								{#snippet fields()}
									<div class="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-2 gap-y-1 p-3">
										{#each cardColumns as column (column.id)}
											{@const cell = row.getAllCells().find((cell) => cell.column.id === column.id)}
											{#if cell}
												<div
													class="col-span-2 grid min-w-0 grid-cols-subgrid items-center"
													data-card-field={column.id}
												>
													<p class="min-w-0 px-2 text-xs break-words text-muted-foreground">
														{typeof column.columnDef.header === 'string'
															? column.columnDef.header
															: column.id}:
													</p>
													<div
														class="min-w-0 rounded border"
														style:height="{getRowHeightValue(rowHeight)}px"
													>
														<DataGridCell {cell} {table} {selectedCellsSet} />
													</div>
												</div>
											{/if}
										{/each}
									</div>
								{/snippet}
								{@render card(row.original, fields)}
							</div>
						{/each}
					</div>
				{/if}
				{#if footerVisible}<Button
						class="mt-3"
						variant="outline"
						onclick={async () => {
							display = 'table';
							await tick();
							onRowAdd?.();
						}}><Plus />Add item</Button
					>{/if}
			</div>
		{:else}
			<div
				data-slot="grid"
				class={cn(
					'relative flex min-h-0 flex-col overflow-clip rounded-lg border select-none focus-within:outline-none',
					preferencesRestoring && 'invisible',
					className
				)}
				style="max-height: {height}px;"
			>
				<div
					role="grid"
					aria-label="Data grid"
					aria-rowcount={ariaRowCount}
					aria-colcount={ariaColumnCount}
					aria-multiselectable="true"
					aria-busy={loading || preferencesRestoring}
					tabindex={focusedCell ? -1 : 0}
					{@attach (element) => {
						dataGridRef = element;
						setDataGridRef?.(element);
						return () => {
							dataGridRef = null;
							setDataGridRef?.(null);
						};
					}}
					bind:clientWidth={gridViewportWidth}
					class="grid-scrollbar min-h-0 flex-1 overflow-auto overscroll-x-none focus:outline-none"
					oncontextmenu={onGridContextMenu}
					onmouseup={handleGridMouseUp}
					onfocus={onGridFocus}
				>
					<div
						class="grid min-w-full"
						style="{columnSizeStyle}; width: max(100%, {totalVisibleWidth}px);"
					>
						<!-- Header -->
						<div
							role="rowgroup"
							data-slot="grid-header"
							{@attach (element) => {
								headerRef = element;
								setHeaderRef?.(element);
								return () => {
									headerRef = null;
									setHeaderRef?.(null);
								};
							}}
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
											{@const sorting = table.atoms.sorting.get()}
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
												style="position: {pinningStyles.position}; inset-inline-start: {pinningStyles.insetInlineStart}; inset-inline-end: {pinningStyles.insetInlineEnd}; background: {pinningStyles.background}; border-inline-start: {pinningStyles.borderInlineStart}; z-index: {pinningStyles.zIndex}; width: calc(var(--header-{header.id}-size) * 1px);"
											>
												{#if header.isPlaceholder}
													<!-- Empty -->
												{:else if typeof header.column.columnDef.header === 'function'}
													<div class="size-full px-3 py-1.5">
														{#key rowModelKey}
															<FlexRender {header} />
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
									class="flex h-24 w-full items-center"
								>
									<div
										role="gridcell"
										aria-colindex="1"
										aria-colspan={ariaColumnCount}
										class="sticky left-0 flex justify-center px-6 text-center text-sm text-muted-foreground"
										style:width={statusCellWidth}
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
					</div>
				</div>

				<!-- Footer / Add Row -->
				{#if footerVisible}
					<div
						role="rowgroup"
						data-slot="grid-footer"
						{@attach (element) => {
							footerRef = element;
							setFooterRef?.(element);
							return () => {
								footerRef = null;
								setFooterRef?.(null);
							};
						}}
						class="grid w-full shrink-0 border-t bg-background"
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
									class="flex h-full items-center gap-2 px-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
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
		{/if}
	</div>
</TooltipProvider>
