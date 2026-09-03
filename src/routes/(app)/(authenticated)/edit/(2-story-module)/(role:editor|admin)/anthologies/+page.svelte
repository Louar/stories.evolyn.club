<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Header from '$lib/components/app/header/app-header.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import BreadcrumbMenu from '$lib/components/ui/breadcrumb-menu/breadcrumb-menu.svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import {
		displaySize,
		FileDropZone,
		MEGABYTE,
		type FileDropZoneProps
	} from '$lib/components/ui/file-drop-zone';
	import * as Item from '$lib/components/ui/item/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Switch } from '$lib/components/ui/switch';
	import { useSubmissionState } from '$lib/hooks/use-submission-state.svelte.js';
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
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import UserLockIcon from '@lucide/svelte/icons/user-lock';
	import XIcon from '@lucide/svelte/icons/x';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { toast } from 'svelte-sonner';
	import { z } from 'zod/v4';
	import type { ActionData } from './$types';
	import Editor from './editor.svelte';
	import { schemaOfAttachments } from './schemas';

	let { data } = $props();
	let anthologies = $derived(data.anthologies);
	type Anthology = (typeof anthologies)[number];
	let isEditorOpen: boolean = $state(false);
	let anthologyToEdit: Anthology | undefined = $state();
	let anthologyToDelete: Anthology | undefined = $state();
	let includeStoryDefinitions = $state(false);
	let deleteUnderlyingStories = $state(false);
	let isDeleteDialogOpen = $state(false);
	let deletingAnthologyId: string | undefined = $state();

	let isUploadPanelOpen = $state(false);
	type UploadActionData = Extract<NonNullable<ActionData>, { form: 'upload' }>;
	let attachments: FileList | undefined = $state();
	let attachmentErrors: string[] = $state([]);
	const attachmentList = $derived(Array.from(attachments ?? []));
	const uploadSubmission = useSubmissionState();

	const setAttachments = (files: File[]) => {
		const transfer = new DataTransfer();
		for (const file of files) transfer.items.add(file);
		attachments = transfer.files;
	};

	const enhanceUpload: SubmitFunction = ({ formData, cancel }) => {
		if (uploadSubmission.submitting) {
			cancel();
			return;
		}

		const result = schemaOfAttachments.safeParse({
			attachments: formData
				.getAll('attachments')
				.filter((value): value is File => value instanceof File)
		});
		if (!result.success) {
			cancel();
			attachmentErrors = z.flattenError(result.error).fieldErrors.attachments ?? [];
			return;
		}

		attachmentErrors = [];
		const submissionId = uploadSubmission.start();
		return async ({ result: actionResult, update }) => {
			try {
				if (actionResult.type === 'success') {
					attachments = undefined;
					isUploadPanelOpen = false;
					toast.success('Form posted successfully!', {
						description: 'Your attachments were uploaded.'
					});
				} else if (actionResult.type === 'failure' && actionResult.data) {
					const uploadData = actionResult.data as UploadActionData;
					attachmentErrors =
						(uploadData.errors as { attachments?: string[] } | undefined)?.attachments ?? [];
					toast.error(uploadData.message ?? 'Upload failed.');
				}
				await update({ reset: false });
			} finally {
				uploadSubmission.finish(submissionId);
			}
		};
	};

	const onUpload: FileDropZoneProps['onUpload'] = async (uploadedFiles) => {
		setAttachments([...attachmentList, ...uploadedFiles]);
	};
	const onFileRejected: FileDropZoneProps['onFileRejected'] = async ({ reason, file }) => {
		toast.error(`${file.name} failed to upload!`, { description: reason });
	};

	const getAnthologyDownloadUrl = (anthologyId: string) =>
		resolve(
			`/api/anthologies/${anthologyId}/io${includeStoryDefinitions ? '?includeStories=true' : ''}`
		);

	const requestDeleteAnthology = (anthology: Anthology) => {
		anthologyToDelete = anthology;
		isDeleteDialogOpen = true;
	};

	const deleteAnthology = async () => {
		const anthology = anthologyToDelete;
		if (!anthology || deletingAnthologyId) return;

		deletingAnthologyId = anthology.id;
		try {
			const response = await fetch(
				resolve(
					`/api/anthologies/${anthology.id}${deleteUnderlyingStories ? '?deleteStories=true' : ''}`
				),
				{ method: 'DELETE' }
			);

			if (!response.ok) {
				const body = await response.json().catch(() => ({}));
				throw new Error(body.message ?? 'Failed to delete anthology.');
			}

			toast.success('Anthology deleted successfully.');
			isDeleteDialogOpen = false;
			anthologyToDelete = undefined;
			await invalidateAll();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to delete anthology.');
		} finally {
			deletingAnthologyId = undefined;
		}
	};
</script>

<Header>
	<BreadcrumbMenu
		menus={[
			[
				{ isTrigger: true, label: 'Anthologies', url: `/edit/anthologies` },
				{ label: 'Stories', url: `/edit/stories` }
			]
		]}
	/>
