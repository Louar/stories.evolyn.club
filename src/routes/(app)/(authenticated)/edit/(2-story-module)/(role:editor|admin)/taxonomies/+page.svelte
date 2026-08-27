<script lang="ts">
	import { page } from '$app/state';
	import Header from '$lib/components/app/header/app-header.svelte';
	import {
		DataGrid,
		DataGridFilterMenu,
		DataGridKeyboardShortcuts,
		DataGridRowHeightMenu,
		DataGridSortMenu,
		DataGridViewMenu,
		getFilterFn,
		RowSelectHeader
	} from '$lib/components/data-grid';
	import BreadcrumbMenu from '$lib/components/ui/breadcrumb-menu/breadcrumb-menu.svelte';
	import { renderComponent } from '$lib/components/ui/table-tanstack/index.js';
	import { useDataGrid } from '$lib/hooks/use-custom-data-grid.svelte';
	import { useWindowSize } from '$lib/hooks/use-window-size.svelte';
	import type { ColumnDef } from '@tanstack/table-core';

	let { data } = $props();
	const endpoint = `/api/taxonomies`;

	let rows = $derived(data.taxonomies);
	type Row = (typeof rows)[number];

	const filterFn = getFilterFn<Row>();
	const windowSize = useWindowSize({ defaultHeight: 800 });
	const gridHeight = $derived(Math.max(250, windowSize.height - 150));

	const columns: ColumnDef<Row, unknown>[] = [
		{
			id: 'select-row',
			size: 40,
			enableSorting: false,
			enableHiding: false,
			enableResizing: false,
			header: ({ table }) => renderComponent(RowSelectHeader, { table }),
			meta: { cell: { variant: 'row-select' } }
		},
		{
			accessorKey: 'id',
			header: 'ID',
			meta: { cell: { variant: 'text-short' }, readOnly: true },
			filterFn
		},
		{
			accessorKey: 'clientId',
			header: 'Client',
			meta: { cell: { variant: 'text-short' }, readOnly: true },
			filterFn
		},
		{
			accessorKey: 'name',
			header: 'Name',
			meta: { cell: { variant: 'text-short' } },
			filterFn
		},
		{
			accessorKey: 'description',
			header: 'Description',
			meta: { cell: { variant: 'text-long' } },
			filterFn
		},
		{
			accessorKey: 'categories',
			header: 'Categories',
			size: 120,
			meta: {
				cell: { variant: 'relation-follow', url: `${page.url.pathname}/{row}/categories` },
				readOnly: true
			},
			filterFn
		},
		{
			accessorKey: 'attributes',
			header: 'Attributes',
			size: 120,
			meta: {
				cell: { variant: 'relation-follow', url: `${page.url.pathname}/{row}/attributes` },
				readOnly: true
			},
			filterFn
		},
		{
			accessorKey: 'items',
			header: 'Items',
			size: 120,
			meta: {
				cell: { variant: 'relation-follow', url: `${page.url.pathname}/{row}/items` },
				readOnly: true
			},
			filterFn
		},
		{
			accessorKey: 'drafts',
			header: 'Drafts',
			size: 120,
			meta: {
				cell: { variant: 'relation-follow', url: `${page.url.pathname}/{row}/drafts` },
				readOnly: true
			},
			filterFn
		}
	];

	const dataGrid = useDataGrid<Row>({
		columns,
		data: () => rows,
		getRowId: (row) => row.id,
		endpoint,
		onDataChange: (nextRows) => (rows = nextRows),
		enableSearch: true,
		enablePaste: true,
		initialState: {
			columnVisibility: { id: false, clientId: false },
			columnPinning: { left: ['select-row'] }
		}
	} as const);

	const { table, ...dataGridProps } = dataGrid;
</script>

<svelte:head>
	<title>Edit taxonomies</title>
</svelte:head>

<Header>
	<BreadcrumbMenu menus={[[{ isTrigger: true, label: 'Taxonomies', url: `/edit/taxonomies` }]]} />
</Header>

<div class="mx-auto mt-4 w-full max-w-6xl space-y-4 px-4">
	<div role="toolbar" aria-orientation="horizontal" class="flex items-center justify-between">
		<DataGridKeyboardShortcuts enableSearch={!!dataGridProps.searchState} />
		<div class="flex w-full items-center gap-1">
			<DataGridFilterMenu {table} />
			<DataGridSortMenu {table} />
			<DataGridRowHeightMenu {table} />
			<DataGridViewMenu {table} />
		</div>
	</div>

	<DataGrid {...dataGridProps} {table} height={gridHeight} />
</div>
