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
	import { AnthologyPermissionRole } from '$lib/db/schemas/2-story-module';
	import { useDataGrid } from '$lib/hooks/use-custom-data-grid.svelte';
	import { useWindowSize } from '$lib/hooks/use-window-size.svelte';
	import type { ColumnDef } from '@tanstack/table-core';

	let { data } = $props();
	const anthology = $derived(data.anthology);

	let rows = $derived(data.permissions.map((permission) => ({ ...permission, anthology })));
	type Row = (typeof rows)[number];

	const relations = $derived(data.relations);
	const userOptions = () =>
		relations.users.map((user) => ({
			title: user.name ?? user.email ?? '?',
			value: user.id
		}));
	const roleOptions = () =>
		Object.values(AnthologyPermissionRole).map((role) => ({
			title: role,
			value: role
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
			id: 'userId',
			accessorFn: (row) => row.userId,
			header: 'User',
			meta: {
				cell: {
					variant: 'relation-select-single',
					options: userOptions()
				}
			},
			filterFn
		},
		{
			accessorKey: 'role',
			header: 'Role',
			meta: { cell: { variant: 'select-single', options: roleOptions() } },
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
		endpoint: `/api/anthologies/${page.params.anthologyId}/permissions`,
		onDataChange: (nextRows) => (rows = nextRows),
		enableSearch: true,
		enablePaste: true,
		initialState: {
			sorting: [{ id: 'id', desc: false }],
			columnVisibility: { id: false },
			columnPinning: { left: ['select-row'] }
		}
	} as const);

	const { table, ...dataGridProps } = dataGrid;
</script>

<Header class="mx-auto w-full max-w-6xl">
	<BreadcrumbMenu
		menus={[
			[
				{ isTrigger: true, label: 'Anthologies', url: `/edit/anthologies` },
				{ label: 'Stories', url: `/edit/stories` }
			],
			[
				{
					isTrigger: true,
					label: 'Permissions',
					url: `/edit/anthologies/${page.params.anthologyId}/permissions`
				}
			]
		]}
	/>
</Header>

<div class="mx-auto w-full max-w-6xl space-y-4 px-4">
	<Item.Root variant="outline">
		<Item.Content>
			<Item.Title class="line-clamp-1">{anthology.name ?? anthology.reference}</Item.Title>
			<Item.Description class="line-clamp-1">{anthology.reference}</Item.Description>
		</Item.Content>
	</Item.Root>

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
