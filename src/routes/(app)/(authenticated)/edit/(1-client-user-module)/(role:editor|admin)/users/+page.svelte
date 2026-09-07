<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Header from '$lib/components/app/header/app-header.svelte';
	import {
		createDataGridPersistenceIdentity,
		DataGrid,
		DataGridToolbar,
		fileCellMediaToFileCellData,
		getFilterFn,
		RowSelectHeader,
		uploadMedia,
		useDataGrid
	} from '$lib/components/data-grid';
	import DataGridGenerateMenu from '$lib/components/data-grid/data-grid-generate-menu.svelte';
	import BreadcrumbMenu from '$lib/components/ui/breadcrumb-menu/breadcrumb-menu.svelte';
	import { renderComponent } from '$lib/components/ui/table-tanstack/index.js';
	import { Language, MediaCollection } from '$lib/db/schemas/0-utils.js';
	import { UserRole } from '$lib/db/schemas/1-client-user-module.js';
	import { useWindowSize } from '$lib/hooks/use-window-size.svelte';
	import MailIcon from '@lucide/svelte/icons/mail';
	import type { ColumnDef } from '@tanstack/table-core';
	import { toast } from 'svelte-sonner';

	let { data } = $props();
	const endpoint = `/api/users`;

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

	async function sendPasswordResetEmail(row: Row) {
		try {
			const response = await fetch(`/api/users/${encodeURIComponent(row.id)}/reset-password`, {
				method: 'POST'
			});
			const result = await response.json().catch(() => null);
			if (!response.ok) {
				throw new Error(result?.message ?? 'The password reset email could not be sent');
			}

			toast.success(`Password reset email sent to ${row.email}`);
			await invalidateAll();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : 'The password reset email could not be sent'
			);
		}
	}

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
			accessorKey: 'phone',
			header: 'Phone',
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
					variant: 'file-or-url',
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
			accessorKey: 'authCode',
			header: 'Auth code',
			meta: { cell: { variant: 'text-short' } },
			filterFn
		},
		{
			accessorKey: 'authCodeLastUsed',
			header: 'Auth code last used',
			meta: { cell: { variant: 'date-time' } },
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
			accessorKey: 'phoneConfirmed',
			header: 'Phone confirmed',
			meta: { cell: { variant: 'checkbox' } },
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
			id: 'actions',
			header: 'Actions',
			size: 60,
			enableSorting: false,
			enableHiding: false,
			enableResizing: false,
			meta: {
				cell: {
					variant: 'actions',
					actions: (row) => [
						{
							label: 'Send password reset email',
							icon: MailIcon,
							disabled: !row.email || !data.client.administrationEmail,
							onSelect: sendPasswordResetEmail
						}
					]
				},
				readOnly: true,
				navigable: false
			}
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
		persistence: createDataGridPersistenceIdentity('edit.users', () => data),
		getRowId: (row) => row.id,
		endpoint,
		onDataChange: (nextRows) => (rows = nextRows),
		onFilesUpload: async ({ files, columnId, rowId }) =>
			uploadMedia({
				collection: MediaCollection.users,
				files,
				rowId,
				columnId
			}),
		enableSearch: true,
		enablePaste: true,
		initialState: {
			// sorting: [{ id: 'id', desc: false }],
			columnVisibility: { clientId: false },
			columnPinning: { left: ['select-row'] }
		}
	} as const);

	const { table, ...dataGridProps } = dataGrid;
</script>

<svelte:head>
	<title>Edit users</title>
</svelte:head>

<Header>
	<BreadcrumbMenu
		menus={[
			[
				{ label: 'Assistants', url: `/edit/assistants` },
				{ label: 'Providers', url: `/edit/providers/authorizations` },
				{ label: 'File stores', url: `/edit/stores` },
				{ isTrigger: true, label: 'Users', url: `/edit/users` }
			]
		]}
	/>
</Header>

<div class="mx-auto mt-4 w-full max-w-6xl space-y-4 px-4">
	<DataGridToolbar {table} enableSearch={!!dataGridProps.searchState}>
		{#snippet actions()}
			<DataGridGenerateMenu
				class="ml-auto"
				endpoint="/api/users/generate"
				entityLabel="users"
				maxCount={1000}
				onSuccess={invalidateAll}
			/>
		{/snippet}
	</DataGridToolbar>

	<DataGrid {...dataGridProps} {table} height={gridHeight} />
</div>
