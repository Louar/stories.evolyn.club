<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Header from '$lib/components/app/header/app-header.svelte';
	import {
		createDataGridPersistenceIdentity,
		createEndpointDataGridAdapter,
		DataGrid,
		DataGridAdapterError,
		DataGridToolbar,
		getFilterFn,
		hasTranslatableFields,
		RowSelectHeader,
		useDataGrid,
		type DataGridDataAdapter,
		type DataGridDeleteResult
	} from '$lib/components/data-grid';
	import DataGridLanguageSelectMenu from '$lib/components/data-grid/data-grid-language-select-menu.svelte';
	import DataGridUploadMenu from '$lib/components/data-grid/data-grid-upload-menu.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import BreadcrumbMenu from '$lib/components/ui/breadcrumb-menu/breadcrumb-menu.svelte';
	import { Switch } from '$lib/components/ui/switch';
	import { MEGABYTE } from '$lib/components/ui/file-drop-zone';
	import { renderComponent } from '$lib/components/ui/table-tanstack/index.js';
	import { useWindowSize } from '$lib/hooks/use-window-size.svelte';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import type { ColumnDef } from '@tanstack/table-core';

	let { data } = $props();
	const endpoint = '/api/anthologies';
	let rows = $derived(data.anthologies);
	type Row = (typeof rows)[number];
	type PendingDelete = {
		rows: Row[];
		resolve: (result: DataGridDeleteResult | boolean) => void;
	};

	let includeStoryDefinitions = $state(false);
	let isDeleteDialogOpen = $state(false);
	let isDeleting = $state(false);
	let pendingDelete = $state.raw<PendingDelete | null>(null);
	const filterFn = getFilterFn<Row>();
	const windowSize = useWindowSize({ defaultHeight: 800 });
	const gridHeight = $derived(Math.max(250, windowSize.height - 150));

	const download = async (rowId: string) => {
		const response = await fetch(
			`${endpoint}/${encodeURIComponent(rowId)}/io${includeStoryDefinitions ? '?includeStories=true' : ''}`
		);
		if (!response.ok)
			throw new DataGridAdapterError('Failed to download anthology', response.status);
		const disposition = response.headers.get('content-disposition') ?? '';
		const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? `anthology-${rowId}.yaml`;
		const url = URL.createObjectURL(await response.blob());
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = filename;
		anchor.click();
		URL.revokeObjectURL(url);
	};

	const defaultAdapter = createEndpointDataGridAdapter<Row>(endpoint);
	const dataAdapter: DataGridDataAdapter<Row> = {
		...defaultAdapter,
		download: async ({ rowIds }) => {
			for (const rowId of rowIds) await download(rowId);
		}
	};

	const requestRowsDelete = (selectedRows: Row[]) =>
		new Promise<DataGridDeleteResult | boolean>((resolve) => {
			pendingDelete = { rows: selectedRows, resolve };
			isDeleteDialogOpen = true;
		});

	const finishDelete = (result: DataGridDeleteResult | boolean) => {
		const request = pendingDelete;
		pendingDelete = null;
		isDeleteDialogOpen = false;
		request?.resolve(result);
	};
	const cancelDelete = () => finishDelete({ deletedRowIds: [], failedRowIds: [] });

	const deleteRows = async (deleteStories: boolean) => {
		const request = pendingDelete;
		if (!request || isDeleting) return;
		isDeleting = true;
		const deletedRowIds: string[] = [];
		const failedRowIds: string[] = [];
		try {
			for (const row of request.rows) {
				try {
					const response = await fetch(
						`${endpoint}/${encodeURIComponent(row.id)}${deleteStories ? '?deleteStories=true' : ''}`,
						{ method: 'DELETE' }
					);
					(response.ok ? deletedRowIds : failedRowIds).push(row.id);
				} catch {
					failedRowIds.push(row.id);
				}
			}
			const deletedIds = new Set(deletedRowIds);
			rows = rows.filter((row) => !deletedIds.has(row.id));
			finishDelete({ deletedRowIds, failedRowIds });
		} finally {
			isDeleting = false;
		}
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
			accessorKey: 'nameRaw',
			header: 'Name',
			meta: { cell: { variant: 'text-translated-short' } },
			filterFn
		},
		{
			accessorKey: 'configuration',
			header: 'Configuration',
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
			id: 'stories',
			accessorFn: (row) => row.positions.length,
			header: 'Stories',
			size: 100,
			meta: {
				cell: { variant: 'relation-follow', url: '/edit/anthologies/{row}/stories' },
				readOnly: true
			},
			filterFn
		},
		{
			accessorKey: 'permissions',
			header: 'Permissions',
			size: 120,
			meta: {
				cell: { variant: 'relation-follow', url: '/edit/anthologies/{row}/permissions' },
				readOnly: true
			},
			filterFn
		},
		{
			id: 'url',
			accessorFn: (row) => `/a/${row.slug}/grid`,
			header: 'Anthology URL',
			size: 220,
			meta: { cell: { variant: 'relation-follow', url: '/a/{slug}/grid' }, readOnly: true },
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
		persistence: createDataGridPersistenceIdentity('edit.anthologies', () => data),
		getRowId: (row) => row.id,
		dataAdapter,
		defaultRow: () => ({
			slug: crypto.randomUUID().slice(0, 8),
			nameRaw: { en: 'New anthology' },
			configuration: null,
			isPublished: false,
			isPublic: true,
			positions: []
		}),
		onRowsDelete: requestRowsDelete,
		onDataChange: (nextRows) => (rows = nextRows),
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
				configuration: false
			},
			columnPinning: { left: ['select-row'] }
		}
	} as const);

	const { table, ...dataGridProps } = dataGrid;
	const showLanguageMenu = $derived(hasTranslatableFields(columns));
