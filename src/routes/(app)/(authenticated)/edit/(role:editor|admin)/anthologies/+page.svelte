<script lang="ts">
	import Header from '$lib/components/app/header/app-header.svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button';
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
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import FileDownIcon from '@lucide/svelte/icons/file-down';
	import FileUpIcon from '@lucide/svelte/icons/file-up';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import PlusIcon from '@lucide/svelte/icons/plus';
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
			{#each anthologies as anthology}
				<Item.Root
					variant="outline"
					onclick={() => {
						anthologyToEdit = anthology;
						isEditorOpen = true;
					}}
				>
					<Item.Content>
						<Item.Title>{anthology.name}</Item.Title>
						<Item.Description>
							Status: {anthology.isPublished ? 'Published' : 'Draft'}, Visibility: {anthology.isPublic
								? 'Public'
								: 'Private'}
						</Item.Description>
					</Item.Content>
					<Item.Actions>
						<a
							href="/api/anthologies/{anthology.id}/io"
							data-sveltekit-preload-data="tap"
							class={buttonVariants({ variant: 'outline', size: 'sm' })}
						>
							<FileDownIcon class="size-4" />
							Download
						</a>
						<Button
							onclick={() => {
								anthologyToEdit = anthology;
								isEditorOpen = true;
							}}
							variant="ghost"
							size="icon"
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
		<Popover.Trigger class={buttonVariants({ variant: 'outline', size: 'default' })}>
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
