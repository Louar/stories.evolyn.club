<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import DemoCards from '$lib/components/app/demo-cards.svelte';
	import Header from '$lib/components/app/header/app-header.svelte';
	import {
		createDataGridPersistenceIdentity,
		createEndpointDataGridAdapter,
		DataGrid,
		DataGridAdapterError,
		DataGridToolbar,
		fileCellMediaToFileCellData,
		getFilterFn,
		hasTranslatableFields,
		RowSelectHeader,
		uploadMedia,
		useDataGrid,
		type DataGridDataAdapter,
		type DataGridDeleteResult
	} from '$lib/components/data-grid';
	import DataGridLanguageSelectMenu from '$lib/components/data-grid/data-grid-language-select-menu.svelte';
	import type { ColumnDef } from '$lib/components/data-grid/data-grid-table.js';
	import DataGridUploadMenu from '$lib/components/data-grid/data-grid-upload-menu.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { AvatarMedia } from '$lib/components/ui/avatar-media/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import BreadcrumbMenu from '$lib/components/ui/breadcrumb-menu/breadcrumb-menu.svelte';
	import { MEGABYTE } from '$lib/components/ui/file-drop-zone';
	import { MediaFile } from '$lib/components/ui/media-file';
	import { Switch } from '$lib/components/ui/switch';
	import { renderComponent } from '$lib/components/ui/table-tanstack/index.js';
	import {
		MediaCollection,
		translateLocalizedField,
		translateLocalizedMediaField,
		type Media
	} from '$lib/db/schemas/0-utils';
	import { AnthologyVisualization } from '$lib/db/schemas/2-story-module';
	import { useWindowSize } from '$lib/hooks/use-window-size.svelte';
	import { UI } from '$lib/states/ui.svelte';
	import LibraryIcon from '@lucide/svelte/icons/library';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import SquarePenIcon from '@lucide/svelte/icons/square-pen';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import UserShieldIcon from '@lucide/svelte/icons/user-shield';

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
	const visualizationOptions = () => [
		{ title: 'Grid', value: AnthologyVisualization.grid },
		{ title: 'Feed', value: AnthologyVisualization.feed }
	];
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
			accessorKey: 'order',
			header: 'Order',
			meta: { cell: { variant: 'number' } },
			filterFn
		},
		{
			id: 'stories',
			accessorFn: (row) => row.positions.length,
			header: 'Stories',
			size: 60,
			meta: {
				cell: {
					variant: 'relation-follow',
					url: '/edit/anthologies/{row}/stories',
					icon: SquarePenIcon
				},
				readOnly: true
			},
			filterFn
		},
		{
			accessorKey: 'permissions',
			header: 'Permissions',
			size: 60,
			meta: {
				cell: {
					variant: 'relation-follow',
					url: '/edit/anthologies/{row}/permissions',
					icon: UserShieldIcon
				},
				readOnly: true
			},
			filterFn
		},
		{
			id: 'url',
			accessorFn: (row) => `${page.url.host}/${row.slug}`,
			header: 'Anthology URL',
			size: 220,
			meta: { cell: { variant: 'relation-follow', url: `/{slug}` }, readOnly: true },
			filterFn
		},
		{
			accessorKey: 'nameRaw',
			header: 'Name',
			meta: { cell: { variant: 'text-translated-short' } },
			filterFn
		},
		{
			id: 'thumbnail',
			accessorFn: (row) =>
				fileCellMediaToFileCellData(translateLocalizedMediaField(row.thumbnail, UI.language) ?? null),
			header: 'Thumbnail',
			size: 240,
			meta: {
				cell: { variant: 'file-or-url', accept: 'image/*', maxFiles: 1, multiple: false },
				setValue: setThumbnail,
				serializePatch: (row, value) => ({ thumbnail: setThumbnail(row, value).thumbnail })
			},
			filterFn
		},
		{
			accessorKey: 'description',
			header: 'Description',
			meta: { cell: { variant: 'text-translated-long', markdown: true } },
			filterFn
		},
		{
			accessorKey: 'visualization',
			header: 'Visualization',
			meta: { cell: { variant: 'select-single', options: visualizationOptions() } },
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
			nameRaw: { en: 'New anthology' },
			order: null,
			thumbnail: null,
			description: null,
			visualization: AnthologyVisualization.grid,
			configuration: null,
			isPublished: true,
			isPublic: true,
			positions: []
		}),
		onRowsDelete: requestRowsDelete,
		enableDeleteConfirmation: false,
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
				configuration: false,
			},
			columnPinning: { start: ['select-row'], end: [] }
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
	<DemoCards kind="anthologies" />
	<DataGridToolbar {table} enableSearch={!!dataGridProps.searchState}>
		{#snippet actions()}
			<label class="flex items-center gap-2 text-xs text-muted-foreground">
				<Switch bind:checked={includeStoryDefinitions} />Include stories
			</label>
			<div class="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
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
	<DataGrid
		{...dataGridProps}
		{table}
		height={gridHeight}
		display="grid"
		cardFields={['nameRaw', 'slug', 'order', 'description', 'visualization', 'isPublished', 'isPublic']}
	>
		{#snippet card(anthology, fields)}
			{@const thumbnail = translateLocalizedMediaField(anthology.thumbnail, UI.language)}
			<a
				href={resolve(`/edit/anthologies/${anthology.id}/stories`)}
				aria-label={`Edit stories: ${translateLocalizedField(anthology.nameRaw, UI.language) || 'Untitled anthology'}`}
				class="block focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
			>
				<div class="grid aspect-video place-items-center bg-muted">
					{#if thumbnail}
						<MediaFile src={thumbnail} class="h-full w-full object-cover" />
					{:else}
						<LibraryIcon class="size-10 text-muted-foreground/60" />
					{/if}
				</div>
				<div class="p-3">
					<p class="mt-1 text-xs text-muted-foreground">
						{anthology.positions.length}
						{anthology.positions.length === 1 ? 'story' : 'stories'}
					</p>
				</div>
			</a>
			{@render fields()}
			<div
				class="flex flex-wrap gap-3 border-t px-3 py-2 text-xs text-muted-foreground [&>a]:hover:text-foreground [&>a]:hover:underline"
			>
				<a href={resolve(`/edit/anthologies/${anthology.id}/permissions`)}>Permissions</a>
				<a
					href={resolve('/(app)/(public)/(2-story-module)/[anthologySlug]/[...settings]', {
						anthologySlug: anthology.slug,
						settings: ''
					})}>View anthology</a
				>
			</div>
			<div
				class="flex flex-wrap items-center gap-x-1 gap-y-2 border-t px-3 py-2 text-xs text-muted-foreground [&>a]:hover:text-foreground [&>a]:hover:underline"
			>
				<span>Last updated at {anthology.updatedAt.toLocaleString()} by </span>
				<Badge variant="secondary" class="h-5 gap-1 px-1.5 text-xs">
					<AvatarMedia src={anthology.updatedBy?.image} class="size-4 rounded-full border" />
					<span class="max-w-32 truncate">{anthology.updatedBy?.label}</span>
				</Badge>
			</div>
		{/snippet}
	</DataGrid>
</div>
