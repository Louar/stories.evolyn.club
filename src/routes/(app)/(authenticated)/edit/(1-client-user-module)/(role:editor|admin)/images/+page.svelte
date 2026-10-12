<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Header from '$lib/components/app/header/app-header.svelte';
	import {
		createDataGridPersistenceIdentity,
		createEndpointDataGridAdapter,
		DataGrid,
		DataGridToolbar,
		getFilterFn,
		RowSelectHeader,
		useDataGrid
	} from '$lib/components/data-grid';
	import type { ColumnDef } from '$lib/components/data-grid/data-grid-table.js';
	import { AvatarMedia } from '$lib/components/ui/avatar-media/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import BreadcrumbMenu from '$lib/components/ui/breadcrumb-menu/breadcrumb-menu.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { displaySize } from '$lib/components/ui/file-drop-zone';
	import { renderComponent } from '$lib/components/ui/table-tanstack/index.js';
	import { MediaCollection } from '$lib/db/schemas/0-utils.js';
	import { useWindowSize } from '$lib/hooks/use-window-size.svelte';
	import ImageIcon from '@lucide/svelte/icons/image';
	import ReplaceIcon from '@lucide/svelte/icons/replace';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import { toast } from 'svelte-sonner';

	let { data } = $props();
	let rows = $derived(data.images);
	type Row = (typeof rows)[number];

	const endpoint = '/api/clients/media';
	const filterFn = getFilterFn<Row>();
	const windowSize = useWindowSize({ defaultHeight: 800 });
	const gridHeight = $derived(Math.max(250, windowSize.height - 180));
	let display = $state<'table' | 'grid'>('grid');
	let uploadInput = $state<HTMLInputElement | null>(null);
	let replacementInput = $state<HTMLInputElement | null>(null);
	let replacementRow = $state<Row | null>(null);
	const updatedAtFormatter = new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short'
	});

	const mediaValue = (row: Row) => ({
		id: row.id,
		collection: MediaCollection.clients,
		filename: row.name
	});

	async function readError(response: Response, fallback: string) {
		const body = await response.json().catch(() => null);
		return body?.message ?? fallback;
	}

	async function uploadImages(files: File[]) {
		if (!files.length) return;
		let uploaded = 0;
		for (const file of files) {
			const formData = new FormData();
			formData.set('file', file);
			const response = await fetch(endpoint, { method: 'POST', body: formData });
			if (!response.ok) {
				toast.error(await readError(response, `Failed to upload ${file.name}`));
				continue;
			}
			uploaded++;
		}
		if (uploaded) {
			toast.success(`Uploaded ${uploaded} image${uploaded === 1 ? '' : 's'}`);
			await invalidateAll();
		}
	}

	async function replaceImage(file: File | undefined) {
		const row = replacementRow;
		replacementRow = null;
		if (!file || !row) return;
		const formData = new FormData();
		formData.set('file', file);
		const response = await fetch(`${endpoint}/${encodeURIComponent(row.id)}`, {
			method: 'PUT',
			body: formData
		});
		if (!response.ok) {
			toast.error(await readError(response, `Failed to replace ${row.name}`));
			return;
		}
		toast.success('Image replaced');
		await invalidateAll();
	}

	function requestReplacement(row: Row) {
		replacementRow = row;
		replacementInput?.click();
	}

	function formatUpdatedAt(value: Row['updatedAt']) {
		return updatedAtFormatter.format(new Date(value));
	}

	function userFallback(label: string | null | undefined) {
		return label?.trim()?.[0]?.toUpperCase() ?? '?';
	}

	const columns: ColumnDef<Row, unknown>[] = [
		{
			id: 'select-row',
			size: 40,
			enableSorting: false,
			enableHiding: false,
			enableResizing: false,
			header: ({ table }) => renderComponent(RowSelectHeader, { table }),
			meta: { cell: { variant: 'row-select' }, description: 'Select this image.' }
		},
		{
			id: 'image',
			header: 'Image',
			accessorFn: mediaValue,
			cell: ({ row }) => [mediaValue(row.original)],
			meta: {
				cell: { variant: 'file', accept: 'image/*', maxFiles: 1, multiple: false },
				description: 'Preview of the client image.',
				readOnly: true
			}
		},
		{
			accessorKey: 'name',
			header: 'Filename',
			meta: {
				cell: { variant: 'text-short' },
				description: 'Stored image filename.',
				readOnly: true
			},
			filterFn
		},
		{
			accessorKey: 'description',
			header: 'Description',
			meta: { cell: { variant: 'text-short' }, description: 'Searchable image description.' },
			filterFn
		},
		{
			accessorKey: 'size',
			header: 'Bytes',
			meta: { cell: { variant: 'number' }, description: 'Image size in bytes.', readOnly: true },
			filterFn
		},
		{
			id: 'actions',
			header: 'Actions',
			size: 60,
			enableSorting: false,
			enableHiding: false,
			meta: {
				cell: {
					variant: 'actions',
					actions: [{ label: 'Replace image', icon: ReplaceIcon, onSelect: requestReplacement }]
				},
				description: 'Actions available for the image.',
				readOnly: true,
				navigable: false
			}
		},
		{
			accessorKey: 'updatedAt',
			header: 'Updated at',
			meta: {
				cell: { variant: 'date-time' },
				description: 'When the image was last changed.',
				readOnly: true
			},
			filterFn
		},
		{
			accessorKey: 'updatedBy',
			header: 'Updated by',
			meta: {
				cell: { variant: 'badge-item' },
				description: 'Who last updated the image.',
				readOnly: true
			},
			filterFn
		}
	];

	const endpointAdapter = createEndpointDataGridAdapter<Row>(endpoint);
	const dataGrid = useDataGrid<Row>({
		columns,
		data: () => rows,
		persistence: createDataGridPersistenceIdentity('edit.images', () => data),
		getRowId: (row) => row.id,
		dataAdapter: {
			...endpointAdapter,
			async delete({ rowId, force }) {
				const query = force ? '?force=true' : '';
				const response = await fetch(`${endpoint}/${encodeURIComponent(rowId)}${query}`, {
					method: 'DELETE'
				});
				return response.ok;
			}
		},
		deleteConfirmation: {
			itemLabel: { singular: 'image', plural: 'images' },
			description: (rowCount) =>
				`This permanently deletes ${rowCount === 1 ? 'the selected image' : `the ${rowCount} selected images`}. Referenced images are protected unless you select force deletion below.`,
			force: {
				label: 'Force delete referenced images',
				description: 'Clear every use of the selected images before permanently deleting the files.'
			}
		},
		onDataChange: (nextRows) => (rows = nextRows),
		enableSearch: true,
		initialState: {
			sorting: [{ id: 'updatedAt', desc: true }],
			columnVisibility: { image: false },
			columnPinning: { start: ['select-row'], end: ['actions'] }
		}
	} as const);

	const { table, ...dataGridProps } = dataGrid;
