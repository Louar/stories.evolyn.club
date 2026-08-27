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
	import BreadcrumbMenu from '$lib/components/ui/breadcrumb-menu/breadcrumb-menu.svelte';
	import { renderComponent } from '$lib/components/ui/table-tanstack/index.js';
	import { translateLocalizedField, type Translatable } from '$lib/db/schemas/0-utils.js';
	import { useDataGrid } from '$lib/hooks/use-custom-data-grid.svelte';
	import { useWindowSize } from '$lib/hooks/use-window-size.svelte';
	import { UI } from '$lib/states/ui.svelte';
	import type { ColumnDef } from '@tanstack/table-core';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const taxonomyBasePath = `/edit/taxonomies/${data.item.taxonomyId}`;
	// svelte-ignore state_referenced_locally
	const endpoint = `/api/taxonomies/${data.item.taxonomyId}/items/${data.item.id}/attributes`;

	let rows = $derived(data.attributes);
	type Row = (typeof rows)[number];

	const filterFn = getFilterFn<Row>();
	const windowSize = useWindowSize({ defaultHeight: 800 });
	const gridHeight = $derived(Math.max(250, windowSize.height - 150));
	const attributeOptions = () =>
		data.attributeOptions.map((attribute) => ({
			title: translateLocalizedField(attribute.name as Translatable, UI.language) ?? attribute.slug,
			value: attribute.id,
			summary: attribute.slug
		}));
	const referencedItemOptions = () =>
		data.referencedItemOptions.map((item) => ({
			title: item.name ?? item.id,
			value: item.id,
			summary:
				translateLocalizedField(item.categoryName as Translatable, UI.language) ?? item.categoryId
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
			accessorKey: 'attributeId',
			header: 'Attribute',
			size: 240,
			meta: { cell: { variant: 'relation-select-single', options: attributeOptions() } },
			filterFn
		},
		{
			accessorKey: 'slug',
			header: 'Slug',
			meta: { cell: { variant: 'text-short' }, readOnly: true },
			filterFn
		},
		{
			accessorKey: 'type',
			header: 'Type',
			meta: { cell: { variant: 'text-short' }, readOnly: true },
			filterFn
		},
		{
			accessorKey: 'value',
			header: 'Value',
			meta: { cell: { variant: 'json-yaml' } },
			filterFn
		},
		{
			accessorKey: 'referencedItemId',
			header: 'Referenced item',
			size: 240,
			meta: { cell: { variant: 'relation-select-single', options: referencedItemOptions() } },
			filterFn
		},
		{
			accessorKey: 'difficulty',
			header: 'Difficulty',
			meta: { cell: { variant: 'number' } },
			filterFn
		}
	];

	const dataGrid = useDataGrid<Row>({
		columns,
		data: () => rows,
		getRowId: (row) => row.attributeId,
		endpoint,
		onDataChange: (nextRows) => (rows = nextRows),
		enableSearch: true,
		enablePaste: true,
		initialState: {
			columnPinning: { left: ['select-row'] }
		}
	} as const);

	const { table, ...dataGridProps } = dataGrid;
</script>

<svelte:head>
	<title>Edit item attributes</title>
</svelte:head>

<Header>
	<BreadcrumbMenu
		menus={[
			[
				{ label: 'Taxonomies', url: `/edit/taxonomies` },
				{ label: 'Items', url: `${taxonomyBasePath}/items` },
				{
					isTrigger: true,
					label: 'Attributes',
					url: `${taxonomyBasePath}/items/${data.item.id}/attributes`
				}
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
