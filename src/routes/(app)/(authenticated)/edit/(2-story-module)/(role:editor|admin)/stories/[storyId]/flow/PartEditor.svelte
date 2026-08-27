<script lang="ts">
	import HeaderBlank from '$lib/components/app/header/app-header-blank.svelte';
	import * as ButtonGroup from '$lib/components/ui/button-group/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import type {
		findOneQuizLogicById,
		findOneStoryById
	} from '$lib/db/repositories/2-story-module.js';
	import { EDITORS } from '$lib/states/editors.svelte.js';
	import BanIcon from '@lucide/svelte/icons/ban';
	import ImageIcon from '@lucide/svelte/icons/image';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import ShapesIcon from '@lucide/svelte/icons/shapes';
	import VideoIcon from '@lucide/svelte/icons/video';
	import XIcon from '@lucide/svelte/icons/x';
	import { onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';
	import QuizLogicEditor from './QuizLogicEditor.svelte';
	import ResourceCombobox from './ResourceCombobox.svelte';
	import TaxonomyLogicEditor from './TaxonomyLogicEditor.svelte';

	type Story = Awaited<ReturnType<typeof findOneStoryById>>;
	type Part = Story['parts'][number];
	type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

	let {
		storyId,
		part,
		onSave,
		onDismiss
	}: {
		storyId: string;
		part: Part;
		onSave: (part: Part) => void;
		onDismiss: () => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	let draft = $state(structuredClone($state.snapshot(part)));
	let saveState = $state<SaveState>('idle');
	let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
	let saveVersion = 0;
	let stillItems = $derived(
		EDITORS.stills.map((item) => ({
			value: item.id,
			label: item.image?.filename ?? item.color ?? 'Untitled still',
			description: item.style ?? undefined
		}))
	);
	let videoItems = $derived(
		EDITORS.videos.map((item) => ({
			value: item.id,
			label: item.name,
			description: `${Math.round(item.duration)} seconds`
		}))
	);
	let announcementItems = $derived(
		EDITORS.announcements.map((item) => ({ value: item.id, label: item.name }))
	);
	let quizItems = $derived(
		EDITORS.quizzes.map((item) => ({
			value: item.id,
			label: item.name,
			description: `${item.questions.length} questions`
		}))
	);
	let taxonomyItems = $derived(
		EDITORS.taxonomies.map((item) => ({ value: item.id, label: item.name }))
	);
	let quiz = $derived(EDITORS.quizzes.find((item) => item.id === draft.quizTemplateId));

	const clonePart = (value: Part) => structuredClone($state.snapshot(value));

	const persist = async (event?: Event, autosave = false) => {
		event?.preventDefault();
		clearTimeout(autosaveTimer);
		const version = ++saveVersion;
		saveState = 'saving';

		const request = (async () => {
			const result = await fetch(`/api/stories/${storyId}/parts/${draft.id}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(draft)
			});
			if (!result.ok) throw new Error('Saving part failed');
			return (await result.json()) as Part;
		})();

		toast.promise<Part>(request, {
			loading: 'Saving part...',
			success: 'Part saved',
			error: 'Could not save part'
		});

		try {
			const saved = await request;
			if (version !== saveVersion) return;
			saveState = 'saved';
			if (!autosave) draft = clonePart(saved);
			onSave(saved);
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

	const setBackgroundType = (value: string) => {
		draft.backgroundType = value === 'still' || value === 'video' ? value : null;
		if (draft.backgroundType !== 'still') draft.stillId = null;
		if (draft.backgroundType !== 'video') draft.videoId = null;
		scheduleAutosave();
	};

	const setForegroundType = (value: string) => {
		draft.foregroundType =
			value === 'announcement' || value === 'quiz' || value === 'taxonomy' ? value : null;
		if (draft.foregroundType !== 'announcement') draft.announcementTemplateId = null;
		if (draft.foregroundType !== 'quiz') draft.quizTemplateId = null;
		if (draft.foregroundType !== 'taxonomy') draft.taxonomyId = null;
		scheduleAutosave();
	};

	const setConfiguration = (
		section: 'backgroundConfiguration' | 'foregroundConfiguration',
		key: 'start' | 'end',
		value: string
	) => {
		const parsed = Number(value);
		draft[section] = {
			...draft[section],
			[key]: Number.isFinite(parsed) ? parsed : undefined
		} as (typeof draft)[typeof section];
	};

	const saveQuizLogic = (output: {
		action: 'persist' | 'delete';
		id?: string;
		logic?: Awaited<ReturnType<typeof findOneQuizLogicById>>;
	}) => {
		if (output.action !== 'persist' || !output.logic) return;
		draft.quizLogicForPart = output.logic;
		onSave(clonePart(draft));
	};

	const saveTaxonomyLogic = (taxonomyDraft?: NonNullable<Part['taxonomyDraftForPart']>) => {
		if (!taxonomyDraft) return;
		draft.taxonomyDraftForPart = taxonomyDraft;
		onSave(clonePart(draft));
	};
</script>

<HeaderBlank class="w-full">
	<div>
		<p class="text-xs font-medium tracking-wider text-muted-foreground uppercase">Part</p>
		<!-- <h2 class="font-mono text-sm font-semibold">{draft.id}</h2> -->
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
		<Button variant="ghost" size="icon" onclick={onDismiss}><XIcon /></Button>
	</div>
</HeaderBlank>

<div
	class="h-[calc(100svh-(--spacing(16)))] muted-scrollbar overflow-y-auto"
	oninput={scheduleAutosave}
	onchange={scheduleAutosave}
>
	<HeaderBlank class="h-12 w-full bg-muted/50">
		<div class="size-full">
			<h1
				class="flex items-center gap-2 truncate overflow-hidden text-sm font-medium whitespace-nowrap"
			>
				Background
			</h1>
		</div>
	</HeaderBlank>
	<Field.Set class="grid gap-4 p-4">
		<Field.Field>
			<Field.Label>Type</Field.Label>
			<ButtonGroup.Root class="w-full">
				<Button
					type="button"
					variant={!draft.backgroundType ? 'default' : 'outline'}
					class="flex-1"
					aria-pressed={!draft.backgroundType}
					onclick={() => setBackgroundType('none')}><BanIcon />None</Button
				>
				<Button
					type="button"
					variant={draft.backgroundType === 'still' ? 'default' : 'outline'}
					class="flex-1"
					aria-pressed={draft.backgroundType === 'still'}
					onclick={() => setBackgroundType('still')}><ImageIcon />Still</Button
				>
				<Button
					type="button"
					variant={draft.backgroundType === 'video' ? 'default' : 'outline'}
					class="flex-1"
					aria-pressed={draft.backgroundType === 'video'}
					onclick={() => setBackgroundType('video')}><VideoIcon />Video</Button
				>
			</ButtonGroup.Root>
		</Field.Field>

		{#if draft.backgroundType === 'still'}
			<Field.Field>
				<Field.Label>Still</Field.Label>
				<ResourceCombobox
					items={stillItems}
					value={draft.stillId}
					placeholder="Select a still"
					searchPlaceholder="Search stills..."
					emptyText="No stills found."
					onValueChange={(value) => {
						draft.stillId = value;
						scheduleAutosave();
					}}
				/>
			</Field.Field>
		{:else if draft.backgroundType === 'video'}
			<Field.Field>
				<Field.Label>Video</Field.Label>
				<ResourceCombobox
					items={videoItems}
					value={draft.videoId}
					placeholder="Select a video"
					searchPlaceholder="Search videos..."
					emptyText="No videos found."
					onValueChange={(value) => {
						draft.videoId = value;
						scheduleAutosave();
					}}
				/>
			</Field.Field>
			<div class="grid grid-cols-2 gap-3">
				<Field.Field
					><Field.Label>Start</Field.Label><Input
						type="number"
						min="0"
						step="0.01"
						value={draft.backgroundConfiguration?.start ?? 0}
						oninput={(event) =>
							setConfiguration('backgroundConfiguration', 'start', event.currentTarget.value)}
					/></Field.Field
				>
				<Field.Field
					><Field.Label>End</Field.Label><Input
						type="number"
						min="0"
						step="0.01"
						value={draft.backgroundConfiguration?.end ?? 1}
						oninput={(event) =>
							setConfiguration('backgroundConfiguration', 'end', event.currentTarget.value)}
					/></Field.Field
				>
			</div>
		{/if}
	</Field.Set>

	<Separator />

	<HeaderBlank class="h-12 w-full bg-muted/50">
		<div class="size-full">
			<h1
				class="flex items-center gap-2 truncate overflow-hidden text-sm font-medium whitespace-nowrap"
			>
				Foreground
			</h1>
		</div>
	</HeaderBlank>

	<Field.Set class="grid gap-4 p-4">
		<Field.Field>
			<Field.Label>Type</Field.Label>
			<ButtonGroup.Root class="w-full">
				<Button
					type="button"
					variant={!draft.foregroundType ? 'default' : 'outline'}
					class="flex-1 text-xs"
					aria-pressed={!draft.foregroundType}
					onclick={() => setForegroundType('none')}><BanIcon />None</Button
				>
				<Button
					type="button"
					variant={draft.foregroundType === 'announcement' ? 'default' : 'outline'}
					class="flex-1 text-xs"
					aria-pressed={draft.foregroundType === 'announcement'}
					onclick={() => setForegroundType('announcement')}><MessageSquareIcon />Note</Button
				>
				<Button
					type="button"
					variant={draft.foregroundType === 'quiz' ? 'default' : 'outline'}
					class="flex-1 text-xs"
					aria-pressed={draft.foregroundType === 'quiz'}
					onclick={() => setForegroundType('quiz')}><ShapesIcon />Quiz</Button
				>
				<Button
					type="button"
					variant={draft.foregroundType === 'taxonomy' ? 'default' : 'outline'}
					class="flex-1 text-xs"
					aria-pressed={draft.foregroundType === 'taxonomy'}
					onclick={() => setForegroundType('taxonomy')}><LayersIcon />Taxonomy</Button
				>
			</ButtonGroup.Root>
		</Field.Field>

		{#if draft.foregroundType === 'announcement'}
			<Field.Field>
				<Field.Label>Announcement</Field.Label>
				<ResourceCombobox
					items={announcementItems}
					value={draft.announcementTemplateId}
					placeholder="Select an announcement"
					searchPlaceholder="Search announcements..."
					emptyText="No announcements found."
					onValueChange={(value) => {
						draft.announcementTemplateId = value;
						scheduleAutosave();
					}}
				/>
			</Field.Field>
		{:else if draft.foregroundType === 'quiz'}
			<Field.Field>
				<Field.Label>Quiz</Field.Label>
				<ResourceCombobox
					items={quizItems}
					value={draft.quizTemplateId}
					placeholder="Select a quiz"
					searchPlaceholder="Search quizzes..."
					emptyText="No quizzes found."
					onValueChange={(value) => {
						draft.quizTemplateId = value;
						scheduleAutosave();
					}}
				/>
			</Field.Field>
		{:else if draft.foregroundType === 'taxonomy'}
			<Field.Field>
				<Field.Label>Taxonomy</Field.Label>
				<ResourceCombobox
					items={taxonomyItems}
					value={draft.taxonomyId}
					placeholder="Select a taxonomy"
					searchPlaceholder="Search taxonomies..."
					emptyText="No taxonomies found."
					onValueChange={(value) => {
						draft.taxonomyId = value;
						scheduleAutosave();
					}}
				/>
			</Field.Field>
		{/if}

		{#if draft.foregroundType && draft.backgroundType === 'video'}
			<Field.Field>
				<Field.Label>Start</Field.Label>
				<Input
					type="number"
					min="0"
					step="0.01"
					value={draft.foregroundConfiguration?.start ?? 0.5}
					oninput={(event) =>
						setConfiguration('foregroundConfiguration', 'start', event.currentTarget.value)}
				/>
			</Field.Field>
		{/if}
	</Field.Set>

	{#if draft.foregroundType === 'quiz' && quiz}
		<Separator />
		<div oninput={(event) => event.stopPropagation()} onchange={(event) => event.stopPropagation()}>
			<QuizLogicEditor
				{storyId}
				partId={draft.id}
				rules={draft.quizLogicForPart?.rules ?? []}
				{quiz}
				close={saveQuizLogic}
			/>
		</div>
	{:else if draft.foregroundType === 'taxonomy' && draft.taxonomyDraftForPart}
		<Separator />
		<div oninput={(event) => event.stopPropagation()} onchange={(event) => event.stopPropagation()}>
			<TaxonomyLogicEditor
				{storyId}
				partId={draft.id}
				draft={draft.taxonomyDraftForPart}
				close={saveTaxonomyLogic}
			/>
		</div>
	{/if}
</div>
