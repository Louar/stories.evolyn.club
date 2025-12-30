<script lang="ts">
	import { PLAYERS } from '$lib/states/players.svelte';
	import { cn } from '$lib/utils';
	import type { ClassValue } from 'clsx';
	import { onMount } from 'svelte';
	import 'vidstack/bundle';
	import type { MediaPlayerElement } from 'vidstack/elements';

	type Props = {
		id: string;
		src: string;
		poster?: string | null | undefined;
		start?: number | undefined;
		end?: number | undefined;

		doBuffer: boolean;
		doPlay: boolean;
		watchPercentage: number;

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

		doBuffer = $bindable(false),
		doPlay = $bindable(false),
		watchPercentage = $bindable(0),

		bufferNext,
		playNext,

		class: className
	}: Props = $props();

	let player: MediaPlayerElement;
	let timeLeft = $state(Infinity);
	let canPlay = $state(false);
	let almostEnded = $state(false);
	let isEnded = $state(false);

	onMount(() => {
		player?.subscribe(({ canPlay: canplay }) => {
			canPlay = canplay;
		});
		player?.subscribe(({ currentTime }) => {
			if (player?.duration) {
				timeLeft = player.duration - currentTime;
				watchPercentage = currentTime / player.duration;
				if (!almostEnded && (timeLeft ?? Infinity) <= 30) almostEnded = true;
			}
		});
		player?.subscribe(({ ended }) => {
			isEnded = ended;
		});
	});

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
		if (canPlay && doPlay && PLAYERS.didUserInteract) play();
	});
	const play = () => {
		player.currentTime = 0;
		player.play();
		isEnded = false;
	};
</script>

<media-player
	bind:this={player}
	class={cn('group relative aspect-video w-full overflow-hidden rounded-3xl', className)}
	{src}
	title={id}
	load="custom"
	playsinline
	clipStartTime={start}
	clipEndTime={end}
>
	<media-provider>
		{#if poster}
			<media-poster
				class="absolute inset-0 block h-full w-full rounded-3xl bg-black opacity-0 transition-opacity data-visible:opacity-100 [&>img]:h-full [&>img]:w-full [&>img]:object-cover"
				src={poster}
			>
			</media-poster>
		{/if}
	</media-provider>

	<media-controls
		class="pointer-events-none absolute inset-0 z-20 flex h-full w-full flex-col bg-linear-to-t from-black/10 to-transparent opacity-0 transition-opacity data-visible:opacity-100"
	>
		<!-- <media-controls-group class="pointer-events-auto flex w-full items-center px-2">
		</media-controls-group> -->
		<div class="mt-10 flex-1"></div>
		<media-controls-group class="pointer-events-auto grid w-full place-items-center px-2">
			<media-play-button
				onclick={() => (PLAYERS.didUserInteract = true)}
				onkeydown={() => (PLAYERS.didUserInteract = true)}
				role="button"
				tabindex="0"
				class="group relative grid size-20 cursor-pointer place-items-center rounded-full bg-black/50 ring-sky-400 outline-none ring-inset hover:bg-white/20 data-focus:ring-4"
			>
				<media-icon type="play" class="hidden size-10 group-data-paused:block">
					<svg xmlns="http://www.w3.org/2000/svg" fill="#ffffff" viewBox="0 0 256 256"
						><path
							d="M228.23,134.69,84.15,222.81A8,8,0,0,1,72,216.12V39.88a8,8,0,0,1,12.15-6.69l144.08,88.12A7.82,7.82,0,0,1,228.23,134.69Z"
							opacity="0.2"
						></path><path
							d="M232.4,114.49,88.32,26.35a16,16,0,0,0-16.2-.3A15.86,15.86,0,0,0,64,39.87V216.13A15.94,15.94,0,0,0,80,232a16.07,16.07,0,0,0,8.36-2.35L232.4,141.51a15.81,15.81,0,0,0,0-27ZM80,215.94V40l143.83,88Z"
						></path></svg
					>
				</media-icon>
				<media-icon type="pause" class="size-10 group-data-paused:hidden">
					<svg xmlns="http://www.w3.org/2000/svg" fill="#ffffff" viewBox="0 0 256 256"
						><path
							d="M208,48V208a8,8,0,0,1-8,8H160a8,8,0,0,1-8-8V48a8,8,0,0,1,8-8h40A8,8,0,0,1,208,48ZM96,40H56a8,8,0,0,0-8,8V208a8,8,0,0,0,8,8H96a8,8,0,0,0,8-8V48A8,8,0,0,0,96,40Z"
							opacity="0.2"
						></path><path
							d="M200,32H160a16,16,0,0,0-16,16V208a16,16,0,0,0,16,16h40a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm0,176H160V48h40ZM96,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V48A16,16,0,0,0,96,32Zm0,176H56V48H96Z"
						></path></svg
					>
				</media-icon>
			</media-play-button>
		</media-controls-group>
		<div class="flex-1"></div>
		<media-controls-group class="pointer-events-auto flex w-full items-center px-2">
			<media-time-slider
				class="group relative mx-[7.5px] inline-flex h-10 w-full cursor-pointer touch-none items-center outline-none select-none aria-hidden:hidden"
			>
				<div
					class="relative z-0 h-1.25 w-full rounded-sm bg-white/30 ring-sky-400 group-data-focus:ring-[3px]"
				>
					<div
						class="absolute h-full w-(--slider-fill) rounded-sm bg-indigo-400 will-change-[width]"
					></div>
					<div
						class="absolute z-10 h-full w-(--slider-progress) rounded-sm bg-white/50 will-change-[width]"
					></div>
				</div>
				<div
					class="absolute top-1/2 left-(--slider-fill) z-20 h-3.75 w-3.75 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#cacaca] bg-white opacity-0 ring-white/40 transition-opacity will-change-[left] group-data-active:opacity-100 group-data-dragging:ring-4"
				></div>
			</media-time-slider>
		</media-controls-group>
	</media-controls>
</media-player>
