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
	import type { ColumnDef } from '$lib/components/data-grid/data-grid-table.js';
	import BreadcrumbMenu from '$lib/components/ui/breadcrumb-menu/breadcrumb-menu.svelte';
	import { renderComponent } from '$lib/components/ui/table-tanstack/index.js';
	import { Language, MediaCollection } from '$lib/db/schemas/0-utils.js';
	import { UserRole } from '$lib/db/schemas/1-client-user-module.js';
	import { useWindowSize } from '$lib/hooks/use-window-size.svelte';
	import MailIcon from '@lucide/svelte/icons/mail';
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
			meta: { cell: { variant: 'row-select' }, description: 'Select this user row.' }
		},
		{
			accessorKey: 'id',
			header: 'ID',
			meta: {
				cell: { variant: 'text-short' },
				description: 'Unique user identifier.',
				readOnly: true
			},
			filterFn
		},
		{
			accessorKey: 'clientId',
			header: 'Client',
			meta: {
				cell: { variant: 'text-short' },
				description: 'Client associated with the user.',
				readOnly: true
			},
			filterFn
		},
		{
			accessorKey: 'email',
			header: 'Email',
			meta: { cell: { variant: 'text-short' }, description: 'User email address.' },
			filterFn
		},
		{
			accessorKey: 'phone',
			header: 'Phone',
			meta: { cell: { variant: 'text-short' }, description: 'User phone number.' },
			filterFn
		},
		{
			accessorKey: 'firstName',
			header: 'First name',
			meta: { cell: { variant: 'text-short' }, description: 'User first name.' },
			filterFn
		},
		{
			accessorKey: 'lastName',
			header: 'Last name',
			meta: { cell: { variant: 'text-short' }, description: 'User last name.' },
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
				},
				description: 'User profile picture.'
			}
		},
		{
			accessorKey: 'password',
			header: 'Password',
			meta: { cell: { variant: 'text-short' }, description: 'User password value.' },
			filterFn
		},
		{
			accessorKey: 'authCode',
			header: 'Auth code',
			meta: {
				cell: { variant: 'text-short' },
				description: 'Authentication code assigned to the user.'
			},
			filterFn
		},
		{
			accessorKey: 'authCodeLastUsed',
			header: 'Auth code last used',
			meta: {
				cell: { variant: 'date-time' },
				description: 'When the authentication code was last used.',
				readOnly: true
			},
			filterFn
		},
		{
			accessorKey: 'roles',
			header: 'Roles',
			size: 230,
			meta: {
				cell: { variant: 'select-multiple', options: roleOptions() },
				description: 'Roles assigned to the user.'
			},
			filterFn
		},
		{
			accessorKey: 'language',
			header: 'Language',
			meta: {
				cell: { variant: 'select-single', options: languageOptions() },
				description: 'Preferred language of the user.'
			},
			filterFn
		},
		{
			accessorKey: 'pronouns',
			header: 'Pronouns',
			meta: { cell: { variant: 'text-short' }, description: 'Pronouns used by the user.' },
			filterFn
		},
		{
			accessorKey: 'address',
			header: 'Address',
			meta: {
				cell: { variant: 'json-yaml' },
				description: 'Structured address details for the user.'
			},
			filterFn
		},
		{
			accessorKey: 'dateOfBirth',
			header: 'Date of birth',
			meta: { cell: { variant: 'date' }, description: 'User date of birth.' },
			filterFn
		},
		{
			accessorKey: 'emailConfirmed',
			header: 'Email confirmed',
			meta: { cell: { variant: 'checkbox' }, description: 'Whether the user email is confirmed.' },
			filterFn
		},
		{
			accessorKey: 'emailConfirmCode',
			header: 'Email confirm code',
			meta: {
				cell: { variant: 'text-short' },
				description: 'Code used to confirm the user email.'
			},
			filterFn
		},
		{
			accessorKey: 'phoneConfirmed',
			header: 'Phone confirmed',
			meta: {
				cell: { variant: 'checkbox' },
				description: 'Whether the user phone number is confirmed.'
			},
			filterFn
		},
		{
			accessorKey: 'passwordResetCode',
			header: 'Password reset code',
			meta: {
				cell: { variant: 'text-short' },
				description: 'Code used to reset the user password.'
			},
			filterFn
		},
		{
			accessorKey: 'passwordResetExpiresAt',
			header: 'Password reset expires',
			meta: {
				cell: { variant: 'date-time' },
				description: 'When the password reset code expires.'
			},
			filterFn
		},
		{
			accessorKey: 'isActive',
			header: 'Active',
			meta: { cell: { variant: 'checkbox' }, description: 'Whether the user account is active.' },
			filterFn
		},
		{
			accessorKey: 'reasonForDeactivation',
			header: 'Reason for deactivation',
			meta: {
				cell: { variant: 'text-long' },
				description: 'Reason the user account was deactivated.'
			},
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
				description: 'Actions available for the user.',
				readOnly: true,
				navigable: false
			}
		},
		{
			accessorKey: 'createdAt',
			header: 'Created at',
			meta: {
				cell: { variant: 'date-time' },
				description: 'When the user was created.',
				readOnly: true
			},
			filterFn
		},
		{
			accessorKey: 'createdBy',
			header: 'Created by',
			meta: {
				cell: { variant: 'badge-item' },
				description: 'Who created the user.',
				readOnly: true
			},
			filterFn
		},
		{
			accessorKey: 'updatedAt',
			header: 'Updated at',
			meta: {
				cell: { variant: 'date-time' },
				description: 'When the user was last updated.',
				readOnly: true
			},
			filterFn
		},
		{
			accessorKey: 'updatedBy',
			header: 'Updated by',
			meta: {
				cell: { variant: 'badge-item' },
				description: 'Who last updated the user.',
				readOnly: true
			},
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
			columnPinning: { start: ['select-row'], end: [] }
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
