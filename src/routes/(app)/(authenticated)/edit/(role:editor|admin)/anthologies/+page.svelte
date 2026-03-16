<script lang="ts">
	import { resolve } from '$app/paths';
	import Header from '$lib/components/app/header/app-header.svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import {
		displaySize,
		FileDropZone,
		MEGABYTE,
		type FileDropZoneProps
	} from '$lib/components/ui/file-drop-zone';
	import * as Form from '$lib/components/ui/form/index.js';
	import * as Item from '$lib/components/ui/item/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import BookCheckIcon from '@lucide/svelte/icons/book-check';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import BookXIcon from '@lucide/svelte/icons/book-x';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import FileDownIcon from '@lucide/svelte/icons/file-down';
	import FileUpIcon from '@lucide/svelte/icons/file-up';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import LockIcon from '@lucide/svelte/icons/lock';
	import LockOpenIcon from '@lucide/svelte/icons/lock-open';
	import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import UserLockIcon from '@lucide/svelte/icons/user-lock';
	import XIcon from '@lucide/svelte/icons/x';
	import { toast } from 'svelte-sonner';
	import { filesProxy, superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import Editor from './editor.svelte';
	import { schemaOfAttachments } from './schemas';

	let { data } = $props();
	let anthologies = $derived(data.anthologies);
	type Anthology = (typeof anthologies)[number];
	let isEditorOpen: boolean = $state(false);
	let anthologyToEdit: Anthology | undefined = $state();
	$effect(() => {
		if (anthologyToEdit?.id) isEditorOpen = true;
	});

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
	const { enhance, message, delayed } = form;
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

<div class="mx-auto w-full max-w-xl">
	<Header>
		<h1 class="overflow-hidden text-sm whitespace-nowrap">My anthologies</h1>
	</Header>
</div>

{#if isEditorOpen}
	<Editor bind:isEditorOpen bind:anthology={anthologyToEdit} {data} />
{/if}

<div class="mx-auto w-full max-w-xl">
	{#if anthologies.length}
		<div class="grid w-full gap-4 p-4">
			<div class="flex gap-2">
				<Button onclick={() => (isEditorOpen = true)}>
					<PlusIcon class="size-4" />
					Create anthology
				</Button>
				{@render upload()}
			</div>
			{#each anthologies as anthology (anthology.id)}
				<Item.Root
					variant="outline"
					onclick={() => {
						anthologyToEdit = anthology;
						isEditorOpen = true;
					}}
				>
					<Item.Content class=" min-w-0">
						<Item.Title>{anthology.name}</Item.Title>
						<Item.Description class="flex items-center gap-1">
							{#if anthology.isPublished}
								<BookCheckIcon class="size-3.5" />
							{:else}
								<BookXIcon class="size-3.5" />
							{/if}
							{#if anthology.isPublic}
								<LockOpenIcon class="size-3.5" />
							{:else}
								<LockIcon class="size-3.5" />
							{/if}
							<span class="truncate pl-2">{anthology.reference}</span>
						</Item.Description>
					</Item.Content>
					<Item.Actions>
						<DropdownMenu.Root>
							<DropdownMenu.Trigger>
								{#snippet child({ props })}
									<Button {...props} variant="outline" size="icon-sm">
										<MoreHorizontalIcon />
									</Button>
								{/snippet}
							</DropdownMenu.Trigger>
							<DropdownMenu.Content class="w-56" align="end">
								<DropdownMenu.Group>
									<DropdownMenu.Item>
										{#snippet child({ props })}
											<a href={resolve(`/edit/anthologies/${anthology.id}/permissions`)} {...props}>
												<UserLockIcon />
												Permissions
											</a>
										{/snippet}
									</DropdownMenu.Item>
									<DropdownMenu.Item disabled>
										{#snippet child({ props })}
											<a href={resolve(`/api/anthologies/${anthology.id}/io`)} {...props}>
												<FileDownIcon />
												Download
											</a>
										{/snippet}
									</DropdownMenu.Item>
									<DropdownMenu.Separator />
									<DropdownMenu.Item
										onclick={() => {
											anthologyToEdit = anthology;
											isEditorOpen = true;
										}}
									>
										<PencilIcon />
										Edit
									</DropdownMenu.Item>
								</DropdownMenu.Group>
							</DropdownMenu.Content>
						</DropdownMenu.Root>
						<Button
							href="/a/{anthology.reference}"
							target="_blank"
							disabled={!anthology.reference?.length}
							variant="ghost"
							size="icon"
							onclick={(e) => e.stopPropagation()}
						>
							<ChevronRightIcon class="size-4" />
						</Button>
					</Item.Actions>
				</Item.Root>
			{/each}
		</div>
	{:else}
		<Empty.Root>
			<Empty.Header>
				<Empty.Media variant="icon">
					<BookOpenIcon />
				</Empty.Media>
				<Empty.Title>No anthologies yet</Empty.Title>
				<Empty.Description>Create your first anthology to get started.</Empty.Description>
			</Empty.Header>
			<Empty.Content>
				<div class="flex gap-2">
					<Button onclick={() => (isEditorOpen = true)}>
						<PlusIcon class="size-4" />
						Create anthology
					</Button>
					{@render upload()}
				</div>
			</Empty.Content>
		</Empty.Root>
	{/if}
</div>

{#snippet upload()}
	<Popover.Root bind:open={isUploadPanelOpen}>
		<Popover.Trigger disabled class={buttonVariants({ variant: 'outline', size: 'default' })}>
			<FileUpIcon class="size-4" />
			Upload anthologies
		</Popover.Trigger>
		<Popover.Content class="w-80" align="start">
			<div class="grid gap-4">
				<div class="space-y-2">
					<h4 class="leading-none font-medium">Upload anthologies</h4>
					<p class="text-sm text-muted-foreground">Upload anthology .YAMLs.</p>
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