</script>

<svelte:head><title>Edit anthologies</title></svelte:head>

<Header>
	<BreadcrumbMenu
		menus={[
			[
				{ isTrigger: true, label: 'Anthologies', url: '/edit/anthologies' },
				{ label: 'Stories', url: '/edit/stories' }
			]
		]}
	/>
</Header>

<AlertDialog.Root
	bind:open={isDeleteDialogOpen}
	onOpenChange={(open) => {
		if (!open && !isDeleting && pendingDelete) cancelDelete();
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Media><TrashIcon class="text-destructive" /></AlertDialog.Media>
			<AlertDialog.Title>Delete selected anthologies?</AlertDialog.Title>
			<AlertDialog.Description>
				Choose whether to keep or permanently delete the stories used by the selected
				{pendingDelete?.rows.length === 1 ? 'anthology' : 'anthologies'}.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={isDeleting}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				variant="outline"
				disabled={isDeleting}
				onclick={(event) => {
					event.preventDefault();
					void deleteRows(false);
				}}
			>
				{#if isDeleting}<LoaderCircleIcon class="size-4 animate-spin" />{/if}
				Anthologies only
			</AlertDialog.Action>
			<AlertDialog.Action
				variant="destructive"
				disabled={isDeleting}
				onclick={(event) => {
					event.preventDefault();
					void deleteRows(true);
				}}
			>
				{#if isDeleting}<LoaderCircleIcon class="size-4 animate-spin" />{/if}
				Anthologies and stories
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<div class="mx-auto mt-4 w-full max-w-6xl space-y-4 px-4">
	<DataGridToolbar {table} enableSearch={!!dataGridProps.searchState}>
		{#snippet actions()}
			<div class="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
				<label class="flex items-center gap-2"
					><Switch bind:checked={includeStoryDefinitions} />Include stories</label
				>
				<DataGridUploadMenu
					endpoint="{endpoint}/io"
					description="Upload anthology .YAMLs, optionally with embedded story definitions."
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
