<script lang="ts">
	import { PLAYERS } from '$lib/states/players.svelte';
	import { cn } from '$lib/utils';
	import PlayIcon from '@lucide/svelte/icons/play';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import type { ClassValue } from 'clsx';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import 'vidstack/bundle';
	import type { MediaPlayerElement } from 'vidstack/elements';

	type Props = {
		id: string;
		src: string;
		poster?: string | null | undefined;
		start?: number | undefined;
		end?: number | undefined;
		playbackRate?: number | undefined;
		isInitialPart: boolean;

		doBuffer: boolean;
		doPlay: boolean;
		doRestart: boolean;
		doEnd: boolean;
		time: number;
		isOverlaid: boolean;

		bufferNext: () => void;
		playNext: () => void;

		class?: ClassValue | null | undefined;
	};
	let {
		id,
		src,
		poster,
		start,
		end,
		playbackRate,
		isInitialPart,

		doBuffer = $bindable(false),
		doPlay = $bindable(false),
		doRestart = $bindable(false),
		doEnd = $bindable(false),
		time = $bindable(0),
		isOverlaid = $bindable(false),

		bufferNext,
		playNext,

		class: className
	}: Props = $props();

	let player: MediaPlayerElement;
	let timeLeft = $state(Infinity);
	let canPlay = $state(false);
	let almostEnded = $state(false);
	let isEnded = $state(false);

	let timer = $state<ReturnType<typeof setInterval> | null>(null);

	onMount(() => {
		player?.subscribe(({ canPlay: canplay }) => {
			canPlay = canplay;
		});
		player?.subscribe(({ currentTime }) => {
			if (player?.duration) {
				timeLeft = player.duration - currentTime;
				time = currentTime;
				if (!almostEnded && (timeLeft ?? Infinity) <= 30) almostEnded = true;
			}
		});
		player?.subscribe(({ ended }) => {
			isEnded = ended;
		});
	});

	const startWatching = () => {
		if (timer) clearInterval(timer);
		timer = setInterval(
			() => (PLAYERS.watchDurations[id] = (PLAYERS.watchDurations[id] ?? 0) + 0.1),
			100
		);
	};
	const pauseWatching = () => {
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
	};
	$effect(() => {
		if (doEnd) stopAndEndWatching();
	});
	const stopAndEndWatching = async () => {
		await player.pause();
		endWatching();
	};
	const endWatching = () => {
		pauseWatching();

		if (PLAYERS.watchDurations[id] > 0) {
			const watchTimePercentage = (PLAYERS.watchDurations[id] / player.duration) * 100;
			PLAYERS.watchTimePercentages[id] = watchTimePercentage;
		}
	};

	$effect(() => {
		if (doBuffer) load();
	});
	const load = () => player.startLoading();

	$effect(() => {
		if (PLAYERS.didUserInteract && almostEnded) bufferNext();
	});

	$effect(() => {
		if (PLAYERS.didUserInteract && isEnded) {
			doPlay = false;
			playNext();
		}
	});

	$effect(() => {
		if (canPlay && doPlay && PLAYERS.didUserInteract) restart();
	});
	const restart = async () => {
		time = 0;
		player.currentTime = 0;
		PLAYERS.watchDurations[id] = 0;
		PLAYERS.watchTimePercentages[id] = 0;
		await player.play();
		doPlay = true;
		doRestart = false;
		almostEnded = false;
		isEnded = false;
		doEnd = false;
	};

	$effect(() => {
		if (doRestart) restart();
	});
</script>

<div
	class="pointer-events-none absolute inset-0 -z-10 grid place-items-center text-white opacity-50"
>
	<LoaderIcon class="size-14 animate-spin" />
</div>
<media-player
	bind:this={player}
	class={cn('group relative size-full overflow-hidden', className)}
	{src}
	title={id}
	load="custom"
	playsinline
	clipStartTime={start ?? 0}
	clipEndTime={end}
	playbackRate={playbackRate ?? 1}
	onplay={startWatching}
	onplaying={startWatching}
	onpause={pauseWatching}
	onwaiting={pauseWatching}
	onseeking={pauseWatching}
	onseeked={startWatching}
	onended={endWatching}
>
	<media-provider>
		{#if poster && isInitialPart}
			<media-poster
				class="absolute inset-0 opacity-0 transition-opacity data-visible:opacity-100"
				src={poster}
			>
			</media-poster>
		{/if}
	</media-provider>

	<media-controls
		class="pointer-events-none absolute inset-0 z-20 flex size-full flex-col bg-linear-to-t from-black/10 to-transparent opacity-0 transition-opacity data-visible:opacity-100"
	>
		<media-controls-group class="pointer-events-auto grid h-full w-full place-items-center">
			<media-play-button class="group size-full outline-none">
				<button
					type="button"
					aria-label="Play"
					class="grid size-full place-items-center px-2 pt-10 outline-none"
					onclick={() => (PLAYERS.didUserInteract = true)}
				>
					{#if !isOverlaid}
						<div
							out:fade
							class="hidden size-24 cursor-pointer place-items-center rounded-full bg-black/50 text-white ring-black backdrop-blur-md transition-colors outline-none group-hover:bg-black/30 group-data-focus:ring-4 group-data-paused:grid"
						>
							<PlayIcon
								class="hidden size-12 opacity-80 transition-colors group-hover:opacity-100 group-data-paused:block"
							/>
							<!-- <PauseIcon
								class="size-12 opacity-80 transition-colors group-hover:opacity-100 group-data-paused:hidden"
							/> -->
						</div>
					{/if}
				</button>
			</media-play-button>
		</media-controls-group>
		<div class="flex-1"></div>
		<media-controls-group class="pointer-events-auto flex w-full items-center px-2">
			<media-time-slider
				class="group relative mx-2 inline-flex h-10 w-full cursor-pointer touch-none items-center outline-none select-none aria-hidden:hidden"
			>
				<div
					class="relative z-0 h-2 w-full rounded-sm bg-white/20 ring-black backdrop-blur-md group-data-focus:ring-2"
				>
					<div
						class="absolute z-10 h-full w-(--slider-progress) rounded-sm bg-white/20 will-change-[width]"
					></div>
					<div
						class="absolute z-20 h-full w-(--slider-fill) rounded-sm bg-white will-change-[width]"
					></div>
				</div>
				<div
					class="absolute top-1/2 left-(--slider-fill) z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-3 border-white bg-neutral-300 opacity-0 ring-neutral-200/40 transition-opacity will-change-[left] group-data-active:opacity-100 group-data-dragging:ring-4"
				></div>
			</media-time-slider>
		</media-controls-group>
	</media-controls>
</media-player>

<style lang="postcss">
	@reference 'tailwindcss';

	media-player {
		&.portrait,
		&.default {
			@apply aspect-9/16;
		}
		&.landscape {
			@apply aspect-video;
		}
		&.square {
			@apply aspect-square;
		}
	}

	:global(media-player[data-started]:not([data-user-initiated]) .controls) {
		@apply pointer-events-none opacity-0;
	}

	:global(media-player media-poster :where(img)) {
		@apply size-full object-contain;
	}
</style>
