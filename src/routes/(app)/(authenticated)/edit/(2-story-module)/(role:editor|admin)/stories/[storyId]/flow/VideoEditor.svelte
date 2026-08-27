<script lang="ts">
	import HeaderBlank from '$lib/components/app/header/app-header-blank.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import type { findOneVideoById } from '$lib/db/repositories/2-story-module';
	import {
		formatFormError,
		MediaCollection,
		translateLocalizedMediaField,
		type TranslatableMedia
	} from '$lib/db/schemas/0-utils';
	import { EDITORS } from '$lib/states/editors.svelte';
	import { UI } from '$lib/states/ui.svelte';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import CircleXIcon from '@lucide/svelte/icons/circle-x';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import XIcon from '@lucide/svelte/icons/x';
	import { onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { z } from 'zod/v4';
	import type { $ZodIssue } from 'zod/v4/core';
	import VideoValidator from './VideoValidator.svelte';

	type Props = {
		storyId: string;
		selectedId?: string;
		close: (output: {
			action: 'persist' | 'delete' | 'close';
			id?: string;
			video?: Awaited<ReturnType<typeof findOneVideoById>>;
			keepOpen?: boolean;
		}) => void;
	};
	let { storyId, selectedId, close }: Props = $props();

	// Initialize quiz from quizzes prop or use default
	const createDefaultVideo = (): (typeof EDITORS.videos)[number] => ({
		id: 'new',
		name: '',
		source: {},
		thumbnail: null,
		captions: {},
		duration: 0
	});
	const cloneVideo = (value: (typeof EDITORS.videos)[number]) =>
		structuredClone($state.snapshot(value));
	// svelte-ignore state_referenced_locally
	let video = $state(
		selectedId
			? cloneVideo(EDITORS.videos.find((item) => item.id === selectedId) ?? createDefaultVideo())
			: createDefaultVideo()
	);
	let error = $state<$ZodIssue[] | null>(null);
	let saveState = $state<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
	let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
	let saveVersion = 0;

	let isLoading = $state(false);
	let hasError: boolean | undefined = $state(undefined);
	let src = $state<string | undefined>();

	const persist = async (event?: Event, autosave = false) => {
		event?.preventDefault();
		clearTimeout(autosaveTimer);
		const version = ++saveVersion;
		saveState = 'saving';

		const request = (async () => {
			const result = await fetch(`/api/stories/${storyId}/videos/${video.id ?? 'new'}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(video)
			});
			if (!result.ok) {
				if (result.status === 422) error = await result.json();
				throw new Error('Saving video failed');
			}
			return await result.json();
		})();
		toast.promise(request, {
			loading: 'Saving video...',
			success: 'Video saved',
			error: 'Could not save video'
		});
		try {
			const saved = await request;
			if (version !== saveVersion) {
				if (video.id === 'new') video.id = saved.id;
				close({ action: 'persist', video: saved, keepOpen: true });
				return;
			}
			error = null;
			saveState = 'saved';
			if (autosave) video.id = saved.id;
			else video = cloneVideo(saved);
			close({ action: 'persist', video: saved, keepOpen: autosave });
		} catch {
			if (version === saveVersion) saveState = 'error';
		}
	};
	const scheduleAutosave = () => {
		if (isLoading || hasError) return;
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
		if (!video.id?.length) return;
		const result = await fetch(`/api/stories/${storyId}/videos/${video.id}`, {
			method: 'DELETE'
		});
		if (!result.ok) {
			toast.error(result.statusText ?? 'Something went wrong', {
				closeButton: true,
				duration: Infinity
			});
			if (result.status === 422) error = await result.json();
		} else {
			close({ action: 'delete', id: video.id });
			video = createDefaultVideo();
		}
	};
	const dismiss = () => close({ action: 'close' });

	const setError = async (error: boolean | undefined) => {
		hasError = error;
		src = undefined;
		isLoading = false;
	};
	const setDuration = async (duration: number | undefined) => {
		if (duration) video.duration = duration;
		else video.duration = 0;
		scheduleAutosave();
	};

	const getMediaFilename = (value?: TranslatableMedia | null) => {
		return translateLocalizedMediaField(value, UI.language)?.filename ?? '';
	};

	const setExternalMedia = (value: string, current?: TranslatableMedia | null) => {
		if (!value.length) {
			const next = { ...current };
			delete next[UI.language];
			return Object.keys(next).length ? next : null;
		}

		const media = {
			collection: MediaCollection.externals,
			filename: value
		};

		return {
			...current,
			...(current?.default || current?.en ? {} : { default: media }),
			[UI.language]: media
		};
	};
</script>

<div class="muted-scrollbar">
	<HeaderBlank class="w-full">
		<div class="px-2">
			<h1 class="truncate overflow-hidden text-sm whitespace-nowrap">
				{video.id === 'new' ? 'New video' : 'Edit video'}
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
			{#if video.id && video.id !== 'new'}
				<Button variant="destructive" size="icon" onclick={remove}><TrashIcon /></Button>
			{/if}
			<Button variant="ghost" size="icon" onclick={dismiss}><XIcon /></Button>
		</div>
	</HeaderBlank>
	<form class="block p-4" onsubmit={persist} oninput={scheduleAutosave} onchange={scheduleAutosave}>
		<Field.Group class="gap-2">
			<Field.Field>
				<Field.Label>Video reference name</Field.Label>
				<Input bind:value={video.name} placeholder="Name..." />
				<Field.Error>
					{formatFormError(error, `name`)}
				</Field.Error>
			</Field.Field>
			<Field.Field>
				<Field.Label>
					Source
					{#if isLoading}
						<LoaderIcon class="size-4 animate-spin text-muted-foreground" />
					{/if}
					{#if !isLoading && hasError === false}
						<CircleCheckIcon
							class="size-4 rounded-full border border-emerald-500 bg-emerald-500 text-white"
						/>
					{:else if !isLoading && hasError === true}
						<CircleXIcon
							class="size-4 rounded-full border border-rose-500 bg-rose-500 text-white"
						/>
					{/if}
				</Field.Label>
				<Input
					value={getMediaFilename(video.source)}
					placeholder=".m3u8 stream URL, or YouTube URL"
					oninput={(e) => {
						const value = e.currentTarget.value;
						video.source = setExternalMedia(value, video.source) ?? {};
						const url = z.url().min(1).safeParse(value)?.data;
						src = url;
						if (url?.length) isLoading = true;
					}}
				/>
				<Field.Error>
					{formatFormError(error, `source.*.filename`)}
				</Field.Error>

				{#if src?.length}
					<VideoValidator {src} {setError} {setDuration} />
				{/if}
			</Field.Field>
			<Field.Field>
				<Field.Label>Thumbnail (optional)</Field.Label>
				<Input
					value={getMediaFilename(video.thumbnail)}
					placeholder="Thumbnail URL"
					oninput={(e) =>
						(video.thumbnail = setExternalMedia(e.currentTarget.value, video.thumbnail))}
				/>
				<Field.Error>
					{formatFormError(error, `thumbnail.*.filename`)}
				</Field.Error>
			</Field.Field>
			<Field.Field>
				<Field.Label>Duration (in seconds)</Field.Label>
				<Input
					type="number"
					bind:value={video.duration}
					placeholder="Duration..."
					class="text-muted-foreground"
				/>
				<Field.Error>
					{formatFormError(error, `duration`)}
				</Field.Error>
			</Field.Field>
		</Field.Group>
	</form>
</div>
