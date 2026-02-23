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
	import DataGridLanguageSelectMenu from '$lib/components/data-grid/data-grid-language-select-menu.svelte';
	import BreadcrumbMenu from '$lib/components/ui/breadcrumb-menu/breadcrumb-menu.svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import {
		displaySize,
		FileDropZone,
		MEGABYTE,
		type FileDropZoneProps
	} from '$lib/components/ui/file-drop-zone';
	import * as Form from '$lib/components/ui/form/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { renderComponent } from '$lib/components/ui/table-tanstack/index.js';
	import { hasTranslatableFields, useDataGrid } from '$lib/hooks/use-custom-data-grid.svelte';
	import { useWindowSize } from '$lib/hooks/use-window-size.svelte';
	import { cn } from '$lib/utils.js';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import CheckIcon from '@lucide/svelte/icons/check';
	import FileUpIcon from '@lucide/svelte/icons/file-up';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import type { ColumnDef } from '@tanstack/table-core';
	import { toast } from 'svelte-sonner';
	import { filesProxy, superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { schemaOfAttachments } from './schemas';

	let { data } = $props();

	let rows = $derived(data.stories);
	type Row = (typeof rows)[number];

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
			id: 'edit-flow',
			header: 'Edit flow',
			accessorFn: () => `Edit flow`,
			meta: {
				cell: { variant: 'relation-follow', url: `${page.url.pathname}/{row}/flow` },
				readOnly: true
			},
			filterFn
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
			meta: { cell: { variant: 'text-translated-short' } },
			filterFn
		},
		{
			accessorKey: 'editors',
			header: 'Editors',
			meta: {
				cell: { variant: 'relation-follow', url: `${page.url.pathname}/{row}/permissions` },
				readOnly: true
			},
			filterFn
		},
		{
			id: 'url',
			header: 'URL',
			accessorFn: (row) => `${page.url.origin}/s/${row.reference}`,
			meta: { cell: { variant: 'text-short' }, readOnly: true },
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
		getRowId: (row) => row.id,
		endpoint: `/api/stories`,
		onDataChange: (nextRows) => (rows = nextRows),
		enableSearch: true,
		enablePaste: true,
		onRowAdd: false,
		onRowsAdd: (count: number) => {},
		initialState: {
			sorting: [{ id: 'id', desc: false }],
			columnVisibility: { id: false, configuration: false },
			columnPinning: { left: ['select-row'] }
		}
	} as const);

	const { table, ...dataGridProps } = dataGrid;

	const showLanguageMenu = $derived(hasTranslatableFields(columns));

	let isUploadPanelOpen = $state(false);
	// svelte-ignore state_referenced_locally
	const form = superForm(data.form, {
		validators: zod4Client(schemaOfAttachments),
		resetForm: false,
		dataType: 'form',
		onUpdate: ({ form: f }) => {
			if (f.valid) isUploadPanelOpen = false;
		}
	});
	const { form: fd, enhance, message, delayed } = form;
	message.subscribe((message) => {
		if (message) {
			toast.success(message.text, {
				description: 'Your attachments were uploaded.'
			});
		}
	});
	const onUpload: FileDropZoneProps['onUpload'] = async (uploadedFiles) => {
		files.set([...Array.from($files), ...uploadedFiles]);
	};
	const onFileRejected: FileDropZoneProps['onFileRejected'] = async ({ reason, file }) => {
		toast.error(`${file.name} failed to upload!`, { description: reason });
	};
	const files = filesProxy(form, 'attachments');
</script>

<Header class="mx-auto w-full max-w-6xl">
	<BreadcrumbMenu
		menus={[
			[
				{ label: 'Anthologies', url: `/edit/anthologies` },
				{ isTrigger: true, label: 'Stories', url: `/edit/stories` }
			]
		]}
	/>
</Header>

