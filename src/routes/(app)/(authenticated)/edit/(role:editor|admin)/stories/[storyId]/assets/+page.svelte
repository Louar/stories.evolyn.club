<script lang="ts">
	import { page } from '$app/state';
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
	import * as Item from '$lib/components/ui/item/index.js';
	import { renderComponent } from '$lib/components/ui/table-tanstack/index.js';
	import { useDataGrid } from '$lib/hooks/use-custom-data-grid.svelte';
	import { useWindowSize } from '$lib/hooks/use-window-size.svelte';
	import type { ColumnDef } from '@tanstack/table-core';
	import { toast } from 'svelte-sonner';
	import type { AssetRow } from './+page.server.js';

	let { data } = $props();
	const story = $derived(data.story);
	const assets = $derived(data.assets);
	const relations = $derived(data.relations);

	let videoRows = $derived(assets.videos);
	let announcementRows = $derived(assets.announcements);
	let quizRows = $derived(assets.quizzes);

	const endpoint = `/api/stories/${page.params.storyId}/assets`;
	const filterFn = getFilterFn<AssetRow>();
	const windowSize = useWindowSize({ defaultHeight: 800 });
	const gridHeight = $derived(Math.min(400, windowSize.height - 200));

	const videoOptions = () =>
		relations.allAvailableVideos.map((asset) => ({
			title: asset.title ?? '?',
			summary: asset.summary,
			value: asset.asset
		}));
	const announcementOptions = () =>
		relations.allAvailableAnnouncementTemplates.map((asset) => ({
			title: asset.title ?? '?',
			summary: asset.summary,
			value: asset.asset
		}));
	const quizOptions = () =>
		relations.allAvailableQuizTemplates.map((asset) => ({
			title: asset.title ?? '?',
			summary: asset.summary,
			value: asset.asset
		}));

	const columns: ColumnDef<AssetRow, unknown>[] = [
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
			id: 'type',
			accessorKey: 'type',
			header: 'Type',
			meta: { cell: { variant: 'relation-follow' }, readOnly: true }
		},
		{
			id: 'asset',
			accessorKey: 'asset',
			header: 'Asset',
			size: 240,
			meta: { cell: { variant: 'relation-select-single', options: [] } },
			filterFn
		}
	];

	const createGrid = (rows: () => AssetRow[], type: 'video' | 'announcement' | 'quiz') =>
		useDataGrid<AssetRow>({
			columns: columns.map((column) => {
				if (column.id === 'asset') {
					if (type === 'video') {
						return {
							...column,
							meta: {
								cell: { variant: 'relation-select-single', options: videoOptions() }
							}
						};
					} else if (type === 'announcement') {
						return {
							...column,
							meta: {
								cell: { variant: 'relation-select-single', options: announcementOptions() }
							}
						};
					} else {
						return {
							...column,
							meta: {
								cell: { variant: 'relation-select-single', options: quizOptions() }
							}
						};
					}
				}
				return column;
			}),
			data: rows,
			getRowId: (row) => row.id,
			endpoint,
			onDataChange: (nextRows) => {
				if (type === 'video') videoRows = nextRows as Extract<AssetRow, { type: 'video' }>[];
				else if (type === 'announcement')
					announcementRows = nextRows as Extract<AssetRow, { type: 'announcement' }>[];
				else if (type === 'quiz') quizRows = nextRows as Extract<AssetRow, { type: 'quiz' }>[];
			},
			onRowAdd: () => {
				let newrow = { type };
				if (type === 'video')
					videoRows = [...videoRows, newrow] as Extract<AssetRow, { type: 'video' }>[];
				else if (type === 'announcement')
					announcementRows = [...announcementRows, newrow] as Extract<
						AssetRow,
						{ type: 'anouncement' }
					>[];
				else if (type === 'quiz')
					quizRows = [...quizRows, newrow] as Extract<AssetRow, { type: 'quiz' }>[];
			},

			onRowsDelete: async (removedrows: AssetRow[], rowIndices: number[]) => {
				const toRemove = Array.from(
					new Set(removedrows.map((row) => row.id).filter((id): id is string => Boolean(id)))
				);

				const wereRemoved = (
					await Promise.all(
						removedrows.map(async (row) => {
							const res = await fetch(`${endpoint}`, {
								method: 'DELETE',
								body: JSON.stringify({ type, asset: row.asset })
							});
							return res.ok ? row.id : undefined;
						})
					)
				).filter((id): id is string => id !== undefined);

				if (toRemove.length !== wereRemoved.length)
					toast.error(`Some rows were not removed`, {
						closeButton: true,
						duration: Infinity
					});

				if (type === 'video') {
					videoRows = videoRows.filter((row, index) =>
						row.id ? !wereRemoved.includes(row.id) : !rowIndices.includes(index)
					);
				} else if (type === 'announcement') {
					announcementRows = announcementRows.filter((row, index) =>
						row.id ? !wereRemoved.includes(row.id) : !rowIndices.includes(index)
					);
				} else if (type === 'quiz') {
					quizRows = quizRows.filter((row, index) =>
						row.id ? !wereRemoved.includes(row.id) : !rowIndices.includes(index)
					);
				}
			},
			enableSearch: true,
			initialState: {
				sorting: [{ id: 'id', desc: false }],
				columnVisibility: { id: false, type: false },
				columnPinning: { left: ['select-row'] }
			}
		} as const);

	const videoGrid = createGrid(() => videoRows, 'video');
	const announcementGrid = createGrid(() => announcementRows, 'announcement');
	const quizGrid = createGrid(() => quizRows, 'quiz');
