<script lang="ts">
	import { page } from '$app/state';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as ColorPicker from '$lib/components/ui/color-picker/index.js';
	import { CopyButton } from '$lib/components/ui/copy-button';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { MediaFileInput } from '$lib/components/ui/media-file-input/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Separator } from '$lib/components/ui/separator';
	import { Switch } from '$lib/components/ui/switch';
	import { TranslatableInput } from '$lib/components/ui/translatable-input';
	import type { findOneStoryById, storySchema } from '$lib/db/repositories/2-story-module';
	import {
		formatFormError,
		translateLocalizedMediaField,
		type Media,
		type TranslatableMedia
	} from '$lib/db/schemas/0-utils';
	import { UI } from '$lib/states/ui.svelte';
	import DeleteIcon from '@lucide/svelte/icons/delete';
	import Paintbrush from '@lucide/svelte/icons/paintbrush';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';
	import z from 'zod/v4';
	import type { $ZodIssue } from 'zod/v4/core';

	type Props = {
		storyId: string;
		story: Pick<
			Awaited<ReturnType<typeof findOneStoryById>>,
			'slug' | 'name' | 'defaultBackgroundColor' | 'thumbnail' | 'isPublished' | 'isPublic'
		>;
		close: (output: { action: 'persist' | 'delete'; data?: z.infer<typeof storySchema> }) => void;
	};
	let { storyId, story: rawstory, close }: Props = $props();

	// svelte-ignore state_referenced_locally
	let story = $state(rawstory);

	let error = $state<$ZodIssue[] | null>(null);
	let saveState = $state<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
	let isDeleteDialogOpen = $state(false);
	let isDeleting = $state(false);
	let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
	let saveVersion = 0;

	const persist = async (event?: Event, autosave = false) => {
		event?.preventDefault();
		clearTimeout(autosaveTimer);
		const version = ++saveVersion;
		saveState = 'saving';
		const request = (async () => {
			const result = await fetch(`/api/stories/${storyId}`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(story)
			});
			if (!result.ok) {
				if (result.status === 422) error = await result.json();
				throw new Error('Saving story settings failed');
			}
			return (await result.json()) as z.infer<typeof storySchema>;
		})();

		toast.promise(request, {
			loading: 'Saving story settings...',
			success: 'Story settings saved',
			error: 'Could not save story settings'
		});

		try {
			const saved = await request;
			if (version !== saveVersion) return;
			error = null;
			saveState = 'saved';
			if (!autosave) story = { ...story, ...saved };
			close({ action: 'persist', data: saved });
		} catch {
			if (version === saveVersion) saveState = 'error';
		}
	};
	const scheduleAutosave = () => {
		saveVersion += 1;
		saveState = 'dirty';
		clearTimeout(autosaveTimer);
		autosaveTimer = setTimeout(() => persist(undefined, true), 700);
	};
	const setDefaultBackgroundColor = (value: string) => {
		story.defaultBackgroundColor = value;
		scheduleAutosave();
	};
	const clearDefaultBackgroundColor = () => {
		if (story.defaultBackgroundColor === null) return;
		story.defaultBackgroundColor = null;
		scheduleAutosave();
	};
	const getMedia = (value?: TranslatableMedia | null) =>
		translateLocalizedMediaField(value, UI.language);
	const setTranslatedMedia = (value: Media | null, current?: TranslatableMedia | null) => {
		if (!value) {
			const next = { ...current };
			delete next[UI.language];
			return Object.keys(next).length ? next : null;
		}

		return {
			...current,
			...(current?.default || current?.en ? {} : { default: value }),
			[UI.language]: value
		};
	};
	const updateThumbnail = (value: Media | null) => {
		story.thumbnail = setTranslatedMedia(value, story.thumbnail);
		scheduleAutosave();
	};
	onDestroy(() => {
		clearTimeout(autosaveTimer);
		if (saveState === 'dirty') void persist(undefined, true);
	});
	const remove = async () => {
		if (!storyId?.length || isDeleting) return;
		isDeleting = true;
		try {
			const result = await fetch(`/api/stories/${storyId}`, {
				method: 'DELETE'
			});
			if (!result.ok) {
				toast.error(result.statusText ?? 'Something went wrong', {
					closeButton: true,
					duration: Infinity
				});
				if (result.status === 422) error = await result.json();
			} else {
				isDeleteDialogOpen = false;
				close({ action: 'delete' });
			}
		} finally {
			isDeleting = false;
		}
	};
</script>

