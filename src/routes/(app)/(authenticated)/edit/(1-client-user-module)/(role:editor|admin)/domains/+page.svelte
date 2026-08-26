<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Header from '$lib/components/app/header/app-header.svelte';
	import {
		createDataGridPersistenceIdentity,
		DataGrid,
		DataGridToolbar,
		getFilterFn,
		useDataGrid
	} from '$lib/components/data-grid';
	import BreadcrumbMenu from '$lib/components/ui/breadcrumb-menu/breadcrumb-menu.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { useWindowSize } from '$lib/hooks/use-window-size.svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import type { ColumnDef } from '@tanstack/table-core';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { toast } from 'svelte-sonner';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let rows = $derived(data.domains);
	type Row = (typeof rows)[number];

	let domain = $state('');
	let adding = $state(false);

	const filterFn = getFilterFn<Row>();
	const windowSize = useWindowSize({ defaultHeight: 800 });
	const gridHeight = $derived(Math.max(250, windowSize.height - 230));

	const columns: ColumnDef<Row, unknown>[] = [
		{
			accessorKey: 'domain',
			header: 'Domain',
			meta: { cell: { variant: 'text-short' }, readOnly: true },
			filterFn
		}
	];

	const dataGrid = useDataGrid<Row>({
		columns,
		data: () => rows,
		persistence: createDataGridPersistenceIdentity('edit.domains', () => data),
		getRowId: (row) => row.id,
		readOnly: true,
		enableSearch: true,
		enablePaste: false,
		emptyMessage: 'No Caddy domains configured',
		initialState: {
			sorting: [{ id: 'domain', desc: false }]
		}
	} as const);

	const { table, ...dataGridProps } = dataGrid;

	const normalizedDomains = $derived(new Set(rows.map((row) => row.domain)));
	const normalizedDomainInput = $derived(domain.trim().toLowerCase().replace(/\.$/, ''));
	const duplicateDomain = $derived(
		normalizedDomainInput.length > 0 && normalizedDomains.has(normalizedDomainInput)
	);

	const enhanceAddDomain: SubmitFunction = () => {
		adding = true;
		return async ({ update, result }) => {
			await update({ invalidateAll: false, reset: false });
			adding = false;

			if (result.type === 'success') {
				const addedDomain =
					typeof result.data?.domain === 'string' ? result.data.domain : normalizedDomainInput;
				domain = '';
				toast.success(`Added ${addedDomain}`);
				await invalidateAll();
			} else if (result.type === 'failure') {
				const message =
					typeof result.data?.message === 'string' ? result.data.message : 'Unable to add domain';
				toast.error(message);
			}
		};
	};
</script>

<svelte:head>
	<title>Edit domains</title>
</svelte:head>

<Header>
	<BreadcrumbMenu
		menus={[
			[
				{ label: 'Clients', url: `/edit/clients` },
				{ isTrigger: true, label: 'Domains', url: `/edit/domains` }
			]
		]}
	/>
</Header>

<div class="mx-auto mt-4 w-full max-w-6xl space-y-4 px-4">
	<section class="rounded-xl border bg-background p-4 shadow-sm">
		<form
			method="POST"
			action="?/add"
			use:enhance={enhanceAddDomain}
			class="flex flex-col gap-3 sm:flex-row sm:items-end"
		>
			<div class="min-w-0 flex-1 space-y-2">
				<Label for="domain">Add domain</Label>
				<Input
					id="domain"
					name="domain"
					placeholder="example.com"
					autocomplete="off"
					required
					bind:value={domain}
					aria-invalid={Boolean(form?.message) || duplicateDomain}
				/>
			</div>
			<Button type="submit" disabled={adding || !domain.trim() || duplicateDomain}>
				<Plus class="size-4" />
				{adding ? 'Adding...' : 'Add domain'}
			</Button>
		</form>

		{#if duplicateDomain}
			<p class="mt-2 text-sm text-destructive" role="alert">This domain is already configured.</p>
		{:else if form?.message}
			<p class="mt-2 text-sm text-destructive" role="alert">{form.message}</p>
		{/if}
	</section>

	<DataGridToolbar {table} enableSearch={!!dataGridProps.searchState} />

	<DataGrid
		{...dataGridProps}
		{table}
		height={gridHeight}
		error={data.loadError}
		errorMessage={data.loadError ?? undefined}
	/>
</div>
