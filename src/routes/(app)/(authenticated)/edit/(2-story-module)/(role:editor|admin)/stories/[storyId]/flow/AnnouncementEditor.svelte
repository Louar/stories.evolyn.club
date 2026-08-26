<script lang="ts">
	import HeaderBlank from '$lib/components/app/header/app-header-blank.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { TranslatableInput } from '$lib/components/ui/translatable-input';
	import type { findOneAnnouncementById } from '$lib/db/repositories/2-story-module';
	import { formatFormError } from '$lib/db/schemas/0-utils';
	import { EDITORS } from '$lib/states/editors.svelte';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import XIcon from '@lucide/svelte/icons/x';
	import { onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type { $ZodIssue } from 'zod/v4/core';
	import EditorSurface from './EditorSurface.svelte';

	type Props = {
		storyId: string;
		selectedId?: string;
		embedded?: boolean;
		close: (output: {
			action: 'persist' | 'delete' | 'close';
			id?: string;
			announcement?: Awaited<ReturnType<typeof findOneAnnouncementById>>;
			keepOpen?: boolean;
		}) => void;
	};
	let { storyId, selectedId, embedded = false, close }: Props = $props();

	let announcements = $derived(EDITORS.announcements);

	const createDefaultAnnouncement = (): (typeof announcements)[number] => ({
		id: 'new',
		name: '',
		title: {},
		message: {}
	});
	const cloneAnnouncement = (value: (typeof announcements)[number]) =>
		structuredClone($state.snapshot(value));
	// svelte-ignore state_referenced_locally
	let announcement = $state(
		selectedId
			? cloneAnnouncement(
					EDITORS.announcements.find((item) => item.id === selectedId) ??
						createDefaultAnnouncement()
				)
			: createDefaultAnnouncement()
	);
	let error = $state<$ZodIssue[] | null>(null);
	let saveState = $state<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
	let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
	let saveVersion = 0;

	const persist = async (event?: Event, autosave = false) => {
		event?.preventDefault();
		clearTimeout(autosaveTimer);
		const version = ++saveVersion;
		saveState = 'saving';

		const request = (async () => {
			const result = await fetch(
				`/api/stories/${storyId}/announcements/${announcement.id ?? 'new'}`,
				{
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(announcement)
				}
			);
			if (!result.ok) {
				if (result.status === 422) error = await result.json();
				throw new Error('Saving announcement failed');
			}
			return await result.json();
		})();
		toast.promise(request, {
			loading: 'Saving announcement...',
			success: 'Announcement saved',
			error: 'Could not save announcement'
		});
		try {
			const saved = await request;
			if (version !== saveVersion) {
				if (announcement.id === 'new') announcement.id = saved.id;
				close({ action: 'persist', announcement: saved, keepOpen: true });
				return;
			}
			error = null;
			saveState = 'saved';
			announcement = cloneAnnouncement(saved);
			close({ action: 'persist', announcement: saved, keepOpen: autosave });
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
	onDestroy(() => {
		clearTimeout(autosaveTimer);
		if (saveState === 'dirty') void persist(undefined, true);
	});
	const remove = async () => {
		if (!announcement.id?.length) return;
		const result = await fetch(`/api/stories/${storyId}/announcements/${announcement.id}`, {
			method: 'DELETE'
		});
		if (!result.ok) {
			toast.error(result.statusText ?? 'Something went wrong', {
				closeButton: true,
				duration: Infinity
			});
			if (result.status === 422) error = await result.json();
		} else {
			close({ action: 'delete', id: announcement.id });
			announcement = createDefaultAnnouncement();
		}
	};
	const dismiss = () => close({ action: 'close' });
</script>

<EditorSurface
	{embedded}
	class="muted-scrollbar {embedded ? '' : 'max-h-[90vh] pt-0 sm:max-w-200'}"
>
		<HeaderBlank class="w-full">
			<div class="px-2">
				<h1 class="truncate overflow-hidden text-sm whitespace-nowrap">
					{announcement.id === 'new' ? 'New announcement' : 'Edit announcement'}
				</h1>
				<p class="self-center text-xs text-muted-foreground" aria-live="polite">
					{saveState === 'saving'
						? 'Saving...'
						: saveState === 'saved'
							? 'Saved'
							: saveState === 'error'
								? 'Save failed'
								: saveState === 'dirty'
									? 'Unsaved changes'
									: 'No changes'}
				</p>
			</div>
			<div class="ml-auto flex items-center gap-2">
				{#if announcement.id && announcement.id !== 'new'}
					<Button variant="destructive" size="icon" onclick={remove}><TrashIcon /></Button>
				{/if}
				<Button variant="ghost" size="icon" onclick={dismiss}><XIcon /></Button>
			</div>
		</HeaderBlank>
	<form
		class={embedded ? 'block p-4' : 'contents'}
		onsubmit={persist}
		oninput={scheduleAutosave}
		onchange={scheduleAutosave}
	>
		<Field.Group class="gap-2">
			<Field.Field>
				<Field.Label>Announcement reference name</Field.Label>
				<Input bind:value={announcement.name} placeholder="Name..." />
				<Field.Error>
					{formatFormError(error, `name`)}
				</Field.Error>
			</Field.Field>
			<Field.Field>
				<Field.Label>Title (optional)</Field.Label>
				<TranslatableInput bind:value={announcement.title} placeholder="Title..." />
				<Field.Error>
					{formatFormError(error, `title.*`)}
				</Field.Error>
			</Field.Field>
			<Field.Field>
				<Field.Label>Message (optional)</Field.Label>
				<TranslatableInput bind:value={announcement.message} placeholder="Message..." />
				<Field.Error>
					{formatFormError(error, `message.*`)}
				</Field.Error>
			</Field.Field>
		</Field.Group>
	</form>
</EditorSurface>