<div class="mx-auto w-full max-w-6xl space-y-4 px-4">
	{#if rows.length}
		<div role="toolbar" aria-orientation="horizontal" class="flex items-center justify-between">
			<DataGridKeyboardShortcuts enableSearch={!!dataGridProps.searchState} />
			<div class="flex w-full items-center gap-1">
				<DataGridFilterMenu {table} />
				<DataGridSortMenu {table} />
				<DataGridRowHeightMenu {table} />
				<DataGridViewMenu {table} />
				{#if showLanguageMenu}
					<DataGridLanguageSelectMenu class="ml-auto" />
				{/if}
				<Button
					href="/edit/stories/new/flow"
					data-sveltekit-preload-data="tap"
					variant="outline"
					size="sm"
					class="h-8 font-normal"
				>
					<PlusIcon class="size-4" />
					Create
				</Button>
				{@render upload()}
			</div>
		</div>

		<DataGrid {...dataGridProps} {table} height={gridHeight} />
	{:else}
		<Empty.Root>
			<Empty.Header>
				<Empty.Media variant="icon">
					<BookOpenIcon />
				</Empty.Media>
				<Empty.Title>No stories yet</Empty.Title>
				<Empty.Description>Create your first story to get started.</Empty.Description>
			</Empty.Header>
			<Empty.Content>
				<div class="flex gap-2">
					<Button
						href="/edit/stories/new/flow"
						data-sveltekit-preload-data="tap"
						size="sm"
						class="h-8 font-normal"
					>
						<PlusIcon class="size-4" />
						Create
					</Button>
					{@render upload()}
				</div>
			</Empty.Content>
		</Empty.Root>
	{/if}
</div>

{#snippet upload()}
	<Popover.Root bind:open={isUploadPanelOpen}>
		<Popover.Trigger
			class={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 font-normal')}
		>
			<FileUpIcon class="text-muted-foreground" />
			Upload
		</Popover.Trigger>
		<Popover.Content class="w-80" align="start">
			<div class="grid gap-4">
				<div class="space-y-2">
					<h4 class="leading-none font-medium">Upload stories</h4>
					<p class="text-sm text-muted-foreground">Upload story .YAMLs.</p>
				</div>
				<div class="grid gap-2">
					<form
						method="POST"
						action="?/upload"
						enctype="multipart/form-data"
						use:enhance
						class="flex w-full flex-col gap-2"
					>
						<Form.Fieldset {form} name="attachments">
							<Form.Control>
								{#snippet children({ props })}
									<div class="space-y-2">
										<FileDropZone
											{onUpload}
											{onFileRejected}
											maxFileSize={50 * MEGABYTE}
											accept=".yml,.yaml,application/yaml,application/x-yaml"
											maxFiles={50}
											fileCount={$files.length ?? 0}
										/>
										<input name={props.name} type="file" bind:files={$files} class="hidden" />
										{#if $files.length}
											<ScrollArea class="h-32 rounded-md border p-4">
												<div class="flex flex-col gap-2">
													{#each Array.from($files) as file, i (file.name)}
														<div class="flex place-items-center justify-between gap-2">
															<div class="flex flex-col">
																<span>{file.name}</span>
																<span class="text-xs text-muted-foreground"
																	>{displaySize(file.size)}</span
																>
															</div>
															<Button
																variant="outline"
																size="icon"
																onclick={() => {
																	// we use set instead of an assignment since it accepts a File[]
																	files.set([
																		...Array.from($files).slice(0, i),
																		...Array.from($files).slice(i + 1)
																	]);
																}}
															>
																<XIcon class="size-5" />
															</Button>
														</div>
														<Form.ElementField {form} name="attachments[{i}]">
															<Form.FieldErrors class="wrap-break-word whitespace-pre-line" />
														</Form.ElementField>
													{/each}
												</div>
											</ScrollArea>
										{/if}
									</div>
								{/snippet}
							</Form.Control>
						</Form.Fieldset>
						<Button type="submit" class="w-full" disabled={$delayed}>
							{#if $delayed}<LoaderCircleIcon class="size-5 animate-spin" />
							{:else}<CheckIcon class="size-5" />{/if}
							<span>Upload</span>
						</Button>
					</form>
				</div>
			</div>
		</Popover.Content>
	</Popover.Root>
{/snippet}
