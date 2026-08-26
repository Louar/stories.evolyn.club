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
	import { translateLocalizedField, type Translatable } from '$lib/db/schemas/0-utils.js';
	import { useDataGrid } from '$lib/hooks/use-custom-data-grid.svelte';
	import { UI } from '$lib/states/ui.svelte';
	import { useWindowSize } from '$lib/hooks/use-window-size.svelte';
	import type { ColumnDef } from '@tanstack/table-core';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const taxonomyBasePath = `/edit/taxonomies/${data.taxonomy.id}`;
	// svelte-ignore state_referenced_locally
	const endpoint = `/api/taxonomies/${data.taxonomy.id}/items`;

	let rows = $derived(data.items);
	type Row = (typeof rows)[number];

	const filterFn = getFilterFn<Row>();
	const windowSize = useWindowSize({ defaultHeight: 800 });
	const gridHeight = $derived(Math.max(250, windowSize.height - 150));
	const categoryOptions = () =>
		data.categories.map((category) => ({
			title: translateLocalizedField(category.name as Translatable, UI.language) ?? category.id,
			value: category.id
		}));

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
			accessorKey: 'taxonomyId',
			header: 'Taxonomy',
			meta: { cell: { variant: 'text-short' }, readOnly: true },
			filterFn
		},
		{
			accessorKey: 'name',
			header: 'Name',
			size: 180,
			meta: { cell: { variant: 'text-short' }, readOnly: true },
			filterFn
		},
		{
			accessorKey: 'categories',
			header: 'Categories',
			size: 240,
			meta: { cell: { variant: 'select-multiple', options: categoryOptions() } },
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
			columnVisibility: { id: false, taxonomyId: false },
			columnPinning: { left: ['select-row'] }
		}
	} as const);

	const { table, ...dataGridProps } = dataGrid;
</script>

<svelte:head>
	<title>Edit items</title>
</svelte:head>

<Header class="mx-auto w-full max-w-6xl">
	<BreadcrumbMenu
		menus={[
			[
				{ label: 'Taxonomies', url: `/edit/taxonomies` },
				{ label: 'Attributes', url: `${taxonomyBasePath}/attributes` },
				{ label: 'Categories', url: `${taxonomyBasePath}/categories` },
				{ label: 'Drafts', url: `${taxonomyBasePath}/drafts` },
				{ isTrigger: true, label: 'Items', url: `${taxonomyBasePath}/items` }
			]
		]}
	/>
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
