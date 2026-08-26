<script lang="ts">
	import { page } from '$app/state';
	import Header from '$lib/components/app/header/app-header.svelte';
	import {
		createDataGridPersistenceIdentity,
		DataGrid,
		DataGridToolbar,
		fileCellMediaToFileCellData,
		getFilterFn,
		hasTranslatableFields,
		RowSelectHeader,
		uploadMedia,
		useDataGrid
	} from '$lib/components/data-grid';
	import DataGridLanguageSelectMenu from '$lib/components/data-grid/data-grid-language-select-menu.svelte';
	import BreadcrumbMenu from '$lib/components/ui/breadcrumb-menu/breadcrumb-menu.svelte';
	import { renderComponent } from '$lib/components/ui/table-tanstack/index.js';
	import { MediaCollection } from '$lib/db/schemas/0-utils.js';
	import { ClientAuthenticationMethod } from '$lib/db/schemas/1-client-user-module.js';
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
			accessorKey: 'slug',
			header: 'Slug',
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
			accessorKey: 'administrationEmail',
			header: 'Administration email',
			meta: { cell: { variant: 'text-short' } },
			filterFn
		},
		{
			accessorKey: 'logo',
			header: 'Logo',
			cell: ({ row }) => fileCellMediaToFileCellData(row.original.logo),
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
			accessorKey: 'favicon',
			header: 'Favicon',
			cell: ({ row }) => fileCellMediaToFileCellData(row.original.favicon),
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
			accessorKey: 'splash',
			header: 'Splash',
			cell: ({ row }) => fileCellMediaToFileCellData(row.original.splash),
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
			accessorKey: 'hero',
			header: 'Hero',
			cell: ({ row }) => fileCellMediaToFileCellData(row.original.hero),
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
			meta: { cell: { variant: 'text-short' } },
			filterFn
		},
		{
			accessorKey: 'redirectUnauthorized',
			header: 'Redirect unauthorized',
			meta: { cell: { variant: 'text-short' } },
			filterFn
		},
		{
			accessorKey: 'clientApiKeys',
			header: 'API keys',
			size: 120,
			meta: {
				cell: { variant: 'relation-follow', url: `${page.url.pathname}/{row}/api-keys` },
				readOnly: true
			},
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
		persistence: createDataGridPersistenceIdentity('edit.clients', () => data),
		getRowId: (row) => row.id,
		endpoint: `/api/clients`,
		onDataChange: (nextRows) => (rows = nextRows),
		onFilesUpload: async ({ files, columnId, rowId }) =>
			uploadMedia({
				collection: MediaCollection.clients,
				files,
				rowId,
				columnId
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

<svelte:head>
	<title>Edit clients</title>
</svelte:head>

<Header>
	<BreadcrumbMenu
		menus={[
			[
				{ label: 'Missions', url: `/edit/missions` },
				{ isTrigger: true, label: 'Clients', url: `/edit/clients` },
				{ label: 'API keys', url: `/edit/clients/api-keys` }
			]
		]}
	/>
</Header>

<div class="mx-auto mt-4 w-full max-w-6xl space-y-4 px-4">
	<DataGridToolbar {table} enableSearch={!!dataGridProps.searchState}>
		{#snippet actions()}
			{#if showLanguageMenu}
				<DataGridLanguageSelectMenu class="ml-auto" />
			{/if}
		{/snippet}
	</DataGridToolbar>

	<DataGrid {...dataGridProps} {table} height={gridHeight} />
</div>