</Header>

{#if isEditorOpen}
	<Editor bind:isEditorOpen bind:anthology={anthologyToEdit} {data} />
{/if}

<AlertDialog.Root bind:open={isDeleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Media>
				<TrashIcon class="text-destructive" />
			</AlertDialog.Media>
			<AlertDialog.Title>Delete anthology?</AlertDialog.Title>
			<AlertDialog.Description>
				{#if deleteUnderlyingStories}
					This will permanently delete "{anthologyToDelete?.name}" and its underlying stories.
				{:else}
					This will permanently delete "{anthologyToDelete?.name}". The underlying stories will stay
					available.
				{/if}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={!!deletingAnthologyId}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				variant="destructive"
				disabled={!!deletingAnthologyId}
				onclick={(event) => {
					event.preventDefault();
					void deleteAnthology();
				}}
			>
				{#if deletingAnthologyId}
					<LoaderCircleIcon class="size-4 animate-spin" />
				{/if}
				Delete
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

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
							<span class="truncate pl-2">{anthology.slug}</span>
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
									<DropdownMenu.Separator />
									<DropdownMenu.Item>
										{#snippet child({ props })}
											<a href={getAnthologyDownloadUrl(anthology.id)} {...props}>
												<FileDownIcon />
												Download
											</a>
										{/snippet}
									</DropdownMenu.Item>
									<DropdownMenu.Item
										class="justify-between text-muted-foreground"
										onclick={(event) => {
											event.preventDefault();
											includeStoryDefinitions = !includeStoryDefinitions;
										}}
									>
										<span>Include stories</span>
										<Switch
											checked={includeStoryDefinitions}
											aria-label="Include story definitions in anthology downloads"
											onclick={(event) => event.stopPropagation()}
											onCheckedChange={(checked) => (includeStoryDefinitions = checked)}
										/>
									</DropdownMenu.Item>
									<DropdownMenu.Separator />
									<DropdownMenu.Item
										class="justify-between text-muted-foreground"
										onclick={(event) => {
											event.preventDefault();
											deleteUnderlyingStories = !deleteUnderlyingStories;
										}}
									>
										<span>Delete stories</span>
										<Switch
											checked={deleteUnderlyingStories}
											aria-label="Delete underlying stories when deleting an anthology"
											onclick={(event) => event.stopPropagation()}
											onCheckedChange={(checked) => (deleteUnderlyingStories = checked)}
										/>
									</DropdownMenu.Item>
									<DropdownMenu.Item
										class="text-destructive focus:text-destructive"
										disabled={deletingAnthologyId === anthology.id}
										onclick={(event) => {
											event.stopPropagation();
											requestDeleteAnthology(anthology);
										}}
									>
										{#if deletingAnthologyId === anthology.id}
											<LoaderCircleIcon class="animate-spin" />
										{:else}
											<TrashIcon />
										{/if}
										Delete
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
							href="/a/{anthology.slug}"
							target="_blank"
							disabled={!anthology.slug?.length}
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
						use:enhance={enhanceUpload}
						class="flex w-full flex-col gap-2"
					>
						<div class="space-y-2">
							<FileDropZone
								{onUpload}
								{onFileRejected}
								maxFileSize={50 * MEGABYTE}
								accept=".yml,.yaml,application/yaml,application/x-yaml"
								maxFiles={50}
								fileCount={attachmentList.length}
							/>
							<input
								name="attachments"
								type="file"
								bind:files={attachments}
								multiple
								class="hidden"
							/>
							{#if attachmentList.length}
								<ScrollArea class="h-32 rounded-md border p-4">
									<div class="flex flex-col gap-2">
										{#each attachmentList as file, i (file.name)}
											<div class="flex place-items-center justify-between gap-2">
												<div class="flex flex-col">
													<span>{file.name}</span>
													<span class="text-xs text-muted-foreground">{displaySize(file.size)}</span
													>
												</div>
												<Button
													type="button"
													variant="outline"
													size="icon"
													onclick={() =>
														setAttachments([
															...attachmentList.slice(0, i),
															...attachmentList.slice(i + 1)
														])}
												>
													<XIcon class="size-5" />
												</Button>
											</div>
										{/each}
									</div>
								</ScrollArea>
							{/if}
							{#if attachmentErrors.length}<div
									class="text-sm font-medium wrap-break-word whitespace-pre-line text-destructive"
									role="alert"
								>
									{#each attachmentErrors as error, i (`${error}-${i}`)}<div>{error}</div>{/each}
								</div>{/if}
						</div>
						<Button type="submit" class="w-full" disabled={uploadSubmission.delayed}>
							{#if uploadSubmission.delayed}<LoaderCircleIcon class="size-5 animate-spin" />
							{:else}<CheckIcon class="size-5" />{/if}
							<span>Upload</span>
						</Button>
					</form>
				</div>
			</div>
		</Popover.Content>
	</Popover.Root>
{/snippet}
