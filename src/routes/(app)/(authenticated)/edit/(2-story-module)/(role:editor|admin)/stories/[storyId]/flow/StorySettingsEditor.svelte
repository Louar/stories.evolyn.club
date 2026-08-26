<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button/index.js';
	import { CopyButton } from '$lib/components/ui/copy-button';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Switch } from '$lib/components/ui/switch';
	import { TranslatableInput } from '$lib/components/ui/translatable-input';
	import type { findOneStoryById, storySchema } from '$lib/db/repositories/2-story-module';
	import { formatFormError } from '$lib/db/schemas/0-utils';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';
	import z from 'zod/v4';
	import type { $ZodIssue } from 'zod/v4/core';
	import EditorSurface from './EditorSurface.svelte';

	type Props = {
		storyId: string;
		embedded?: boolean;
		story: Pick<
			Awaited<ReturnType<typeof findOneStoryById>>,
			'slug' | 'name' | 'isPublished' | 'isPublic'
		>;
		close: (output: { action: 'persist' | 'delete'; data?: z.infer<typeof storySchema> }) => void;
	};
	let { storyId, story: rawstory, embedded = false, close }: Props = $props();

	// svelte-ignore state_referenced_locally
	let story = $state(rawstory);

	let error = $state<$ZodIssue[] | null>(null);
	let saveState = $state<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
	let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
	let saveVersion = 0;

	const persist = async (event?: Event) => {
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
			story = { ...story, ...saved };
			close({ action: 'persist', data: saved });
		} catch {
			if (version === saveVersion) saveState = 'error';
		}
	};
	const scheduleAutosave = () => {
		saveVersion += 1;
		saveState = 'dirty';
		clearTimeout(autosaveTimer);
		autosaveTimer = setTimeout(() => persist(), 700);
	};
	onDestroy(() => {
		clearTimeout(autosaveTimer);
		if (saveState === 'dirty') void persist();
	});
	const remove = async () => {
		if (!storyId?.length) return;
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
			close({ action: 'delete' });
		}
	};
</script>

<EditorSurface {embedded} class={embedded ? 'flex flex-col' : 'max-h-[90vh] pt-0 sm:max-w-200'}>
	<form
		class={embedded ? 'block w-full' : 'contents'}
		onsubmit={persist}
		oninput={scheduleAutosave}
		onchange={scheduleAutosave}
	>
		<Field.Group class="gap-2">
			<Field.Field>
				<Field.Label>Slug</Field.Label>
				<Input bind:value={story.slug} placeholder="Slug..." />
				<Field.Error>
					{formatFormError(error, `slug`)}
				</Field.Error>
			</Field.Field>

			<Field.Field>
				<Field.Label>Name</Field.Label>
				<TranslatableInput bind:value={story.name} placeholder="Name..." languageselector={true} />
				<Field.Error>
					{formatFormError(error, `name`)}
				</Field.Error>
			</Field.Field>

			<Field.Field class="space-x-2">
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
		<Button class="ml-auto" variant="destructive" size="icon" onclick={remove}>
			<TrashIcon />
		</Button>
	</div>
</EditorSurface>
