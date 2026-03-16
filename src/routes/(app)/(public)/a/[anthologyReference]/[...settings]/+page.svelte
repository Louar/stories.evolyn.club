<script lang="ts">
	import { browser } from '$app/environment';
	import Story from '$lib/components/app/player/Story.svelte';
	import { Orientation } from '$lib/db/schemas/0-utils.js';
	import { PLAYERS } from '$lib/states/players.svelte';
	import { STORIES } from '$lib/states/stories.svelte.js';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import CheckIcon from '@lucide/svelte/icons/circle-check';
	import CircleXIcon from '@lucide/svelte/icons/circle-x';
	import { onDestroy, onMount } from 'svelte';
	import { Confetti } from 'svelte-confetti';
	import { fade } from 'svelte/transition';

	let { data } = $props();
	let anthology = $derived(data.anthology);
	let progressStorage = $derived(
		anthology?.reference?.length ? `anthology-progress:${anthology.reference}` : undefined
	);
	let stories = $derived(data.stories);
	let orientation = $derived(data.orientation);
	// svelte-ignore state_referenced_locally
	let playersOfStories = $state(data.playersOfStories);
	let storiesRestart: Record<number, boolean> = $state({});

	let container: HTMLDivElement | null = null;

	let active = $state(0);
	let isScrolling = $state(false);
	let io: IntersectionObserver | null = null;
	let hasHydratedProgress = $state(false);

	type StoryWatchProgress = Record<string, number>;

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

	const writeProgress = (progress: StoryWatchProgress) => {
		if (!browser) return;
		if (!progressStorage) return;
		if (!Object.keys(progress)?.length) return;
		localStorage.setItem(progressStorage, JSON.stringify(progress));
	};

	const waitForScrollEnd = (target: HTMLElement, { timeout = 120 } = {}) => {
		return new Promise<void>((resolve) => {
			let timer: number | undefined;

			const cleanup = () => {
				if (timer) window.clearTimeout(timer);
				target.removeEventListener('scroll', onScroll);
				target.removeEventListener('scrollend', onScrollEnd);
			};

			const finish = () => {
				cleanup();
				isScrolling = false;
				resolve();
			};

			const onScrollEnd = () => finish();

			const onScroll = () => {
				if (timer) window.clearTimeout(timer);
				timer = window.setTimeout(() => finish(), timeout);
			};

			isScrolling = true;
			target.addEventListener('scroll', onScroll, { passive: true });
			target.addEventListener('scrollend', onScrollEnd, { passive: true });
			onScroll();
		});
	};
	const scrollToIndex = async (next: number) => {
		if (!container) return;

		playersOfStories = playersOfStories.map((storyPlayers) =>
			storyPlayers.map((p) => ({
				...p,
				doPlay: false,
				doRestart: false,
				almostEnded: false,
				isEnded: false,
				doEnd: true,
				didHandleEnd: false
			}))
		);

		const i = Math.max(0, Math.min(stories.length - 1 + 1, next));
		active = i;
		const playersOfNextStory = playersOfStories[active];

		if (playersOfNextStory) storiesRestart[active] = true;
		container
			.querySelector<HTMLElement>(`[data-index="${i}"]`)
			?.scrollIntoView({ behavior: 'smooth', block: 'start' });

		await waitForScrollEnd(container);
		if (playersOfNextStory) {
			storiesRestart[active] = false;

			const initialPartOfNextStory = playersOfNextStory.find((p) => p.isInitialPart);
			if (initialPartOfNextStory && PLAYERS.didUserInteract) initialPartOfNextStory.doPlay = true;
		}
	};

	const onKeydown = (e: KeyboardEvent) => {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			scrollToIndex(active + 1);
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			scrollToIndex(active - 1);
		}
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
		hasHydratedProgress = true;

		window.addEventListener('keydown', onKeydown, { passive: false });

		io = new IntersectionObserver(
			(entries) => {
				let best: { index: number; ratio: number } | null = null;

				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					const index = Number((entry.target as HTMLElement).dataset.index);
					if (!best || entry.intersectionRatio > best.ratio) {
						best = { index, ratio: entry.intersectionRatio };
					}
				}

				if (!isScrolling && best && best.ratio >= 0.7 && best.index !== active) {
					playersOfStories = playersOfStories.map((storyPlayers) =>
						storyPlayers.map((p) => ({
							...p,
							doPlay: false,
							doRestart: false,
							almostEnded: false,
							isEnded: false,
							doEnd: true,
							didHandleEnd: false
						}))
					);

					active = best.index;
					const playersOfNextStory = playersOfStories[active];
					if (playersOfNextStory) {
						const initialPartOfNextStory = playersOfNextStory.find((p) => p.isInitialPart);
						if (initialPartOfNextStory && PLAYERS.didUserInteract)
							initialPartOfNextStory.doPlay = true;
					}
				}
			},
			{
				root: container,
				threshold: [0, 0.25, 0.5, 0.7, 0.85, 1]
			}
		);

		container?.querySelectorAll<HTMLElement>('[data-index]').forEach((el) => io?.observe(el));
	});

	onDestroy(() => {
		if (!browser) return;
		window.removeEventListener('keydown', onKeydown);
		io?.disconnect();
	});

	const isStoryCompleted = (storyId: string) => {
		return STORIES.averageWatchTimePercentages[storyId] > 10;
	};

	$effect(() => {
		if (!browser || !hasHydratedProgress) return;

		const currentStoryIds = new Set(stories.map((story) => story.id));
		const progressForCurrentAnthology: StoryWatchProgress = {};
		for (const storyId of currentStoryIds) {
			const percentage = STORIES.averageWatchTimePercentages[storyId];
			if (typeof percentage !== 'number' || !Number.isFinite(percentage)) continue;
			progressForCurrentAnthology[storyId] = percentage;
		}

		writeProgress(progressForCurrentAnthology);
	});

	$effect(() => {
		if (active < stories.length) return;
		if (PLAYERS.isAnyOverlayActive) PLAYERS.isAnyOverlayActive = false;
	});
