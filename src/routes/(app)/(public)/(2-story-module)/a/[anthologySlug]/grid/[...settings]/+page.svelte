<script lang="ts">
	import { browser } from '$app/environment';
	import { pushState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import StoryPlayer from '$lib/components/app/player/Story.svelte';
	import type { Player } from '$lib/components/app/player/types';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { MediaFile } from '$lib/components/ui/media-file';
	import type { Media } from '$lib/db/schemas/0-utils';
	import { STORIES } from '$lib/states/stories.svelte.js';
	import { cn } from '$lib/utils';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import FlagIcon from '@lucide/svelte/icons/flag';
	import { onMount, tick } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let anthology = $derived(data.anthology);
	let progressStorage = $derived(
		anthology?.slug?.length ? `anthology-progress:${anthology.slug}` : undefined
	);
	let stories = $derived(data.stories);
	let transitioningStorySlug = $state<string | null>(null);
	let modalPlayers = $state<Player[]>([]);

	type Story = PageData['stories'][number];
	type StoryWatchProgress = Record<string, number>;
	type StoryModalState = {
		storySlug?: string;
	};
	type ViewTransition = {
		finished: Promise<void>;
		skipTransition: () => void;
	};
	type DocumentWithViewTransition = Document & {
		startViewTransition?: (updateCallback: () => Promise<void> | void) => ViewTransition;
	};
	type PointerLikeEvent = PointerEvent | MouseEvent;

	let storyModalState = $derived(page.state as StoryModalState);
	let selectedStory = $derived(
		storyModalState.storySlug
			? stories.find((story) => story.slug === storyModalState.storySlug)
			: undefined
	);
	let isStoryDialogOpen = $derived(!!selectedStory);

	const isValidPersistedProgress = (value: unknown): value is StoryWatchProgress => {
		if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
		return Object.values(value).every(
			(entry) => typeof entry === 'number' && Number.isFinite(entry)
		);
	};

	const readProgress = (): StoryWatchProgress => {
		if (!browser) return {};
		if (!progressStorage) return {};
		const raw = localStorage.getItem(progressStorage);
		if (!raw) return {};

		try {
			const parsed: unknown = JSON.parse(raw);
			if (!isValidPersistedProgress(parsed)) return {};
			return parsed;
		} catch {
			return {};
		}
	};

	const isMedia = (value: unknown): value is Media => {
		return !!value && typeof value === 'object' && 'collection' in value && 'filename' in value;
	};

	const getStoryThumbnail = (story: Story) => {
		for (const part of story.parts) {
			const background = part.background;
			if (!background || Array.isArray(background)) continue;
			if ('thumbnail' in background && isMedia(background.thumbnail)) return background.thumbnail;
			if ('image' in background && isMedia(background.image)) return background.image;
		}

		return undefined;
	};

	const getStoryProgress = (storyId: string) => {
		const progress = STORIES.averageWatchTimePercentages[storyId];
		return typeof progress === 'number' && Number.isFinite(progress) ? progress : 0;
	};

	const isStoryCompleted = (storyId: string) => {
		return getStoryProgress(storyId) > 10;
	};

	const prepareStoryTransition = (storySlug: string) => {
		transitioningStorySlug = storySlug;
	};

	const canUseViewTransition = () => {
		if (!browser) return false;
		if (!('startViewTransition' in document)) return false;
		return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	};

	const shouldUseNativeLink = (event: PointerLikeEvent) => {
		if (event.defaultPrevented) return true;
		if (event.button !== 0) return true;
		return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
	};

	const openStory = async (event: MouseEvent, story: Story, storyIndex: number) => {
		if (shouldUseNativeLink(event)) return;
		event.preventDefault();

		const href = (event.currentTarget as HTMLAnchorElement).href;
		const openModal = async () => {
			modalPlayers = data.playersOfStories[storyIndex].map((player) => ({ ...player }));
			transitioningStorySlug = null;
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			pushState(href, { storySlug: story.slug });
			await tick();
		};

		prepareStoryTransition(story.slug);
		await tick();

		if (!canUseViewTransition()) {
			await openModal();
			transitioningStorySlug = null;
			return;
		}

		const transition = (document as DocumentWithViewTransition).startViewTransition?.(openModal);
		transition?.finished.catch(() => {});
	};

	const closeStoryDialog = () => {
		if (!isStoryDialogOpen) return;
		history.back();
	};

	const handleStoryDialogOpenChange = (isOpen: boolean) => {
		if (!isOpen) closeStoryDialog();
	};

	onMount(() => {
		if (!browser) return;

		const currentStoryIds = new Set(stories.map((story) => story.id));
		const persistedProgress = readProgress();
		for (const [storyId, persistedPercentage] of Object.entries(persistedProgress)) {
			if (!currentStoryIds.has(storyId)) continue;
			const currentPercentage = STORIES.averageWatchTimePercentages[storyId] ?? 0;
			STORIES.averageWatchTimePercentages[storyId] = Math.max(
				currentPercentage,
				persistedPercentage
			);
		}
	});
</script>

<svelte:head>
	<title>{anthology.name}</title>
</svelte:head>

<main class="min-h-dvh bg-background text-foreground">
	<div class="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
		<header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
			<div class="space-y-2">
				<p class="text-sm font-medium text-muted-foreground">Anthology</p>
				<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">
					{anthology.name ?? anthology.slug}
				</h1>
			</div>
			<p class="text-sm text-muted-foreground">
				{stories.length}
				{stories.length === 1 ? 'story' : 'stories'}
			</p>
		</header>

		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each stories as story, i (story.id)}
				{@const thumbnail = getStoryThumbnail(story)}
				{@const progress = getStoryProgress(story.id)}
				{@const isCompleted = isStoryCompleted(story.id)}
				<div
					class="relative"
					style:view-transition-name={transitioningStorySlug === story.slug && !isStoryDialogOpen
						? 'selected-story-card'
						: 'none'}
				>
					<a
						class="absolute inset-0 z-10 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden"
						href={resolve(`/s/${story.slug}` as '/s/[storySlug]/[...settings]')}
						aria-label={`Open ${story.name ?? story.slug}`}
						onpointerdown={() => prepareStoryTransition(story.slug)}
						onclick={(event) => openStory(event, story, i)}
					></a>

					<Card.Root
						class={cn(
							'h-full overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md has-[>.media:first-child]:pt-0',
							isCompleted &&
								'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20'
						)}
					>
						<Card.Content class="media flex border-b p-0">
							{#if thumbnail}
								<div class="relative aspect-video w-full overflow-hidden bg-muted">
									<MediaFile
										src={thumbnail}
										class="absolute inset-0 h-full w-full scale-110 object-cover opacity-55 blur-xl"
									/>
									<MediaFile src={thumbnail} class="relative h-full w-full object-contain" />
								</div>
							{:else}
								<div
									class="grid aspect-video w-full place-items-center bg-linear-to-br from-muted to-muted/40 text-sm font-medium text-muted-foreground"
								>
									Story {i + 1}
								</div>
							{/if}
						</Card.Content>

						<Card.Header class="items-start gap-2">
							<div class="flex w-full items-start justify-between gap-3">
								<div class="min-w-0 flex-1">
									<Card.Title class="line-clamp-2 text-lg leading-snug">
										{story.name ?? story.slug}
									</Card.Title>
									<Card.Description class="mt-1 line-clamp-1">
										{anthology.name ?? anthology.slug} / {i + 1} of {stories.length}
									</Card.Description>
								</div>

								<div
									class="grid size-8 shrink-0 place-items-center rounded-full border bg-background shadow-sm dark:bg-muted"
								>
									{#if isCompleted}
										<div
											class="grid size-8 place-items-center rounded-full border-2 border-emerald-200 bg-emerald-400 text-emerald-50 shadow-sm ring-1 shadow-emerald-300 ring-emerald-300"
										>
											<FlagIcon class="size-4" />
										</div>
									{:else}
										<ArrowUpRightIcon class="size-4 text-muted-foreground" />
									{/if}
								</div>
							</div>
						</Card.Header>

						<Card.Content
							class="mt-auto flex items-center justify-between gap-3 text-sm text-muted-foreground"
						>
							<span>{story.parts.length} {story.parts.length === 1 ? 'part' : 'parts'}</span>
							<span>{Math.round(progress)}% watched</span>
						</Card.Content>
					</Card.Root>
				</div>
			{:else}
				<Card.Root class="border-dashed sm:col-span-2 lg:col-span-3 xl:col-span-4">
					<Card.Header>
						<Card.Title>No stories yet</Card.Title>
						<Card.Description>This anthology does not contain any public stories.</Card.Description>
					</Card.Header>
				</Card.Root>
			{/each}
		</div>
	</div>
</main>

<Dialog.Root open={isStoryDialogOpen} onOpenChange={handleStoryDialogOpenChange}>
	<Dialog.Content
		class="h-dvh w-dvw max-w-none overflow-hidden rounded-none border-0 bg-black p-0 shadow-none duration-0 data-[state=closed]:animate-none data-[state=open]:animate-none sm:max-w-none"
		showCloseButton={false}
	>
		{#if selectedStory && modalPlayers.length}
			<div class="relative h-dvh w-dvw" style:view-transition-name="selected-story-card">
				<StoryPlayer story={selectedStory} players={modalPlayers} onnext={closeStoryDialog} />
				<button
					type="button"
					class="absolute top-4 left-4 z-50 inline-flex size-12 items-center justify-center rounded-full bg-black/45 text-white shadow-sm backdrop-blur transition hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-hidden"
					onclick={closeStoryDialog}
					aria-label="Previous"
				>
					<ArrowLeftIcon class="size-6" />
				</button>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<style lang="postcss">
	:global([data-slot='dialog-overlay']) {
		background: rgb(0 0 0 / 0.72);
	}

	:global(::view-transition-group(selected-story-card)),
	:global(::view-transition-old(selected-story-card)),
	:global(::view-transition-new(selected-story-card)) {
		animation-duration: 520ms;
		animation-timing-function: cubic-bezier(0.2, 0.9, 0.2, 1);
	}

	:global(::view-transition-old(selected-story-card)),
	:global(::view-transition-new(selected-story-card)) {
		height: 100%;
		overflow: clip;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(::view-transition-group(selected-story-card)),
		:global(::view-transition-old(selected-story-card)),
		:global(::view-transition-new(selected-story-card)) {
			animation: none;
		}
	}
</style>
