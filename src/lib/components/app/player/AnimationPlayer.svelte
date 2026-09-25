<script lang="ts">
	import type { PlaybackController } from '@superhq/webmotion';
	import type { WebMotionConfig } from '$lib/media/animation';
	import { PLAYERS } from '$lib/states/players.svelte';
	import * as m from '$lib/paraglide/messages';
	import PlayIcon from '@lucide/svelte/icons/play';
	import { onDestroy, untrack } from 'svelte';
	import WebMotionPlayer from './WebMotionPlayer.svelte';
	import type { Player } from './types';

	let {
		config,
		duration,
		player = $bindable(),
		isActive,
		overlayStart,
		pauseAtOverlay = false,
		onoverlaystart,
		onended
	}: {
		config: WebMotionConfig;
		duration: number;
		player: Player;
		isActive: boolean;
		overlayStart?: number;
		pauseAtOverlay?: boolean;
		onoverlaystart: () => void;
		onended: () => void;
	} = $props();

	// Story navigation owns autoplay and completion, including configs authored to loop.
	const playbackConfig = $derived({ ...config, playback: { autoplay: false, loop: false } });
	let controller = $state<PlaybackController>();
	let paused = false;
	let ended = false;
	let cued = false;
	let lastFrame = 0;
	let unsubscribe = () => {};

	function cue() {
		if (cued || overlayStart === undefined || player.time + 0.02 < overlayStart) return;
		cued = true;
		if (pauseAtOverlay) {
			paused = true;
			controller?.pause();
		}
		onoverlaystart();
	}

	function ready(next: PlaybackController) {
		unsubscribe();
		controller = next;
		const progress = () => {
			if (!isActive) return;
			const frame = next.currentFrame;
			if (next.playing && frame > lastFrame) {
				PLAYERS.watchDurations[player.id] =
					(PLAYERS.watchDurations[player.id] ?? 0) + (frame - lastFrame) / next.fps;
				PLAYERS.watchTimePercentages[player.id] = Math.min(
					100,
					(PLAYERS.watchDurations[player.id] / duration) * 100
				);
			}
			lastFrame = frame;
			player.time = frame / next.fps;
			if (PLAYERS.didUserInteract) cue();
		};
		const finish = () => {
			if (!isActive || ended) return;
			player.time = duration;
			cue();
			if (paused && pauseAtOverlay) return;
			ended = true;
			onended();
		};
		next.addEventListener('w-seek', progress);
		next.addEventListener('w-ended', finish);
		unsubscribe = () => {
			next.removeEventListener('w-seek', progress);
			next.removeEventListener('w-ended', finish);
		};
		next.seek(0);
	}

	function synchronize() {
		if (!controller) return;
		if (!isActive || !PLAYERS.didUserInteract) {
			controller.pause();
			return;
		}
		if (player.doRestart || player.doPlay) {
			paused = ended = cued = false;
			lastFrame = 0;
			player.time = 0;
			player.doRestart = player.doPlay = player.doPause = player.doEnd = false;
			PLAYERS.watchDurations[player.id] = 0;
			PLAYERS.watchTimePercentages[player.id] = 0;
			controller.pause();
			controller.seek(0);
		}
		if (player.doPause || player.doEnd) {
			paused = true;
			player.doPause = false;
		}
		cue();
		if (paused || ended) controller.pause();
		else controller.play();
	}

	$effect(() => {
		// Read commands explicitly; frame/time updates must not retrigger playback commands.
		void [
			controller,
			isActive,
			PLAYERS.didUserInteract,
			player.doRestart,
			player.doPlay,
			player.doPause,
			player.doEnd
		];
		untrack(synchronize);
	});

	onDestroy(() => unsubscribe());
</script>

<div class="absolute inset-0 flex items-center justify-center overflow-hidden">
	<div inert class="pointer-events-none h-full w-full">
		<WebMotionPlayer config={playbackConfig} fit="contain" onready={ready} />
	</div>
	{#if isActive && !PLAYERS.didUserInteract}
		<button
			aria-label={m.player_play()}
			class="absolute grid size-24 cursor-pointer place-items-center rounded-full bg-black/50 text-white backdrop-blur-md"
			onclick={() => {
				PLAYERS.didUserInteract = true;
			}}
		>
			<PlayIcon class="size-12" />
		</button>
	{/if}
</div>