<AlertDialog.Root bind:open={isDeleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Media>
				<TrashIcon class="text-destructive" />
			</AlertDialog.Media>
			<AlertDialog.Title>Delete story?</AlertDialog.Title>
			<AlertDialog.Description>
				This will permanently delete "{story.name?.default ?? story.slug}" and all of its parts and
				assets.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={isDeleting}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				variant="destructive"
				disabled={isDeleting}
				onclick={(event) => {
					event.preventDefault();
					void remove();
				}}
			>
				Delete
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<div class="flex flex-col">
	<form
		class="block w-full"
		onsubmit={persist}
		oninput={scheduleAutosave}
		onchange={scheduleAutosave}
	>
		<Field.Group class="gap-4">
			<Field.Field>
				<Field.Label>Slug</Field.Label>
				<Input bind:value={story.slug} placeholder="Slug..." />
				<Field.Error>
					{formatFormError(error, `slug`)}
				</Field.Error>
			</Field.Field>

			<Field.Field>
				<Field.Label>Name</Field.Label>
				<TranslatableInput bind:value={story.name} placeholder="Name..." languageselector={false} />
				<Field.Error>
					{formatFormError(error, `name`)}
				</Field.Error>
			</Field.Field>

			<Field.Field>
				<Field.Label>Thumbnail (optional)</Field.Label>
				<MediaFileInput
					value={getMedia(story.thumbnail)}
					accept="image/*"
					preview="image"
					placeholder="Thumbnail URL"
					onValueChange={updateThumbnail}
				/>
				<Field.Error>
					{formatFormError(error, `thumbnail.*.filename`)}
				</Field.Error>
			</Field.Field>

			<Field.Field>
				<Field.Label>Default background color</Field.Label>
				<div class="flex items-center gap-3">
					<div
						class="size-8 shrink-0 rounded-full border shadow-sm"
						style:background-color={story.defaultBackgroundColor}
					></div>
					<Popover.Root>
						<Popover.Trigger>
							{#snippet child({ props })}
								<Button
									{...props}
									type="button"
									variant="outline"
									class="grow justify-start text-left font-normal"
								>
									<Paintbrush class="mr-1 size-4" />
									{story.defaultBackgroundColor ?? 'Pick a color'}
								</Button>
							{/snippet}
						</Popover.Trigger>
						<Popover.Content class="w-auto border-none p-0 shadow-none">
							<ColorPicker.Root
								bind:value={
									() => story.defaultBackgroundColor ?? '#000000', setDefaultBackgroundColor
								}
								allowOpacity={true}
								defaultFormat="oklch"
							/>
						</Popover.Content>
					</Popover.Root>
					<Button
						type="button"
						variant="outline"
						size="icon"
						aria-label="Clear default background color"
						disabled={story.defaultBackgroundColor === null}
						onclick={clearDefaultBackgroundColor}
					>
						<DeleteIcon class="size-4" />
					</Button>
				</div>
				<Field.Error>{formatFormError(error, 'defaultBackgroundColor')}</Field.Error>
			</Field.Field>

			<Separator class="mb-3" />

			<Field.Field>
				<div class="flex items-center space-x-2">
					<Switch
						id="ispublished"
						checked={story.isPublished}
						onCheckedChange={(checked) => {
							story.isPublished = checked;
							scheduleAutosave();
						}}
					/>
					<Field.Label for="ispublished" class="text-sm font-normal">Is published?</Field.Label>
				</div>
				<div class="block">
					<CopyButton
						text={`${page.url.origin}/s/${story.slug}`}
						class="max-w-full"
						size="sm"
						variant="outline"
					>
						<span class="text-sm">Share url:</span>
						<span
							class="inline-block max-w-full truncate align-bottom font-mono text-sm font-light"
							class:line-through={!story.isPublished}
						>
							{`${page.url.origin}/s/${story.slug}`}
						</span>
					</CopyButton>
				</div>
				<Field.Error>
					{formatFormError(error, `isPublished`)}
				</Field.Error>
			</Field.Field>

			{#if story.isPublished}
				<Field.Field class="space-x-2">
					<div class="flex items-center space-x-2">
						<Switch id="ispublic" disabled checked={story.isPublic} />
						<Field.Label for="ispublic" class="text-sm font-normal">Is public?</Field.Label>
					</div>
					<Field.Error>
						{formatFormError(error, `isPublic`)}
					</Field.Error>
				</Field.Field>
			{/if}
		</Field.Group>
	</form>

	<div class="mt-auto flex w-full items-center justify-between gap-2 py-4">
		<span class="self-center text-xs text-muted-foreground" aria-live="polite">
			{saveState === 'saving'
				? 'Saving...'
				: saveState === 'dirty'
					? 'Unsaved changes'
					: saveState === 'error'
						? 'Save failed'
						: ''}
		</span>
		<Button
			class="ml-auto"
			variant="destructive"
			size="icon"
			disabled={isDeleting}
			onclick={() => (isDeleteDialogOpen = true)}
		>
			<TrashIcon />
		</Button>
	</div>
</div>
