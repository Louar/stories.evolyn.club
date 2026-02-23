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
	import BreadcrumbMenu from '$lib/components/ui/breadcrumb-menu/breadcrumb-menu.svelte';
	import { renderComponent } from '$lib/components/ui/table-tanstack/index.js';
	import { Language, MediaCollection } from '$lib/db/schemas/0-utils.js';
	import { UserRole } from '$lib/db/schemas/1-client-user-module.js';
	import {
		fileCellMediaToFileCellData,
		uploadMedia,
		useDataGrid
	} from '$lib/hooks/use-custom-data-grid.svelte';
	import { useWindowSize } from '$lib/hooks/use-window-size.svelte';
	import type { ColumnDef } from '@tanstack/table-core';

	let { data } = $props();

	let rows = $derived(data.users);
	type Row = (typeof rows)[number];

	const filterFn = getFilterFn<Row>();
	const windowSize = useWindowSize({ defaultHeight: 800 });
	const gridHeight = $derived(Math.max(250, windowSize.height - 150));

	const roleOptions = () =>
		Object.values(UserRole).map((role) => ({
			title: role,
			value: role
		}));

	const languageOptions = () =>
		Object.values(Language).map((language) => ({
			title: language,
			value: language
		}));

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
		{
			accessorKey: 'email',
			header: 'Email',
			meta: { cell: { variant: 'text-short' } },
			filterFn
		},
		{
			accessorKey: 'firstName',
			header: 'First name',
			meta: { cell: { variant: 'text-short' } },
			filterFn
		},
		{
			accessorKey: 'lastName',
			header: 'Last name',
			meta: { cell: { variant: 'text-short' } },
			filterFn
		},
		{
			accessorKey: 'picture',
			header: 'Picture',
			cell: ({ row }) => fileCellMediaToFileCellData(row.original.picture),
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
			accessorKey: 'password',
			header: 'Password',
			meta: { cell: { variant: 'text-short' } },
			filterFn
		},
		{
			accessorKey: 'roles',
			header: 'Roles',
			size: 230,
			meta: { cell: { variant: 'select-multiple', options: roleOptions() } },
			filterFn
		},
		{
			accessorKey: 'language',
			header: 'Language',
			meta: { cell: { variant: 'select-single', options: languageOptions() } },
			filterFn
		},
		{
			accessorKey: 'pronouns',
			header: 'Pronouns',
			meta: { cell: { variant: 'text-short' } },
			filterFn
		},
		{
			accessorKey: 'address',
			header: 'Address',
			meta: { cell: { variant: 'json-yaml' } },
			filterFn
		},
		{
			accessorKey: 'dateOfBirth',
			header: 'Date of birth',
			meta: { cell: { variant: 'date' } },
			filterFn
		},
		{
			accessorKey: 'emailConfirmed',
			header: 'Email confirmed',
			meta: { cell: { variant: 'checkbox' } },
			filterFn
		},
		{
			accessorKey: 'emailConfirmCode',
			header: 'Email confirm code',
			meta: { cell: { variant: 'text-short' } },
			filterFn
		},
		{
			accessorKey: 'passwordResetCode',
			header: 'Password reset code',
			meta: { cell: { variant: 'text-short' } },
			filterFn
		},
		{
			accessorKey: 'passwordResetExpiresAt',
			header: 'Password reset expires',
			meta: { cell: { variant: 'date-time' } },
			filterFn
		},
		{
			accessorKey: 'isActive',
			header: 'Active',
			meta: { cell: { variant: 'checkbox' } },
			filterFn
		},
		{
			accessorKey: 'reasonForDeactivation',
			header: 'Reason for deactivation',
			meta: { cell: { variant: 'text-long' } },
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
		endpoint: `/api/users`,
		onDataChange: (nextRows) => (rows = nextRows),
		onFilesUpload: async ({ files, columnId, row }) =>
			uploadMedia({
				collection: MediaCollection.users,
				files,
				rowId: row.id,
				columnId,
				missionTemplateId: row.id
			}),
		enableSearch: true,
		enablePaste: true,
		initialState: {
			sorting: [{ id: 'id', desc: false }],
			columnVisibility: { clientId: false },
			columnPinning: { left: ['select-row'] }
		}
	} as const);

	const { table, ...dataGridProps } = dataGrid;
</script>

<Header class="mx-auto w-full max-w-6xl">
	<BreadcrumbMenu
		menus={[
			[
				{ label: 'Missions', url: `/edit/missions` },
				{ label: 'Groups', url: `/edit/groups` },
				{ isTrigger: true, label: 'Users', url: `/edit/users` }
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
		</div>
	</div>

	<DataGrid {...dataGridProps} {table} height={gridHeight} />
</div>
