<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import DemoCards from '$lib/components/app/demo-cards.svelte';
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
	import type { ColumnDef } from '$lib/components/data-grid/data-grid-table.js';
	import DataGridUploadMenu from '$lib/components/data-grid/data-grid-upload-menu.svelte';
	import { AvatarMedia } from '$lib/components/ui/avatar-media/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import BreadcrumbMenu from '$lib/components/ui/breadcrumb-menu/breadcrumb-menu.svelte';
	import { MEGABYTE } from '$lib/components/ui/file-drop-zone';
	import { MediaFile } from '$lib/components/ui/media-file';
	import { renderComponent } from '$lib/components/ui/table-tanstack/index.js';
	import {
		MediaCollection,
		translateLocalizedField,
		translateLocalizedMediaField,
		type Media
	} from '$lib/db/schemas/0-utils.js';
	import { useWindowSize } from '$lib/hooks/use-window-size.svelte';
	import { UI } from '$lib/states/ui.svelte';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import ChartIcon from '@lucide/svelte/icons/chart-no-axes-combined';
	import ImageUpIcon from '@lucide/svelte/icons/image-up';
	import SquarePenIcon from '@lucide/svelte/icons/square-pen';
	import UserShieldIcon from '@lucide/svelte/icons/user-shield';
	import CreateStoryMenu from './CreateStoryMenu.svelte';

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
			id: 'flow',
			accessorFn: () => 'Edit',
			header: 'Flow',
			size: 60,
			meta: {
				cell: {
					variant: 'relation-follow',
					url: '/edit/stories/{row}/flow',
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
					url: '/edit/stories/{row}/permissions',
					icon: UserShieldIcon
				},
				readOnly: true
			},
			filterFn
		},
		{
			id: 'assets',
			accessorFn: () => 'Open',
			header: 'Assets',
			size: 60,
			meta: {
				cell: {
					variant: 'relation-follow',
					url: '/edit/stories/{row}/assets',
					icon: ImageUpIcon
				},
				readOnly: true
			},
			filterFn
		},
		{
			id: 'analytics',
			accessorFn: () => 'View',
			header: 'Analytics',
			size: 60,
			meta: {
				cell: {
					variant: 'relation-follow',
					url: '/edit/stories/{row}/analytics',
					icon: ChartIcon
				},
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
			accessorKey: 'name',
			header: 'Name',
			meta: { cell: { variant: 'text-translated-short' } },
			filterFn
		},
		// {
		// 	accessorKey: 'defaultBackgroundColor',
		// 	header: 'Background color',
		// 	meta: { cell: { variant: 'text-short' } },
		// 	filterFn
		// },
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
			meta: { cell: { variant: 'checkbox' }, readOnly: true },
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
		onRowAdd: false,
		defaultRow: () => ({
			slug: crypto.randomUUID().slice(0, 8),
			name: { en: 'New story' },
			defaultBackgroundColor: null,
			thumbnail: null,
			configuration: null,
			isPublished: true,
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
			columnPinning: { start: ['select-row'], end: [] }
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
	<CreateStoryMenu />
</Header>

<div class="mx-auto mt-4 w-full max-w-6xl space-y-4 px-4">
	<DemoCards kind="stories" />
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
	<DataGrid
		{...dataGridProps}
		{table}
		height={gridHeight}
		display="grid"
		cardFields={['name', 'slug', 'isPublished', 'isPublic']}
	>
		{#snippet card(story, fields)}
			{@const thumbnail = translateLocalizedMediaField(story.thumbnail, UI.language)}
			<a
				href={resolve(`/edit/stories/${story.id}/flow`)}
				aria-label={`Edit flow: ${translateLocalizedField(story.name, UI.language) || 'Untitled story'}`}
				class="block focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
			>
				<div class="relative grid aspect-video place-items-center overflow-hidden bg-muted">
					{#if thumbnail}
						<MediaFile
							src={thumbnail}
							class="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-xl"
						/>
						<MediaFile src={thumbnail} class="relative h-full w-full object-contain" />
					{:else}
						<BookOpenIcon class="size-10 text-muted-foreground/60" />
					{/if}
				</div>
			</a>
			{@render fields()}
			<div
				class="flex flex-wrap gap-x-3 gap-y-2 border-t px-3 py-2 text-xs text-muted-foreground [&>a]:hover:text-foreground"
			>
				<a href={resolve(`/edit/stories/${story.id}/permissions`)}>Permissions</a>
				<a href={resolve(`/edit/stories/${story.id}/assets`)}>Assets</a>
				<a href={resolve(`/edit/stories/${story.id}/analytics`)}>Analytics</a>
				<a href={resolve(`/s/${story.slug}`)}>View story</a>
			</div>
			<div
				class="flex flex-wrap items-center gap-x-1 gap-y-2 border-t px-3 py-2 text-xs text-muted-foreground [&>a]:hover:text-foreground [&>a]:hover:underline"
			>
				<span>Last updated at {story.updatedAt.toLocaleString()} by </span>
				<Badge variant="secondary" class="h-5 gap-1 px-1.5 text-xs">
					<AvatarMedia src={story.updatedBy?.image} class="size-4 rounded-full border" />
					<span class="max-w-32 truncate">{story.updatedBy?.label}</span>
				</Badge>
			</div>
		{/snippet}
	</DataGrid>
</div>
