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
	import { MediaCollection } from '$lib/db/schemas/0-utils.js';
	import { ClientAuthenticationMethod } from '$lib/db/schemas/1-client-user-module.js';
	import {
		fileCellMediaToFileCellData,
		hasTranslatableFields,
		uploadMedia,
		useDataGrid
	} from '$lib/hooks/use-custom-data-grid.svelte';
	import { useWindowSize } from '$lib/hooks/use-window-size.svelte';
	import type { ColumnDef } from '@tanstack/table-core';

	let { data } = $props();

	let rows = $derived(data.clients);
	type Row = (typeof rows)[number];

	const authenticationMethodOptions = () =>
		Object.values(ClientAuthenticationMethod).map((method) => ({
			title: method,
			value: method
		}));

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
			accessorKey: 'reference',
			header: 'Reference',
			meta: { cell: { variant: 'text-short' } },
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
			meta: { cell: { variant: 'text-translated-long', markdown: true } },
			filterFn
		},
		{
			accessorKey: 'domains',
			header: 'Domains',
			meta: { cell: { variant: 'text-long' } },
			filterFn
		},
		{
			accessorKey: 'logo',
			header: 'Logo',
			cell: ({ row }) => fileCellMediaToFileCellData(row.original.logo),
			meta: {
				cell: {
					variant: 'file',
					accept: 'image/*',
					maxFiles: 1,
					multiple: false
				}
			}
		},
		{
			accessorKey: 'favicon',
			header: 'Favicon',
			cell: ({ row }) => fileCellMediaToFileCellData(row.original.favicon),
			meta: {
				cell: {
					variant: 'file',
					accept: 'image/*',
					maxFiles: 1,
					multiple: false
				}
			}
		},
		{
			accessorKey: 'splash',
			header: 'Splash',
			cell: ({ row }) => fileCellMediaToFileCellData(row.original.splash),
			meta: {
				cell: {
					variant: 'file',
					accept: 'image/*',
					maxFiles: 1,
					multiple: false
				}
			}
		},
		{
			accessorKey: 'hero',
			header: 'Hero',
			cell: ({ row }) => fileCellMediaToFileCellData(row.original.hero),
			meta: {
				cell: {
					variant: 'file',
					accept: 'image/*',
					maxFiles: 1,
					multiple: false
				}
			}
		},
		{
			accessorKey: 'css',
			header: 'CSS',
			meta: { cell: { variant: 'json-yaml' } },
			filterFn
		},
		{
			accessorKey: 'manifest',
			header: 'Manifest',
			meta: { cell: { variant: 'json-yaml' } },
			filterFn
		},
		{
			accessorKey: 'isFindableBySearchEngines',
			header: 'Findable by search engines',
			meta: { cell: { variant: 'checkbox' } },
			filterFn
		},
		{
			accessorKey: 'plausibleDomain',
			header: 'Plausible domain',
			meta: { cell: { variant: 'text-short' } },
			filterFn
		},
		{
			accessorKey: 'authenticationMethods',
			header: 'Authentication methods',
			meta: { cell: { variant: 'select-multiple', options: authenticationMethodOptions() } },
			filterFn
		},
		{
			accessorKey: 'accessTokenKey',
			header: 'Access token key',
			meta: { cell: { variant: 'text-short' } },
			filterFn
		},
		{
			accessorKey: 'redirectAuthorized',
			header: 'Redirect authorized',
			meta: { cell: { variant: 'json-yaml' } },
			filterFn
		},
		{
			accessorKey: 'redirectUnauthorized',
			header: 'Redirect unauthorized',
			meta: { cell: { variant: 'text-short' } },
			filterFn
		},
		{
			accessorKey: 'onboardingSchema',
			header: 'Onboarding schema',
			meta: { cell: { variant: 'json-yaml' } },
			filterFn
		},
		{
			accessorKey: 'createdAt',
			header: 'Created at',
			meta: { cell: { variant: 'date-time' }, readOnly: true },
			filterFn
		},
		{
			accessorKey: 'createdBy',
			header: 'Created by',
			meta: { cell: { variant: 'badge-item' }, readOnly: true },
			filterFn
		},
		{
			accessorKey: 'updatedAt',
			header: 'Updated at',
			meta: { cell: { variant: 'date-time' }, readOnly: true },
			filterFn
		},
		{
			accessorKey: 'updatedBy',
			header: 'Updated by',
			meta: { cell: { variant: 'badge-item' }, readOnly: true },
			filterFn
		}
	];

	const dataGrid = useDataGrid<Row>({
		columns,
		data: () => rows,
		getRowId: (row) => row.id,
		endpoint: `/api/clients`,
		onDataChange: (nextRows) => (rows = nextRows),
		onFilesUpload: async ({ files, columnId, row }) =>
			uploadMedia({
				collection: MediaCollection.clients,
				files,
				rowId: row.id,
				columnId,
				missionTemplateId: row.id
			}),
		enableSearch: true,
		enablePaste: true,
		initialState: {
			sorting: [{ id: 'id', desc: false }],
			columnVisibility: { id: false },
			columnPinning: { left: ['select-row'] }
		}
	} as const);

	const { table, ...dataGridProps } = dataGrid;

	const showLanguageMenu = $derived(hasTranslatableFields(columns));
</script>

<Header class="mx-auto w-full max-w-6xl">
	<BreadcrumbMenu
		menus={[
			[
				{ label: 'Missions', url: `/edit/missions` },
				{ isTrigger: true, label: 'Clients', url: `/edit/clients` }
			]
		]}
	/>
</Header>

<div class="mx-auto w-full max-w-6xl space-y-4 px-4">
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
