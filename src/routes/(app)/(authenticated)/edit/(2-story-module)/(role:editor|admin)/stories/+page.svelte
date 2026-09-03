<script lang="ts">
	import { invalidateAll } from '$app/navigation';
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
	import DataGridUploadMenu from '$lib/components/data-grid/data-grid-upload-menu.svelte';
	import BreadcrumbMenu from '$lib/components/ui/breadcrumb-menu/breadcrumb-menu.svelte';
	import { MEGABYTE } from '$lib/components/ui/file-drop-zone';
	import { renderComponent } from '$lib/components/ui/table-tanstack/index.js';
	import {
		MediaCollection,
		translateLocalizedMediaField,
		type Media
	} from '$lib/db/schemas/0-utils.js';
	import { useWindowSize } from '$lib/hooks/use-window-size.svelte';
	import { UI } from '$lib/states/ui.svelte';
	import type { ColumnDef } from '@tanstack/table-core';

	let { data } = $props();
	const endpoint = '/api/stories';
	let rows = $derived(data.stories);
	type Row = (typeof rows)[number];

	const filterFn = getFilterFn<Row>();
	const windowSize = useWindowSize({ defaultHeight: 800 });
	const gridHeight = $derived(Math.max(250, windowSize.height - 150));
	const setThumbnail = (row: Row, value: unknown): Row => {
		const file = (Array.isArray(value) ? value[0] : value) as Media | undefined;
		const thumbnail = { ...(row.thumbnail ?? {}) };
		const language =
			file || thumbnail[UI.language] ? UI.language : thumbnail.default ? 'default' : 'en';
		if (file) {
			thumbnail[language] = { collection: file.collection, filename: file.filename };
			if (!thumbnail.default && !thumbnail.en) thumbnail.default = thumbnail[language];
		} else {
			delete thumbnail[language];
		}
		return { ...row, thumbnail: Object.keys(thumbnail).length ? thumbnail : null };
	};

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
		{ accessorKey: 'slug', header: 'Slug', meta: { cell: { variant: 'text-short' } }, filterFn },
		{
			accessorKey: 'name',
			header: 'Name',
			meta: { cell: { variant: 'text-translated-short' } },
			filterFn
		},
		{
			accessorKey: 'defaultBackgroundColor',
			header: 'Background color',
			meta: { cell: { variant: 'text-short' } },
			filterFn
		},
		{
			accessorKey: 'thumbnail',
			header: 'Thumbnail',
			size: 240,
			cell: ({ row }) =>
				fileCellMediaToFileCellData(
					translateLocalizedMediaField(row.original.thumbnail, UI.language) ?? null
				),
			meta: {
				cell: { variant: 'file-or-url', accept: 'image/*', maxFiles: 1, multiple: false },
				setValue: setThumbnail,
				serializePatch: (row, value) => ({ thumbnail: setThumbnail(row, value).thumbnail })
			},
			filterFn
		},
		{
			accessorKey: 'configuration',
			header: 'Configuration',
			size: 240,
			meta: { cell: { variant: 'json-yaml' } },
			filterFn
		},
		{
			accessorKey: 'isPublished',
			header: 'Published',
			meta: { cell: { variant: 'checkbox' } },
			filterFn
		},
		{
			accessorKey: 'isPublic',
			header: 'Public',
			meta: { cell: { variant: 'checkbox' } },
			filterFn
		},
		{
			accessorKey: 'permissions',
			header: 'Permissions',
			size: 120,
			meta: {
				cell: { variant: 'relation-follow', url: '/edit/stories/{row}/permissions' },
				readOnly: true
			},
			filterFn
		},
		{
			id: 'assets',
			accessorFn: () => 'Open',
			header: 'Assets',
			size: 90,
			meta: {
				cell: { variant: 'relation-follow', url: '/edit/stories/{row}/assets' },
				readOnly: true
			},
			filterFn
		},
		{
			id: 'flow',
			accessorFn: () => 'Edit',
			header: 'Flow',
			size: 80,
			meta: {
				cell: { variant: 'relation-follow', url: '/edit/stories/{row}/flow' },
				readOnly: true
			},
			filterFn
		},
		{
			id: 'url',
			accessorFn: (row) => `/s/${row.slug}`,
			header: 'Story URL',
			size: 220,
			meta: { cell: { variant: 'relation-follow', url: '/s/{slug}' }, readOnly: true },
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
		persistence: createDataGridPersistenceIdentity('edit.stories', () => data),
		getRowId: (row) => row.id,
		endpoint,
		defaultRow: () => ({
			slug: crypto.randomUUID().slice(0, 8),
			name: { en: 'New story' },
			defaultBackgroundColor: null,
			thumbnail: null,
			configuration: null,
			isPublished: false,
			isPublic: true
		}),
		onDataChange: (nextRows) => (rows = nextRows),
		onFilesUpload: async ({ files, columnId, rowId }) =>
			uploadMedia({
				collection: MediaCollection.clients,
				files,
				rowId,
				columnId
			}),
		onDownload: true,
		enableSearch: true,
		enablePaste: true,
		initialState: {
			sorting: [{ id: 'updatedAt', desc: true }],
			columnVisibility: {
				id: false,
				clientId: false,
				createdAt: false,
				createdBy: false,
				thumbnail: false,
				configuration: false
			},
			columnPinning: { left: ['select-row'] }
		}
	} as const);

	const { table, ...dataGridProps } = dataGrid;
	const showLanguageMenu = $derived(hasTranslatableFields(columns));
</script>

<svelte:head><title>Edit stories</title></svelte:head>

<Header>
	<BreadcrumbMenu
		menus={[
			[
				{ label: 'Anthologies', url: '/edit/anthologies' },
				{ isTrigger: true, label: 'Stories', url: '/edit/stories' }
			]
		]}
	/>
</Header>

<div class="mx-auto mt-4 w-full max-w-6xl space-y-4 px-4">
	<DataGridToolbar {table} enableSearch={!!dataGridProps.searchState}>
		{#snippet actions()}
			<div class="ml-auto flex items-center gap-2">
				<DataGridUploadMenu
					endpoint="{endpoint}/io"
					description="Upload story .YAMLs with their parts, assets, and logic."
					maxFileSize={50 * MEGABYTE}
					maxFiles={50}
					onSuccess={invalidateAll}
				/>
				{#if showLanguageMenu}<DataGridLanguageSelectMenu />{/if}
			</div>
		{/snippet}
	</DataGridToolbar>
	<DataGrid {...dataGridProps} {table} height={gridHeight} />
</div>
