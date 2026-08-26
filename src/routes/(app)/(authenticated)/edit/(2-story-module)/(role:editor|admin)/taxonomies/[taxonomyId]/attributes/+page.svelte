<script lang="ts">
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
	import {
		MediaCollection,
		translateLocalizedField,
		type Translatable
	} from '$lib/db/schemas/0-utils.js';
	import { AttributeType } from '$lib/db/schemas/2-story-module.js';
	import {
		fileCellMediaToFileCellData,
		hasTranslatableFields,
		uploadMedia,
		useDataGrid
	} from '$lib/hooks/use-custom-data-grid.svelte';
	import { UI } from '$lib/states/ui.svelte';
	import { useWindowSize } from '$lib/hooks/use-window-size.svelte';
	import type { ColumnDef } from '@tanstack/table-core';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const taxonomyBasePath = `/edit/taxonomies/${data.taxonomy.id}`;
	// svelte-ignore state_referenced_locally
	const endpoint = `/api/taxonomies/${data.taxonomy.id}/attributes`;

	let rows = $derived(data.attributes);
	type Row = (typeof rows)[number];

	const filterFn = getFilterFn<Row>();
	const windowSize = useWindowSize({ defaultHeight: 800 });
	const gridHeight = $derived(Math.max(250, windowSize.height - 150));

	const attributeTypeOptions = () =>
		Object.values(AttributeType).map((type) => ({
			title: type,
			value: type
		}));
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
			accessorKey: 'slug',
			header: 'Slug',
			meta: { cell: { variant: 'text-short' } },
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
			accessorKey: 'type',
			header: 'Type',
			meta: { cell: { variant: 'select-single', options: attributeTypeOptions() } },
			filterFn
		},
		{
			accessorKey: 'referencedCategoryId',
			header: 'Referenced category',
			size: 240,
			meta: { cell: { variant: 'relation-select-single', options: categoryOptions() } },
			filterFn
		},
		{
			accessorKey: 'schema',
			header: 'Schema',
			meta: { cell: { variant: 'json-yaml' } },
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
	<title>Edit attributes</title>
</svelte:head>

<Header class="mx-auto w-full max-w-6xl">
	<BreadcrumbMenu
		menus={[
			[
				{ label: 'Taxonomies', url: `/edit/taxonomies` },
				{ label: 'Categories', url: `${taxonomyBasePath}/categories` },
				{ label: 'Drafts', url: `${taxonomyBasePath}/drafts` },
				{ label: 'Items', url: `${taxonomyBasePath}/items` },
				{ isTrigger: true, label: 'Attributes', url: `${taxonomyBasePath}/attributes` }
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
