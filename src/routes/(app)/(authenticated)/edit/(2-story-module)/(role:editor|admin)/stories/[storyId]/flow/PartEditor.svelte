<script lang="ts">
	import HeaderBlank from '$lib/components/app/header/app-header-blank.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as ButtonGroup from '$lib/components/ui/button-group/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Scrubbable from '$lib/components/ui/scrubbable/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import type {
		findOneQuizLogicById,
		findOneStoryById
	} from '$lib/db/repositories/2-story-module.js';
	import {
		MediaCollection,
		translateLocalizedMediaField,
		type Media
	} from '$lib/db/schemas/0-utils.js';
	import { PartTerminationStrategy } from '$lib/db/schemas/2-story-module.js';
	import { getVideoSourceType, getYouTubeAlignedValue } from '$lib/media/video.js';
	import { EDITORS } from '$lib/states/editors.svelte.js';
	import { UI } from '$lib/states/ui.svelte.js';
	import BanIcon from '@lucide/svelte/icons/ban';
	import ClapperboardIcon from '@lucide/svelte/icons/clapperboard';
	import ImageIcon from '@lucide/svelte/icons/image';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import MagnetIcon from '@lucide/svelte/icons/magnet';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import ShapesIcon from '@lucide/svelte/icons/shapes';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import VideoIcon from '@lucide/svelte/icons/video';
	import XIcon from '@lucide/svelte/icons/x';
	import { onDestroy, untrack } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { toast } from 'svelte-sonner';
	import QuizLogicEditor from './QuizLogicEditor.svelte';
	import ResourceCombobox from './ResourceCombobox.svelte';
	import type { PartResourceEditorSelection } from './ResourceInspector.svelte';
	import TaxonomyLogicEditor from './TaxonomyLogicEditor.svelte';
	import VideoFramePreview from './VideoFramePreview.svelte';

	type Story = Awaited<ReturnType<typeof findOneStoryById>>;
	type Part = Story['parts'][number];
	type PartWithMergedMedia = Part & { background?: unknown; foreground?: unknown };
	type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
	const SNAP_THRESHOLD = 0.006;

	let {
		story,
		storyId,
		part,
		onSave,
		onDelete,
		onOpenResource,
		onDismiss,
		initialScrollTop = 0,
		onScroll
	}: {
		story: Story;
		storyId: string;
		part: Part;
		onSave: (part: Part) => void;
		onDelete: (partId: string) => void;
		onOpenResource: (selection: PartResourceEditorSelection) => void;
		onDismiss: () => void;
		initialScrollTop?: number;
		onScroll?: (scrollTop: number) => void;
	} = $props();
	let scrollTimer: ReturnType<typeof setTimeout> | undefined;
	let pendingScrollTop = 0;
	const restoreScroll: Attachment<HTMLDivElement> = (element) => {
		pendingScrollTop = untrack(() => initialScrollTop);
		element.scrollTop = pendingScrollTop;
	};
	const scheduleScrollPersistence = (scrollTop: number) => {
		pendingScrollTop = scrollTop;
		clearTimeout(scrollTimer);
		scrollTimer = setTimeout(() => onScroll?.(pendingScrollTop), 150);
	};

	// svelte-ignore state_referenced_locally
	let draft = $state(structuredClone($state.snapshot(part)));
	let saveState = $state<SaveState>('idle');
	let isDeleteDialogOpen = $state(false);
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
	let animationItems = $derived(
		EDITORS.animations.map((item) => ({ value: item.id, label: item.name }))
	);
	let quizItems = $derived(
		EDITORS.quizzes.map((item) => ({
			value: item.id,
			label: item.name,
			description: `${item.questions.length} questions`
		}))
	);
	let taxonomyItems = $derived(
		EDITORS.taxonomies.map((item) => ({ value: item.id, label: item.name?.en ?? item.slug }))
	);
	let quiz = $derived(EDITORS.quizzes.find((item) => item.id === draft.quizTemplateId));
	let selectedVideo = $derived(EDITORS.videos.find((item) => item.id === draft.videoId));
	let selectedAnimation = $derived(
		EDITORS.animations.find((item) => item.id === draft.animationId)
	);
	let selectedVideoSource = $derived(
		translateLocalizedMediaField(selectedVideo?.source, UI.language)
	);
	let selectedVideoUrl = $derived(mediaUrl(selectedVideoSource));
	let selectedVideoSourceType = $derived(
		selectedVideoUrl ? getVideoSourceType(selectedVideoUrl) : undefined
	);
	let selectedVideoDuration = $derived(
		draft.backgroundType === 'animation' && selectedAnimation
			? selectedAnimation.duration
			: (selectedVideo?.duration ?? videoDurationFromPart(draft))
	);
	let videoScrubberStep = $derived(
		selectedVideoSourceType === 'youtube' && selectedVideoDuration > 0
			? 1 / selectedVideoDuration
			: 0.0025
	);
	let videoScrubberKeyboardStep = $derived(
		selectedVideoSourceType === 'youtube' && selectedVideoDuration > 0 ? videoScrubberStep : 0.0005
	);
	let backgroundStart = $derived(
		draft.backgroundType === 'animation'
			? 0
			: configurationValue(draft, 'backgroundConfiguration', 'start', 0)
	);
	let backgroundEnd = $derived(
		draft.backgroundType === 'animation'
			? 1
			: configurationValue(draft, 'backgroundConfiguration', 'end', 1)
	);
	let foregroundStart = $derived(
		configurationValue(draft, 'foregroundConfiguration', 'start', 0.5)
	);
	let foregroundStartMin = $derived(Math.min(backgroundStart, backgroundEnd));
	let foregroundStartMax = $derived(Math.max(backgroundStart, backgroundEnd));
	let videoSnapValues = $derived.by(() => {
		const values = story.parts
			.filter((item) => item.id !== draft.id && item.videoId === draft.videoId)
			.flatMap((item) => [
				configurationValue(item, 'backgroundConfiguration', 'start', NaN),
				configurationValue(item, 'backgroundConfiguration', 'end', NaN)
			])
			.filter((value) => Number.isFinite(value) && value >= 0 && value <= 1);

		return [
			...new Set(
				values.map((value) =>
					selectedVideoSourceType === 'youtube'
						? getYouTubeAlignedValue(value, selectedVideoDuration)
						: value
				)
			)
		].sort((a, b) => a - b);
	});
	let terminationStrategyItems = [
		{
			value: PartTerminationStrategy.none,
			label: 'None',
			description: 'Continue through outgoing connections.'
		},
		{
			value: PartTerminationStrategy.completeStory,
			label: 'Complete story',
			description: 'End the story successfully when this part finishes.'
		},
		{
			value: PartTerminationStrategy.failStory,
			label: 'Fail story',
			description: 'End the story unsuccessfully when this part finishes.'
		}
	] as const;
	let selectedTerminationStrategy = $derived(
		terminationStrategyItems.find(
			(item) => item.value === (draft.terminationStrategy ?? PartTerminationStrategy.none)
		) ?? terminationStrategyItems[0]
	);

	const clonePart = (value: Part) => structuredClone($state.snapshot(value));
	function mediaUrl(media?: Media | null) {
		if (!media) return undefined;
		return media.collection === MediaCollection.externals
			? media.filename
			: `/api/media/${media.collection}/${media.filename}`;
	}
	function isRecord(value: unknown): value is Record<string, unknown> {
		return !!value && typeof value === 'object';
	}
	function videoDurationFromPart(value: PartWithMergedMedia) {
		return isRecord(value.background) && typeof value.background.duration === 'number'
			? value.background.duration
			: 0;
	}
	function configurationValue(
		value: PartWithMergedMedia,
		section: 'backgroundConfiguration' | 'foregroundConfiguration',
		key: 'start' | 'end',
		fallback: number
	) {
		const configured = value[section]?.[key];
		if (typeof configured === 'number') return configured;

		const merged = section === 'backgroundConfiguration' ? value.background : value.foreground;
		if (isRecord(merged) && typeof merged[key] === 'number') return merged[key];

		return fallback;
	}
	function formatVideoTime(percentage: number) {
		if (!selectedVideoDuration) return `${percentage.toFixed(3)}x`;
		const seconds =
			selectedVideoSourceType === 'youtube'
				? Math.round(selectedVideoDuration * percentage)
				: selectedVideoDuration * percentage;
		const wholeSeconds = Math.floor(seconds);
		const centiseconds = Math.floor((seconds - wholeSeconds) * 100);
		return `${[Math.floor((wholeSeconds / 60) % 60), wholeSeconds % 60]
			.join(':')
			.replace(/\b(\d)\b/g, '0$1')}.${centiseconds.toString().padStart(2, '0')}`;
	}
	function formatForegroundStart(value: number) {
		const offset = Math.max(0, value - backgroundStart);
		return formatVideoTime(offset);
	}
	function clampConfigurationValue(value: number, min: number, max: number) {
		return Math.max(min, Math.min(max, value));
	}
	function normalizeVideoConfigurationValue(value: number) {
		return selectedVideoSourceType === 'youtube'
			? getYouTubeAlignedValue(value, selectedVideoDuration)
			: value;
	}
	function isSnapValue(value: number) {
		return videoSnapValues.some((snapValue) => Math.abs(snapValue - value) <= SNAP_THRESHOLD);
	}
	function isBackgroundSnapSelectable(key: 'start' | 'end', value: number) {
		return key === 'start' ? value <= backgroundEnd : value >= backgroundStart;
	}
	function setConfigurationValue(
		section: 'backgroundConfiguration' | 'foregroundConfiguration',
		key: 'start' | 'end',
		value: number
	) {
		const nextValue = normalizeVideoConfigurationValue(value);
		draft[section] = {
			...draft[section],
			[key]: nextValue
		} as (typeof draft)[typeof section];
		scheduleAutosave();
	}
	function setForegroundConfigurationValue(value: number) {
		setConfigurationValue(
			'foregroundConfiguration',
			'start',
			clampConfigurationValue(
				normalizeVideoConfigurationValue(value),
				foregroundStartMin,
				foregroundStartMax
			)
		);
	}
	function setTerminationStrategy(value: string) {
		draft.terminationStrategy = Object.values(PartTerminationStrategy).includes(
			value as Part['terminationStrategy']
		)
			? (value as Part['terminationStrategy'])
			: PartTerminationStrategy.none;
		scheduleAutosave();
	}
	function setBackgroundConfigurationValue(key: 'start' | 'end', value: number) {
		const normalizedValue = normalizeVideoConfigurationValue(value);
		const boundedValue =
			key === 'start'
				? clampConfigurationValue(normalizedValue, 0, backgroundEnd)
				: clampConfigurationValue(normalizedValue, backgroundStart, 1);
		const previousStart = backgroundStart;
		const previousForegroundOffset = Math.max(0, foregroundStart - previousStart);
		const nextStart = key === 'start' ? boundedValue : backgroundStart;
		const nextEnd = key === 'end' ? boundedValue : backgroundEnd;

		draft.backgroundConfiguration = {
			...draft.backgroundConfiguration,
			[key]: boundedValue
		} as typeof draft.backgroundConfiguration;

		if (draft.foregroundType) {
			draft.foregroundConfiguration = {
				...draft.foregroundConfiguration,
				start: clampConfigurationValue(
					normalizeVideoConfigurationValue(nextStart + previousForegroundOffset),
					nextStart,
					nextEnd
				)
			} as typeof draft.foregroundConfiguration;
		}

		scheduleAutosave();
	}

	const persist = async (event?: Event) => {
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
			draft = clonePart(saved);
			onSave(saved);
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
	const openResourceEditor = async (selection: PartResourceEditorSelection) => {
		if (saveState === 'dirty') await persist();
		if (saveState === 'error') return;
		onOpenResource(selection);
	};

	onDestroy(() => {
		clearTimeout(autosaveTimer);
		clearTimeout(scrollTimer);
		onScroll?.(pendingScrollTop);
		if (saveState === 'dirty') void persist();
	});

	const setBackgroundType = (value: string) => {
		draft.backgroundType =
			value === 'still' || value === 'video' || value === 'animation' ? value : null;
		if (draft.backgroundType !== 'still') draft.stillId = null;
		if (draft.backgroundType !== 'video') draft.videoId = null;
		if (draft.backgroundType !== 'animation') draft.animationId = null;
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

	const remove = async () => {
		if (!draft.id?.length || saveState === 'saving') return;
		clearTimeout(autosaveTimer);
		saveVersion += 1;

		const result = await fetch(`/api/stories/${storyId}/parts/${draft.id}`, { method: 'DELETE' });
		if (!result.ok) {
			saveState = 'error';
			toast.error('Deleting part failed, please refresh', {
				closeButton: true,
				duration: Infinity
			});
			return;
		}

		saveState = 'idle';
		isDeleteDialogOpen = false;
		onDelete(draft.id);
	};
</script>

<AlertDialog.Root bind:open={isDeleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Media>
				<TrashIcon class="text-destructive" />
			</AlertDialog.Media>
			<AlertDialog.Title>Delete part?</AlertDialog.Title>
			<AlertDialog.Description>
				This will permanently delete this story part and its flow connections.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={saveState === 'saving'}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				variant="destructive"
				disabled={saveState === 'saving'}
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

{#snippet backgroundSnapMenu(key: 'start' | 'end')}
	<Popover.Root>
		<Popover.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant="ghost"
					size="sm"
					class="h-6 px-2 text-[0.65rem] text-muted-foreground uppercase {isSnapValue(
						key === 'start' ? backgroundStart : backgroundEnd
					)
						? 'text-yellow-500!'
						: ''}"
					aria-label={`Show ${key} snap points`}
				>
					<MagnetIcon class="size-3" />
					Snaps
				</Button>
			{/snippet}
		</Popover.Trigger>
		<Popover.Content align="end" class="w-64 p-0">
			<Command.Root>
				<Command.List>
					<Command.Empty>No snap points for this video</Command.Empty>
					<Command.Group heading="Snap points">
						{#each videoSnapValues as snapValue (`${key}-${snapValue}`)}
							<Command.Item
								value={`${key}-${snapValue}`}
								disabled={!isBackgroundSnapSelectable(key, snapValue)}
								onSelect={() => setBackgroundConfigurationValue(key, snapValue)}
							>
								<VideoFramePreview
									src={selectedVideoUrl}
									time={selectedVideoDuration * snapValue}
									label={`Snap point at ${formatVideoTime(snapValue)}`}
									class="pointer-events-none w-14 shrink-0"
								/>
								<span class="tabular-nums">{formatVideoTime(snapValue)}</span>
							</Command.Item>
						{/each}
					</Command.Group>
				</Command.List>
			</Command.Root>
		</Popover.Content>
	</Popover.Root>
{/snippet}

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
		<Button
			type="button"
			variant="destructive"
			size="icon"
			aria-label="Delete part"
			disabled={saveState === 'saving'}
			onclick={() => (isDeleteDialogOpen = true)}
		>
			<TrashIcon />
		</Button>
		<Button variant="ghost" size="icon" onclick={onDismiss}><XIcon /></Button>
	</div>
</HeaderBlank>

<div
	{@attach restoreScroll}
	class="h-[calc(100svh-(--spacing(16)))] muted-scrollbar overflow-y-auto"
	oninput={scheduleAutosave}
	onchange={scheduleAutosave}
	onscroll={(event) => scheduleScrollPersistence(event.currentTarget.scrollTop)}
>
	<HeaderBlank class="h-12 w-full bg-muted/50">
		<div class="size-full">
			<h1
				class="flex items-center gap-2 truncate overflow-hidden text-sm font-medium whitespace-nowrap"
			>
				Outcome
			</h1>
		</div>
	</HeaderBlank>
	<Field.Set class="grid gap-4 p-4">
		<Field.Field class="grid grid-cols-2 items-center gap-4">
			<Field.Label>Termination strategy</Field.Label>
			<Select.Root
				type="single"
				value={draft.terminationStrategy ?? PartTerminationStrategy.none}
				onValueChange={setTerminationStrategy}
			>
				<Select.Trigger class="w-full">
					<p class="truncate">{selectedTerminationStrategy.label}</p>
				</Select.Trigger>
				<Select.Content>
					<Select.Group>
						{#each terminationStrategyItems as item (item.value)}
							<Select.Item value={item.value}>
								<div>
									<p>{item.label}</p>
									<p class="text-xs text-muted-foreground">{item.description}</p>
								</div>
							</Select.Item>
						{/each}
					</Select.Group>
				</Select.Content>
			</Select.Root>
		</Field.Field>
	</Field.Set>

	<Separator />

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
			<ButtonGroup.Root
				class="w-full [&_button]:px-2 [&_button]:text-xs [&_svg]:hidden sm:[&_svg]:block"
			>
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
				<Button
					type="button"
					variant={draft.backgroundType === 'animation' ? 'default' : 'outline'}
					class="flex-1 text-xs"
					aria-pressed={draft.backgroundType === 'animation'}
					onclick={() => setBackgroundType('animation')}><ClapperboardIcon />Animation</Button
				>
			</ButtonGroup.Root>
		</Field.Field>

		{#if draft.backgroundType === 'still'}
			<Field.Field>
				<Field.Label>Still</Field.Label>
				<div class="flex gap-2">
					<div class="min-w-0 flex-1">
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
					</div>
					<Button
						type="button"
						variant="outline"
						size="icon"
						class="shrink-0"
						disabled={!draft.stillId || saveState === 'saving'}
						aria-label="Edit selected still"
						onclick={() =>
							void openResourceEditor({ kind: 'still', id: draft.stillId ?? undefined })}
					>
						<PencilIcon />
					</Button>
				</div>
			</Field.Field>
		{:else if draft.backgroundType === 'animation'}
			<Field.Field>
				<Field.Label>Animation</Field.Label>
				<div class="flex gap-2">
					<div class="min-w-0 flex-1">
						<ResourceCombobox
							items={animationItems}
							value={draft.animationId}
							placeholder="Select an animation"
							searchPlaceholder="Search animations..."
							emptyText="No animations found."
							onValueChange={(value) => {
								draft.animationId = value;
								scheduleAutosave();
							}}
						/>
					</div>
					<Button
						type="button"
						variant="outline"
						size="icon"
						class="shrink-0"
						disabled={!draft.animationId || saveState === 'saving'}
						aria-label="Edit selected animation"
						onclick={() =>
							void openResourceEditor({ kind: 'animation', id: draft.animationId ?? undefined })}
					>
						<PencilIcon />
					</Button>
				</div>
				<Field.Description
					>Playback timing and translated text are configured in the animation editor.</Field.Description
				>
			</Field.Field>
		{:else if draft.backgroundType === 'video'}
			<Field.Field>
				<Field.Label>Video</Field.Label>
				<div class="flex gap-2">
					<div class="min-w-0 flex-1">
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
					</div>
					<Button
						type="button"
						variant="outline"
						size="icon"
						class="shrink-0"
						disabled={!draft.videoId || saveState === 'saving'}
						aria-label="Edit selected video"
						onclick={() =>
							void openResourceEditor({ kind: 'video', id: draft.videoId ?? undefined })}
					>
						<PencilIcon />
					</Button>
				</div>
			</Field.Field>
			<div class="grid gap-3 sm:grid-cols-2">
				<Field.Field>
					<div class="flex items-center justify-between gap-2">
						<Field.Label>Start</Field.Label>
						{@render backgroundSnapMenu('start')}
					</div>
					<Scrubbable.Root
						class="w-full"
						value={backgroundStart}
						min={0}
						max={backgroundEnd}
						step={videoScrubberStep}
						keyboardStep={videoScrubberKeyboardStep}
						sensitivity={24}
						snapValues={videoSnapValues}
						snapThreshold={SNAP_THRESHOLD}
						onValueChange={(value) => setBackgroundConfigurationValue('start', value)}
					>
						<Scrubbable.Label>Timestamp</Scrubbable.Label>
						<Scrubbable.Value format={(value) => formatVideoTime(value)} />
					</Scrubbable.Root>
					<VideoFramePreview
						src={selectedVideoUrl}
						time={selectedVideoDuration * backgroundStart}
						label={`Background start at ${formatVideoTime(backgroundStart)}`}
					/>
				</Field.Field>
				<Field.Field>
					<div class="flex items-center justify-between gap-2">
						<Field.Label>End</Field.Label>
						{@render backgroundSnapMenu('end')}
					</div>
					<Scrubbable.Root
						class="w-full"
						value={backgroundEnd}
						min={backgroundStart}
						max={1}
						step={videoScrubberStep}
						keyboardStep={videoScrubberKeyboardStep}
						sensitivity={24}
						snapValues={videoSnapValues}
						snapThreshold={SNAP_THRESHOLD}
						onValueChange={(value) => setBackgroundConfigurationValue('end', value)}
					>
						<Scrubbable.Label>Timestamp</Scrubbable.Label>
						<Scrubbable.Value format={(value) => formatVideoTime(value)} />
					</Scrubbable.Root>
					<VideoFramePreview
						src={selectedVideoUrl}
						time={selectedVideoDuration * backgroundEnd}
						label={`Background end at ${formatVideoTime(backgroundEnd)}`}
					/>
				</Field.Field>
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
				<div class="flex gap-2">
					<div class="min-w-0 flex-1">
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
					</div>
					<Button
						type="button"
						variant="outline"
						size="icon"
						class="shrink-0"
						disabled={!draft.announcementTemplateId || saveState === 'saving'}
						aria-label="Edit selected announcement"
						onclick={() =>
							void openResourceEditor({
								kind: 'announcement',
								id: draft.announcementTemplateId ?? undefined
							})}
					>
						<PencilIcon />
					</Button>
				</div>
			</Field.Field>
		{:else if draft.foregroundType === 'quiz'}
			<Field.Field>
				<Field.Label>Quiz</Field.Label>
				<div class="flex gap-2">
					<div class="min-w-0 flex-1">
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
					</div>
					<Button
						type="button"
						variant="outline"
						size="icon"
						class="shrink-0"
						disabled={!draft.quizTemplateId || saveState === 'saving'}
						aria-label="Edit selected quiz"
						onclick={() =>
							void openResourceEditor({ kind: 'quiz', id: draft.quizTemplateId ?? undefined })}
					>
						<PencilIcon />
					</Button>
				</div>
			</Field.Field>
		{:else if draft.foregroundType === 'taxonomy'}
			<Field.Field>
				<Field.Label>Taxonomy</Field.Label>
				<div class="flex gap-2">
					<div class="min-w-0 flex-1">
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
					</div>
					<Button
						type="button"
						variant="outline"
						size="icon"
						class="shrink-0"
						disabled={!draft.taxonomyId || saveState === 'saving'}
						aria-label="Edit selected taxonomy draft"
						onclick={() => void openResourceEditor({ kind: 'taxonomy', partId: draft.id })}
					>
						<PencilIcon />
					</Button>
				</div>
			</Field.Field>
		{/if}

		{#if draft.foregroundType && (draft.backgroundType === 'video' || draft.backgroundType === 'animation')}
			<Field.Field>
				<div>
					<Field.Label>Start</Field.Label>
					<Field.Description class="text-sm">
						Timestamp <em>after</em> background {draft.backgroundType} started.
					</Field.Description>
				</div>
				<Scrubbable.Root
					class="w-full"
					value={foregroundStart}
					min={foregroundStartMin}
					max={foregroundStartMax}
					step={videoScrubberStep}
					keyboardStep={videoScrubberKeyboardStep}
					sensitivity={24}
					onValueChange={(value) => setForegroundConfigurationValue(value)}
				>
					<Scrubbable.Label>Timestamp</Scrubbable.Label>
					<Scrubbable.Value format={formatForegroundStart} />
				</Scrubbable.Root>
				{#if draft.backgroundType === 'video'}
					<VideoFramePreview
						src={selectedVideoUrl}
						time={selectedVideoDuration * foregroundStart}
						label={`Foreground start at ${formatVideoTime(foregroundStart)}`}
					/>
				{/if}
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
