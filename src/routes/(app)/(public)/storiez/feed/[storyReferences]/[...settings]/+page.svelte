<script lang="ts">
	import { browser } from '$app/environment';
	import Story from '$lib/components/app/player/Story.svelte';
	import { PLAYERS } from '$lib/states/players.svelte';
	import { STORIES } from '$lib/states/stories.svelte.js';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import CheckIcon from '@lucide/svelte/icons/circle-check';
	import { onDestroy, onMount } from 'svelte';
	import { Confetti } from 'svelte-confetti';
	import { fade } from 'svelte/transition';

	let { data } = $props();
	let stories = $derived(data.stories);
	let orientation = $derived(data.orientation);
	// svelte-ignore state_referenced_locally
	let playersOfStories = $state(data.playersOfStories);
	let storiesRestart: Record<number, boolean> = $state({});

	let container: HTMLDivElement | null = null;

	let active = $state(0);
	let isScrolling = $state(false);
	let io: IntersectionObserver | null = null;

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

		const i = Math.max(0, Math.min(stories.length - 1, next));
		active = i;
		const playersOfNextStory = playersOfStories[active];

		storiesRestart[active] = true;
		container
			.querySelector<HTMLElement>(`[data-index="${i}"]`)
			?.scrollIntoView({ behavior: 'smooth', block: 'start' });

		await waitForScrollEnd(container);
		storiesRestart[active] = false;

		const initialPartOfNextStory = playersOfNextStory.find((p) => p.isInitialPart);
		if (initialPartOfNextStory && PLAYERS.didUserInteract) initialPartOfNextStory.doPlay = true;
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
					active = best.index;
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
</script>

<svelte:head>
	<title>{stories[active]?.name}</title>
</svelte:head>

<!-- Fullscreen shell -->
<div class="relative h-dvh w-dvw overflow-hidden text-white">
	<!-- Background -->
	<div class="absolute inset-0 -z-20 bg-black"></div>

	<!-- Scroll container (snap) -->
	<div
		bind:this={container}
		class="scrollbar-none h-full w-full snap-y snap-mandatory overflow-y-scroll overscroll-contain scroll-smooth"
	>
		{#each stories as story, i}
			<section data-index={i} class="relative h-full w-full snap-start snap-always">
				<Story
					{story}
					{orientation}
					players={playersOfStories[i]}
					onnext={async () => {
						if (stories.length - 1 > i) {
							await new Promise((r) => setTimeout(r, 1000));
							scrollToIndex(i + 1);
						}
					}}
					doRestart={storiesRestart[i]}
					class="rounded-3xl"
				/>
			</section>
		{/each}
	</div>

	<!-- Static overlay -->
	<div class="pointer-events-none absolute inset-0 z-50">
		<!-- top gradient -->
		<div class="absolute inset-x-0 top-0 h-28 bg-linear-to-b from-black/60 to-transparent"></div>

		<!-- bottom gradient -->
		<div class="absolute inset-x-0 bottom-0 h-44 bg-linear-to-t from-black/70 to-transparent"></div>

		<!-- captions / meta (use active) -->
		<div class="absolute right-16 bottom-10 left-4">
			<!-- <div class="text-sm opacity-90">###</div> -->
			<div class="mt-1 line-clamp-2 text-lg leading-snug font-semibold md:line-clamp-1">
				{stories[active]?.name}
			</div>
			<!-- <div class="mt-1 text-sm opacity-80">#demo #svelte5 #tailwind</div> -->
		</div>

		<!-- right-side actions placeholder -->
		<div class="pointer-events-auto absolute right-4 bottom-8 flex flex-col items-center gap-4">
			{#if !isScrolling && isStoryCompleted(stories[active].id)}
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

		<!-- Active indicator -->
		<div class="absolute top-4 left-4 rounded-full bg-white/10 px-3 py-1 text-xs backdrop-blur">
			{active + 1} / {stories.length}
		</div>
	</div>
</div>

<style lang="postcss">
	@reference 'tailwindcss';
	:global(body) {
		@apply bg-transparent;
	}
</style>
