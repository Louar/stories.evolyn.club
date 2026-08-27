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
	import DataGridLanguageSelectMenu from '$lib/components/data-grid/data-grid-language-select-menu.svelte';
	import BreadcrumbMenu from '$lib/components/ui/breadcrumb-menu/breadcrumb-menu.svelte';
	import { renderComponent } from '$lib/components/ui/table-tanstack/index.js';
	import { MediaCollection } from '$lib/db/schemas/0-utils.js';
	import {
		fileCellMediaToFileCellData,
		hasTranslatableFields,
		uploadMedia,
		useDataGrid
	} from '$lib/hooks/use-custom-data-grid.svelte';
	import { useWindowSize } from '$lib/hooks/use-window-size.svelte';
	import type { ColumnDef } from '@tanstack/table-core';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const taxonomyBasePath = `/edit/taxonomies/${data.taxonomy.id}`;
	// svelte-ignore state_referenced_locally
	const endpoint = `/api/taxonomies/${data.taxonomy.id}/categories`;

	let rows = $derived(data.categories);
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
			accessorKey: 'taxonomyId',
			header: 'Taxonomy',
			meta: { cell: { variant: 'text-short' }, readOnly: true },
			filterFn
		},
		{
			accessorKey: 'name',
			header: 'Name',
			meta: { cell: { variant: 'text-translated-short' } },
			filterFn
		},
		{
			accessorKey: 'image',
			header: 'Image',
			cell: ({ row }) => fileCellMediaToFileCellData(row.original.image),
			meta: {
				cell: {
					variant: 'file-or-url',
					accept: 'image/*',
					maxFiles: 1,
					multiple: false
				}
			}
		},
		{
			accessorKey: 'description',
			header: 'Description',
			meta: { cell: { variant: 'text-translated-long', markdown: true } },
			filterFn
		},
		{
			accessorKey: 'map',
			header: 'Map',
			meta: { cell: { variant: 'json-yaml' } },
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
		onFilesUpload: async ({ files, columnId, row }) =>
			uploadMedia({
				collection: MediaCollection.externals,
				files,
				rowId: row.id,
				columnId
			}),
		enableSearch: true,
		enablePaste: true,
		initialState: {
			columnVisibility: { id: false, taxonomyId: false },
			columnPinning: { left: ['select-row'] }
		}
	} as const);

	const { table, ...dataGridProps } = dataGrid;
	const showLanguageMenu = $derived(hasTranslatableFields(columns));
</script>

<svelte:head>
	<title>Edit categories</title>
</svelte:head>

<Header>
	<BreadcrumbMenu
		menus={[
			[
				{ label: 'Taxonomies', url: `/edit/taxonomies` },
				{ label: 'Attributes', url: `${taxonomyBasePath}/attributes` },
				{ label: 'Drafts', url: `${taxonomyBasePath}/drafts` },
				{ label: 'Items', url: `${taxonomyBasePath}/items` },
				{ isTrigger: true, label: 'Categories', url: `${taxonomyBasePath}/categories` }
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
			{#if showLanguageMenu}
				<DataGridLanguageSelectMenu class="ml-auto" />
			{/if}
		</div>
	</div>

	<DataGrid {...dataGridProps} {table} height={gridHeight} />
</div>