</script>

<svelte:head>
	<title>{anthology.name || stories[active]?.name}</title>
</svelte:head>

<div class="relative h-dvh w-dvw overflow-hidden text-white">
	<div class="absolute inset-0 -z-20 bg-black"></div>

	<!-- Scroll container (snap) -->
	<div
		bind:this={container}
		class="scrollbar-none h-full w-full snap-y snap-mandatory overflow-y-scroll overscroll-contain scroll-smooth"
	>
		{#each stories as story, i (i)}
			<section data-index={i} class="relative h-full w-full snap-start snap-always">
				<Story
					{story}
					{orientation}
					players={playersOfStories[i]}
					isActiveStory={active === i}
					onnext={async () => {
						if (stories.length - 1 + 1 > i) {
							await new Promise((r) => setTimeout(r, 1000));
							scrollToIndex(i + 1);
						}
					}}
					doRestart={storiesRestart[i]}
					class="rounded-3xl"
				/>
			</section>
		{/each}
		<section data-index={stories.length} class="relative h-full w-full snap-start snap-always">
			<div
				class="relative mx-auto grid max-h-dvh max-w-dvw items-center overflow-hidden"
				class:aspect-portrait={!orientation || orientation === Orientation.portrait}
				class:aspect-video={orientation === Orientation.landscape}
				class:aspect-square={orientation === Orientation.square}
			>
				<ul class="grid gap-2 p-4">
					{#each stories as story, i (i)}
						<li class="inline-flex items-center gap-2">
							{#if isStoryCompleted(story.id)}
								<div
									transition:fade={{ duration: 150 }}
									class="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-300/20 text-emerald-500"
								>
									<CheckIcon class="size-6" />
								</div>
							{:else}
								<div
									transition:fade={{ duration: 150 }}
									class="grid size-8 shrink-0 place-items-center rounded-full bg-rose-300/20 text-rose-500"
								>
									<CircleXIcon class="size-6" />
								</div>
							{/if}
							<p class="line-clamp-1 text-lg">
								{story.name}
							</p>
						</li>
					{/each}
				</ul>
			</div>
		</section>
	</div>

	<!-- Static overlay -->
	<div class="pointer-events-none absolute inset-0 z-10">
		<div class="absolute inset-x-0 top-0 h-28 bg-linear-to-b from-black/60 to-transparent"></div>
		<div class="absolute inset-x-0 bottom-0 h-44 bg-linear-to-t from-black/70 to-transparent"></div>

		<!-- Meta information -->
		{#if stories[active]?.name?.length && !PLAYERS.isAnyPartPlaying && !PLAYERS.isAnyOverlayActive}
			<div transition:fade={{ duration: 150 }} class="absolute right-16 bottom-10 left-4">
				<!-- <div class="text-sm opacity-90">###</div> -->
				<div class="mt-1 line-clamp-2 text-lg leading-snug font-semibold md:line-clamp-1">
					{stories[active]?.name}
				</div>
				<!-- <div class="mt-1 text-sm opacity-80">#demo #svelte5 #tailwind</div> -->
			</div>
		{/if}
	</div>

	<!-- Navigation actions -->
	{#if !PLAYERS.isAnyOverlayActive}
		<div class="pointer-events-none absolute inset-0 z-50">
			<div class="pointer-events-auto absolute right-4 bottom-10 flex flex-col items-center gap-4">
				{#if !isScrolling && stories[active]?.id && isStoryCompleted(stories[active].id)}
					<Confetti x={[-1, -0.25]} y={[0, 0.5]} xSpread={0.4} duration={750} />
					<div
						transition:fade={{ duration: 150 }}
						class="grid h-12 w-12 place-items-center rounded-full bg-emerald-300/20 text-emerald-500 backdrop-blur"
					>
						<CheckIcon class="size-8" />
					</div>
				{/if}
				<button
					type="button"
					class="grid h-12 w-12 place-items-center rounded-full bg-white/10 backdrop-blur"
					onclick={() => scrollToIndex(active - 1)}
				>
					<ArrowUpIcon class="size-8" />
				</button>
				<button
					type="button"
					class="grid h-12 w-12 place-items-center rounded-full bg-white/10 backdrop-blur"
					onclick={() => scrollToIndex(active + 1)}
				>
					<ArrowDownIcon class="size-8" />
				</button>
			</div>
		</div>
	{/if}

	<!-- Active indicator -->
	{#if active < stories.length}
		<div
			transition:fade={{ duration: 150 }}
			class="pointer-events-none absolute top-4 left-4 z-50 rounded-full bg-white/10 px-3 py-1 text-xs backdrop-blur"
		>
			{active + 1} / {stories.length}
		</div>
	{/if}
</div>

<style lang="postcss">
	@reference 'tailwindcss';
	:global(body) {
		@apply bg-transparent;
	}
</style>
