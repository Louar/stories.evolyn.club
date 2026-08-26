<script lang="ts">
	import Header from '$lib/components/app/header/app-header.svelte';
	import {
		createDataGridPersistenceIdentity,
		DataGrid,
		DataGridAdapterError,
		DataGridToolbar,
		getFilterFn,
		RowSelectHeader,
		useDataGrid,
		type DataGridDataAdapter
	} from '$lib/components/data-grid';
	import BreadcrumbMenu from '$lib/components/ui/breadcrumb-menu/breadcrumb-menu.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog/index.js';
	import { renderComponent } from '$lib/components/ui/table-tanstack/index.js';
	import { useWindowSize } from '$lib/hooks/use-window-size.svelte';
	import { page } from '$app/state';
	import type { ColumnDef } from '@tanstack/table-core';

	let { data } = $props();

	const clientId = $derived(page.params.clientId);
	let rows = $derived(data.apiKeys);
	type Row = (typeof rows)[number];
	type ApiKeyCreateResponse = Row & { secret: string };

	let oneTimeSecret = $state<string | null>(null);
	let oneTimeSecretName = $state<string | null>(null);
	let secretDialogOpen = $state(false);

	const filterFn = getFilterFn<Row>();
	const windowSize = useWindowSize({ defaultHeight: 800 });
	const gridHeight = $derived(Math.max(250, windowSize.height - 150));

	const maskSecret = (secret: string) => {
		if (secret.length <= 4) return '•'.repeat(secret.length);
		return `${secret.slice(0, 2)}${'•'.repeat(Math.max(1, secret.length - 4))}${secret.slice(-2)}`;
	};

	const readErrorBody = async (response: Response): Promise<unknown> => {
		const contentType = response.headers.get('content-type') ?? '';
		try {
			return contentType.includes('json') ? await response.json() : await response.text();
		} catch {
			return undefined;
		}
	};

	const requireJsonResponse = async <T,>(response: Response, action: string): Promise<T> => {
		if (!response.ok) {
			throw new DataGridAdapterError(
				`Failed to ${action}`,
				response.status,
				await readErrorBody(response)
			);
		}
		return (await response.json()) as T;
	};

	const jsonHeaders = { 'Content-Type': 'application/json' };

	const apiKeyAdapter: DataGridDataAdapter<Row> = {
		async create({ row }) {
			if (!row.clientId) throw new Error('Select a client before creating an API key');

			const response = await fetch(`/api/clients/${encodeURIComponent(row.clientId)}/api-keys`, {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify(row)
			});
			const created = await requireJsonResponse<ApiKeyCreateResponse>(response, 'create row');

			oneTimeSecret = created.secret;
			oneTimeSecretName = created.name;
			secretDialogOpen = true;

			return { ...created, secret: maskSecret(created.secret) };
		},
		async update({ row, rowId, changes }) {
			const response = await fetch(
				`/api/clients/${encodeURIComponent(row.clientId)}/api-keys/${encodeURIComponent(rowId)}`,
				{
					method: 'PATCH',
					headers: jsonHeaders,
					body: JSON.stringify(changes)
				}
			);
			return requireJsonResponse<Row>(response, `update row ${rowId}`);
		},
		async delete({ row, rowId }) {
			const response = await fetch(
				`/api/clients/${encodeURIComponent(row.clientId)}/api-keys/${encodeURIComponent(rowId)}`,
				{ method: 'DELETE' }
			);
			return response.ok;
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
			accessorKey: 'name',
			header: 'Name',
			meta: { cell: { variant: 'text-short' } },
			filterFn
		},
		{
			accessorKey: 'secret',
			header: 'Secret',
			size: 240,
			meta: { cell: { variant: 'text-short' }, readOnly: true },
			filterFn
		},
		{
			accessorKey: 'scopes',
			header: 'Scopes',
			meta: { cell: { variant: 'text-long' } },
			filterFn
		},
		{
			accessorKey: 'lastUsedAt',
			header: 'Last used at',
			meta: { cell: { variant: 'date-time' }, readOnly: true },
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
		persistence: createDataGridPersistenceIdentity('edit.client-api-keys', () => data),
		getRowId: (row) => row.id,
		dataAdapter: apiKeyAdapter,
		defaultRow: () => ({ clientId, scopes: ['all'] }),
		onDataChange: (nextRows) => (rows = nextRows),
		enableSearch: true,
		enablePaste: true,
		initialState: {
			sorting: [{ id: 'lastUsedAt', desc: false }],
			columnVisibility: { id: false, clientId: false },
			columnPinning: { left: ['select-row'] }
		}
	} as const);

	const { table, ...dataGridProps } = dataGrid;

	const copySecret = async () => {
		if (!oneTimeSecret) return;
		await navigator.clipboard.writeText(oneTimeSecret);
	};

	const onSecretDialogOpenChange = (open: boolean) => {
		secretDialogOpen = open;
		if (!open) {
			oneTimeSecret = null;
			oneTimeSecretName = null;
		}
	};
</script>

<svelte:head>
	<title>Edit client API keys</title>
</svelte:head>

<Header>
	<BreadcrumbMenu
		menus={[
			[
				{ label: 'Missions', url: `/edit/missions` },
				{ label: 'Clients', url: `/edit/clients` },
				{ isTrigger: true, label: 'API keys', url: `/edit/clients/api-keys` }
			]
		]}
	/>
</Header>

<div class="mx-auto mt-4 w-full max-w-6xl space-y-4 px-4">
	<DataGridToolbar {table} enableSearch={!!dataGridProps.searchState} />

	<DataGrid {...dataGridProps} {table} height={gridHeight} />
</div>

<Dialog open={secretDialogOpen} onOpenChange={onSecretDialogOpenChange}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Client API key created</DialogTitle>
			<DialogDescription>
				This secret for {oneTimeSecretName ?? 'the new API key'} is shown once. Store it now; it cannot
				be viewed again.
			</DialogDescription>
		</DialogHeader>

		<div class="rounded-md border bg-muted px-3 py-2 font-mono text-sm break-all">
			{oneTimeSecret}
		</div>

		<DialogFooter>
			<Button variant="outline" onclick={copySecret}>Copy secret</Button>
			<Button onclick={() => onSecretDialogOpenChange(false)}>Close</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
