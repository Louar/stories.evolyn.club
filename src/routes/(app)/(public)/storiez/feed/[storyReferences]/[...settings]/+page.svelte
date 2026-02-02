<script lang="ts">
	import { browser } from '$app/environment';
	import Story from '$lib/components/app/player/Story.svelte';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import { onDestroy, onMount } from 'svelte';

	let { data } = $props();
	let stories = $derived(data.stories);
	let orientation = $derived(data.orientation);
	// svelte-ignore state_referenced_locally
	let playersOfStories = $state(data.playersOfStories);

	let container: HTMLDivElement | null = null;

	let activeIndex = $state(0);
	let io: IntersectionObserver | null = null;

	function scrollToIndex(next: number) {
		const i = Math.max(0, Math.min(stories.length - 1, next));
		activeIndex = i;

		container
			?.querySelector<HTMLElement>(`[data-index="${i}"]`)
			?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			scrollToIndex(activeIndex + 1);
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			scrollToIndex(activeIndex - 1);
		}
	}

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

				if (best && best.ratio >= 0.7 && best.index !== activeIndex) {
					activeIndex = best.index;
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
</script>

<svelte:head>
	<title>{stories[activeIndex]?.name}</title>
</svelte:head>

<!-- Fullscreen shell -->
<div class="relative h-dvh w-dvw overflow-hidden bg-black text-white">
	<!-- Scroll container (snap) -->
	<div
		bind:this={container}
		class="h-dvh w-dvw snap-y snap-mandatory overflow-y-scroll overscroll-contain scroll-smooth"
		style="-webkit-overflow-scrolling: touch;"
	>
		{#each stories as story, i}
			<section data-index={i} class="relative h-dvh w-dvw snap-start snap-always">
				<Story {story} {orientation} players={playersOfStories[i]} class="rounded-3xl" />
			</section>
		{/each}
	</div>

	<!-- ✅ STATIC OVERLAY (does not scroll) -->
	<div class="pointer-events-none absolute inset-0 z-50">
		<!-- top gradient -->
		<div class="absolute inset-x-0 top-0 h-28 bg-linear-to-b from-black/60 to-transparent"></div>

		<!-- bottom gradient -->
		<div class="absolute inset-x-0 bottom-0 h-44 bg-linear-to-t from-black/70 to-transparent"></div>

		<!-- captions / meta (use activeIndex) -->
		<!-- <div class="absolute right-16 bottom-6 left-4">
			<div class="text-sm opacity-90">@creator_{activeIndex + 1}</div>
			<div class="mt-1 text-base leading-snug font-semibold">
				Video title {activeIndex + 1} — click to play/pause
			</div>
			<div class="mt-1 text-sm opacity-80">#demo #svelte5 #tailwind</div>
		</div> -->

		<!-- right-side actions placeholder -->
		<div class="pointer-events-auto absolute right-4 bottom-8 flex flex-col items-center gap-4">
			<!-- <div class="grid h-12 w-12 place-items-center rounded-full bg-white/10 backdrop-blur"></div> -->
			<button
				type="button"
				class="grid h-12 w-12 place-items-center rounded-full bg-white/10 backdrop-blur"
				onclick={(e) => scrollToIndex(activeIndex - 1)}
			>
				<ArrowUpIcon class="size-8" />
			</button>
			<button
				type="button"
				class="grid h-12 w-12 place-items-center rounded-full bg-white/10 backdrop-blur"
				onclick={(e) => scrollToIndex(activeIndex + 1)}
			>
				<ArrowDownIcon class="size-8" />
			</button>
		</div>

		<!-- Active indicator -->
		<div class="absolute top-4 left-4 rounded-full bg-white/10 px-3 py-1 text-xs backdrop-blur">
			{activeIndex + 1} / {stories.length}
		</div>
	</div>

	<!-- OPTIONAL: If you want buttons clickable, add a second overlay layer -->
	<!--
	<div class="absolute inset-0">
		... put clickable controls here (remove pointer-events-none, add pointer-events-auto to buttons)
	</div>
	-->
</div>

<style lang="postcss">
	@reference 'tailwindcss';
	:global(body) {
		@apply bg-transparent;
	}
</style>