</script>

<svelte:head><title>Images</title></svelte:head>

<Header>
	<BreadcrumbMenu menus={[[{ isTrigger: true, label: 'Images', url: '/edit/images' }]]} />
</Header>

<div class="mx-auto mt-4 w-full max-w-6xl space-y-4 px-4">
	<DataGridToolbar {table} enableSearch={!!dataGridProps.searchState}>
		{#snippet actions()}
			<Button class="ml-auto" size="sm" onclick={() => uploadInput?.click()}>
				<UploadIcon />Upload images
			</Button>
		{/snippet}
	</DataGridToolbar>

	<DataGrid
		{...dataGridProps}
		{table}
		bind:display
		cardFields={['description']}
		height={gridHeight}
	>
		{#snippet card(row, fields)}
			<div class="relative aspect-video overflow-hidden bg-muted">
				<img
					src={`/api/media/${MediaCollection.clients}/${encodeURIComponent(row.name)}`}
					alt={row.description || row.name}
					class="size-full object-contain"
				/>
				<Button
					class="absolute top-2 right-2 z-10 h-7 gap-1 px-2 text-xs"
					size="sm"
					variant="outline"
					onclick={() => requestReplacement(row)}
				>
					<ReplaceIcon class="size-3.5" />
					Replace
				</Button>
			</div>
			<div class="flex items-center gap-2 border-b px-3 py-2">
				<ImageIcon class="size-4 shrink-0 text-muted-foreground" />
				<span
					class="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground uppercase"
				>
					{row.extension}
				</span>
				<span class="ml-auto text-xs text-muted-foreground">{displaySize(row.size)}</span>
			</div>
			{@render fields()}
			<div class="flex items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
				<span class="line-clamp-2">Updated {formatUpdatedAt(row.updatedAt)}</span>
				{#if row.updatedBy}
					{@const label = row.updatedBy.label ?? '?'}
					<Badge
						href={`/edit/users/${encodeURIComponent(row.updatedBy.id)}/activities`}
						variant="secondary"
						class="h-5 gap-1 px-1.5 text-xs"
					>
						<AvatarMedia
							src={row.updatedBy.image}
							fallback={userFallback(label)}
							class="size-4 rounded-full border"
						/>
						<span class="max-w-32 truncate">{label}</span>
					</Badge>
				{/if}
			</div>
		{/snippet}
	</DataGrid>
</div>

<input
	{@attach (element) => {
		uploadInput = element;
		return () => (uploadInput = null);
	}}
	type="file"
	accept="image/*"
	multiple
	class="sr-only"
	onchange={(event) => {
		uploadImages(Array.from(event.currentTarget.files ?? []));
		event.currentTarget.value = '';
	}}
/>
<input
	{@attach (element) => {
		replacementInput = element;
		return () => (replacementInput = null);
	}}
	type="file"
	accept={replacementRow ? `.${replacementRow.extension}` : 'image/*'}
	class="sr-only"
	onchange={(event) => {
		replaceImage(event.currentTarget.files?.[0]);
		event.currentTarget.value = '';
	}}
/>
