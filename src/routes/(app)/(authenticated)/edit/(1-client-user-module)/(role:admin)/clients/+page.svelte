<script lang="ts">
	import { page } from '$app/state';
	import Header from '$lib/components/app/header/app-header.svelte';
	import {
		createDataGridPersistenceIdentity,
		createEndpointDataGridAdapter,
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
	import { Language, LanguageReverse, MediaCollection } from '$lib/db/schemas/0-utils.js';
	import { ClientAuthenticationMethod } from '$lib/db/schemas/1-client-user-module.js';
	import { useWindowSize } from '$lib/hooks/use-window-size.svelte';
	import type { ColumnDef } from '$lib/components/data-grid/data-grid-table.js';

	let { data } = $props();
	const endpoint = `/api/clients`;

	let rows = $derived(data.clients);
	type Row = (typeof rows)[number];

	const authenticationMethodOptions = () =>
		Object.values(ClientAuthenticationMethod).map((method) => ({
			title: method,
			value: method
		}));
	const languageOptions = () =>
		Object.values(Language).map((language) => ({
			title: LanguageReverse[language],
			value: language
		}));

	const filterFn = getFilterFn<Row>();
	const windowSize = useWindowSize({ defaultHeight: 800 });
	const gridHeight = $derived(Math.max(250, windowSize.height - 150));
	const dataAdapter = createEndpointDataGridAdapter<Row>(endpoint);

	const columns: ColumnDef<Row, unknown>[] = [
		{
			id: 'select-row',
			size: 40,
			enableSorting: false,
			enableHiding: false,
			enableResizing: false,
			header: ({ table }) => renderComponent(RowSelectHeader, { table }),
			meta: { cell: { variant: 'row-select' }, description: 'Select this client row.' }
		},
		{
			accessorKey: 'id',
			header: 'ID',
			meta: {
				cell: { variant: 'text-short' },
				description: 'Unique client identifier.',
				readOnly: true
			},
			filterFn
		},
		{
			accessorKey: 'slug',
			header: 'Slug',
			meta: { cell: { variant: 'text-short' }, description: 'URL-safe client identifier.' },
			filterFn
		},
		{
			accessorKey: 'name',
			header: 'Name',
			meta: { cell: { variant: 'text-short' }, description: 'Client name.' },
			filterFn
		},
		{
			accessorKey: 'description',
			header: 'Description',
			meta: {
				cell: { variant: 'text-translated-long', markdown: true },
				description: 'Translated client description in Markdown.'
			},
			filterFn
		},
		{
			accessorKey: 'domains',
			header: 'Domains',
			meta: { cell: { variant: 'text-long' }, description: 'Domains assigned to the client.' },
			filterFn
		},
		{
			accessorKey: 'locales',
			header: 'Locales',
			meta: {
				cell: { variant: 'select-multiple', options: languageOptions() },
				description: 'Locales supported by the client.'
			},
			filterFn
		},
		{
			accessorKey: 'administrationEmail',
			header: 'Administration email',
			meta: {
				cell: { variant: 'text-short' },
				description: 'Email address used for client administration.'
			},
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
				},
				description: 'Client logo image.'
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
				},
				description: 'Client favicon image.'
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
				},
				description: 'Client splash image.'
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
				},
				description: 'Client hero image.'
			}
		},
		{
			accessorKey: 'css',
			header: 'CSS',
			meta: {
				cell: { variant: 'json-yaml' },
				description: 'Custom CSS configuration for the client.'
			},
			filterFn
		},
		{
			accessorKey: 'manifest',
			header: 'Manifest',
			meta: {
				cell: { variant: 'json-yaml' },
				description: 'Web app manifest configuration for the client.'
			},
			filterFn
		},
		{
			accessorKey: 'isFindableBySearchEngines',
			header: 'Findable by search engines',
			meta: {
				cell: { variant: 'checkbox' },
				description: 'Whether search engines may index the client.'
			},
			filterFn
		},
		{
			accessorKey: 'plausibleDomain',
			header: 'Plausible domain',
			meta: {
				cell: { variant: 'text-short' },
				description: 'Domain used for Plausible analytics.'
			},
			filterFn
		},
		{
			accessorKey: 'authenticationMethods',
			header: 'Authentication methods',
			meta: {
				cell: { variant: 'select-multiple', options: authenticationMethodOptions() },
				description: 'Authentication methods enabled for the client.'
			},
			filterFn
		},
		{
			accessorKey: 'accessTokenKey',
			header: 'Access token key',
			meta: {
				cell: { variant: 'text-short' },
				description: 'Key used to sign client access tokens.'
			},
			filterFn
		},
		{
			accessorKey: 'redirectAuthorized',
			header: 'Redirect authorized',
			meta: {
				cell: { variant: 'text-short' },
				description: 'Redirect target after authorized access.'
			},
			filterFn
		},
		{
			accessorKey: 'redirectUnauthorized',
			header: 'Redirect unauthorized',
			meta: {
				cell: { variant: 'text-short' },
				description: 'Redirect target after unauthorized access.'
			},
			filterFn
		},
		{
			accessorKey: 'clientApiKeys',
			header: 'API keys',
			size: 120,
			meta: {
				cell: { variant: 'relation-follow', url: `${page.url.pathname}/{row}/api-keys` },
				description: 'API keys belonging to the client.',
				readOnly: true
			},
			filterFn
		},
		{
			accessorKey: 'createdAt',
			header: 'Created at',
			meta: {
				cell: { variant: 'date-time' },
				description: 'When the client was created.',
				readOnly: true
			},
			filterFn
		},
		{
			accessorKey: 'createdBy',
			header: 'Created by',
			meta: {
				cell: { variant: 'badge-item' },
				description: 'Who created the client.',
				readOnly: true
			},
			filterFn
		},
		{
			accessorKey: 'updatedAt',
			header: 'Updated at',
			meta: {
				cell: { variant: 'date-time' },
				description: 'When the client was last updated.',
				readOnly: true
			},
			filterFn
		},
		{
			accessorKey: 'updatedBy',
			header: 'Updated by',
			meta: {
				cell: { variant: 'badge-item' },
				description: 'Who last updated the client.',
				readOnly: true
			},
			filterFn
		}
	];

	const dataGrid = useDataGrid<Row>({
		columns,
		data: () => rows,
		persistence: createDataGridPersistenceIdentity('edit.clients', () => data),
		getRowId: (row) => row.id,
		dataAdapter,
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
			columnPinning: { start: ['select-row'], end: [] }
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