</script>

<Header class="mx-auto w-full max-w-6xl">
	<BreadcrumbMenu
		menus={[
			[
				{ label: 'Anthologies', url: `/edit/anthologies` },
				{ isTrigger: true, label: 'Stories', url: `/edit/stories` }
			],
			[
				{ label: 'Permissions', url: `/edit/stories/${page.params.storyId}/permissions` },
				{ isTrigger: true, label: 'Assets', url: `/edit/stories/${page.params.storyId}/assets` },
				{ label: 'Flow', url: `/edit/stories/${page.params.storyId}/flow` }
			]
		]}
	/>
</Header>

<div class="mx-auto w-full max-w-6xl space-y-6 px-4 pb-10">
	<Item.Root variant="outline">
		<Item.Content>
			<Item.Title class="line-clamp-1">{story.name ?? story.reference}</Item.Title>
			<Item.Description class="line-clamp-1">{story.reference}</Item.Description>
		</Item.Content>
	</Item.Root>

	<section class="space-y-3">
		<h2 class="text-lg font-semibold">Videos</h2>
		<div role="toolbar" aria-orientation="horizontal" class="flex items-center justify-between">
			<DataGridKeyboardShortcuts enableSearch={!!videoGrid.searchState} />
			<div class="flex w-full items-center gap-1">
				<DataGridFilterMenu table={videoGrid.table} />
				<DataGridSortMenu table={videoGrid.table} />
				<DataGridRowHeightMenu table={videoGrid.table} />
				<DataGridViewMenu table={videoGrid.table} />
			</div>
		</div>
		<DataGrid {...videoGrid} height={gridHeight} />
	</section>

	<section class="space-y-3">
		<h2 class="text-lg font-semibold">Announcements</h2>
		<div role="toolbar" aria-orientation="horizontal" class="flex items-center justify-between">
			<DataGridKeyboardShortcuts enableSearch={!!announcementGrid.searchState} />
			<div class="flex w-full items-center gap-1">
				<DataGridFilterMenu table={announcementGrid.table} />
				<DataGridSortMenu table={announcementGrid.table} />
				<DataGridRowHeightMenu table={announcementGrid.table} />
				<DataGridViewMenu table={announcementGrid.table} />
			</div>
		</div>
		<DataGrid {...announcementGrid} height={gridHeight} />
	</section>

	<section class="space-y-3">
		<h2 class="text-lg font-semibold">Quizzes</h2>
		<div role="toolbar" aria-orientation="horizontal" class="flex items-center justify-between">
			<DataGridKeyboardShortcuts enableSearch={!!quizGrid.searchState} />
			<div class="flex w-full items-center gap-1">
				<DataGridFilterMenu table={quizGrid.table} />
				<DataGridSortMenu table={quizGrid.table} />
				<DataGridRowHeightMenu table={quizGrid.table} />
				<DataGridViewMenu table={quizGrid.table} />
			</div>
		</div>
		<DataGrid {...quizGrid} height={gridHeight} />
	</section>
</div>
