<script lang="ts">
	import { MediaFile } from '$lib/components/ui/media-file';
	import { MediaCollection, type Media } from '$lib/db/schemas/0-utils';
	import {
		createYouTubePlayer,
		getVideoSourceType,
		type YouTubePlayer,
		type YouTubePlayerState
	} from '$lib/media/video';
	import { PLAYERS } from '$lib/states/players.svelte';
	import { cn } from '$lib/utils';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import PlayIcon from '@lucide/svelte/icons/play';
	import type { ClassValue } from 'clsx';
	import Hls from 'hls.js';
	import { onDestroy } from 'svelte';

	type Props = {
		id: string;
		title?: string | undefined;
		src: Media;
		poster?: Media | null | undefined;
		start?: number | undefined;
		end?: number | undefined;
		playbackRate?: number | undefined;
		isInitialPart: boolean;
		isActive: boolean;

		doBuffer: boolean;
		doPlay: boolean;
		doPause: boolean;
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
		title,
		src,
		poster,
		start,
		end,
		playbackRate,
		isInitialPart,
		isActive,

		doBuffer = $bindable(false),
		doPlay = $bindable(false),
		doPause = $bindable(false),
		doRestart = $bindable(false),
		doEnd = $bindable(false),
		time = $bindable(0),
		isOverlaid = $bindable(false),

		bufferNext,
		playNext,

		class: className
	}: Props = $props();

	const mediaUrl = (media: Media) =>
		media.collection === MediaCollection.externals
			? media.filename
			: `/api/media/${media.collection}/${media.filename}`;

	const source = $derived(mediaUrl(src));
	const sourceType = $derived(getVideoSourceType(source));
	const clipStart = $derived(start ?? 0);

	let video: HTMLVideoElement = $state()!;
	let ambientCanvas: HTMLCanvasElement = $state()!;
	let playerContainer: HTMLDivElement = $state()!;
	let youtubeContainer: HTMLDivElement = $state()!;
	let youtube: YouTubePlayer | undefined;
	let hls: Hls | undefined;
	let watchTimer: ReturnType<typeof setInterval> | undefined;
	let progressTimer: ReturnType<typeof setInterval> | undefined;
	let ambientTimer: ReturnType<typeof setTimeout> | undefined;
	let youtubeReadyTimer: ReturnType<typeof setInterval> | undefined;

	let isLoaded = $state(false);
	let canPlay = $state(false);
	let isPlaying = $state(false);
	let hasStarted = $state(false);
	let almostEnded = $state(false);
	let isEnded = $state(false);
	let didHandleEnd = $state(false);
	let mediaDuration = $state(0);

	const clipDuration = $derived(
		Math.max(0, Math.min(end ?? mediaDuration, mediaDuration) - clipStart)
	);
	const progressPercentage = $derived(
		clipDuration > 0 ? Math.min(100, Math.max(0, (time / clipDuration) * 100)) : 0
	);

	const getCurrentTime = () =>
		sourceType === 'youtube'
			? (youtube?.getCurrentTime() ?? clipStart)
			: (video?.currentTime ?? clipStart);

	const setAmbientCanvasSize = () => {
		if (!ambientCanvas || !playerContainer) return;

		const ratio = window.devicePixelRatio || 1;
		const width = Math.max(1, Math.round(playerContainer.offsetWidth * ratio));
		const height = Math.max(1, Math.round(playerContainer.offsetHeight * ratio));
		if (ambientCanvas.width === width && ambientCanvas.height === height) return;

		ambientCanvas.width = width;
		ambientCanvas.height = height;
	};

	const paintAmbientVideo = () => {
		if (!ambientCanvas || !video || sourceType === 'youtube') return;

		setAmbientCanvasSize();
		const context = ambientCanvas.getContext('2d');
		if (!context || video.readyState < 2) return;

		try {
			context.drawImage(video, 0, 0, ambientCanvas.width, ambientCanvas.height);
		} catch {
			// Some external videos can block drawing to canvas; playback should continue normally.
		}
	};

	const startAmbientVideo = () => {
		if (sourceType === 'youtube' || ambientTimer) return;

		const loop = () => {
			paintAmbientVideo();
			if (isPlaying && !video?.paused && !video?.ended) {
				ambientTimer = setTimeout(loop, 1000 / 30);
			} else {
				ambientTimer = undefined;
			}
		};

		loop();
	};

	const stopAmbientVideo = () => {
		if (ambientTimer) clearTimeout(ambientTimer);
		ambientTimer = undefined;
	};

	const seekTo = (clipTime: number) => {
		const absoluteTime = clipStart + Math.min(Math.max(clipTime, 0), clipDuration);
		if (sourceType === 'youtube') youtube?.seekTo(absoluteTime, true);
		else if (video) video.currentTime = absoluteTime;
		time = absoluteTime - clipStart;
	};

	const updateProgress = () => {
		if (!canPlay) return;

		time = Math.max(0, getCurrentTime() - clipStart);
		const timeLeft = clipDuration - time;
		if (!almostEnded && timeLeft <= 30) almostEnded = true;
		if (!isEnded && clipDuration > 0 && time >= clipDuration - 0.05) handleEnded();
	};

	const startProgressTimer = () => {
		if (progressTimer) return;
		progressTimer = setInterval(updateProgress, 100);
	};

	const stopProgressTimer = () => {
		if (progressTimer) clearInterval(progressTimer);
		progressTimer = undefined;
	};

	const startWatching = () => {
		if (!isActive) {
			pauseMedia();
			return;
		}

		isPlaying = true;
		hasStarted = true;
		PLAYERS.isAnyPartPlaying = true;
		startProgressTimer();
		startAmbientVideo();
		if (watchTimer) return;
		watchTimer = setInterval(
			() => (PLAYERS.watchDurations[id] = (PLAYERS.watchDurations[id] ?? 0) + 0.1),
			100
		);
	};

	const pauseWatching = () => {
		isPlaying = false;
		PLAYERS.isAnyPartPlaying = false;
		stopAmbientVideo();
		paintAmbientVideo();
		stopProgressTimer();
		if (watchTimer) clearInterval(watchTimer);
		watchTimer = undefined;
		updateProgress();
	};

	const endWatching = () => {
		pauseWatching();
		if ((PLAYERS.watchDurations[id] ?? 0) > 0 && clipDuration > 0) {
			PLAYERS.watchTimePercentages[id] = (PLAYERS.watchDurations[id] / clipDuration) * 100;
		}
	};

	const handleEnded = () => {
		if (isEnded) return;
		isEnded = true;
		time = clipDuration;
		pauseMedia();
		endWatching();
	};

	const handleYouTubeState = (state: YouTubePlayerState) => {
		if (state === 1 && !isActive) pauseMedia();
		else if (state === 1) startWatching();
		else if (state === 0) handleEnded();
		else if (state === 2 || state === 3) pauseWatching();
	};

	const initializeNativeVideo = () => {
		if (sourceType === 'hls' && Hls.isSupported()) {
			hls = new Hls();
			hls.loadSource(source);
			hls.attachMedia(video);
			return;
		}

		video.src = source;
		video.load();
	};

	const initializeYouTube = async () => {
		try {
			youtube = await createYouTubePlayer(youtubeContainer, source, {
				start: clipStart,
				onReady: (player) => {
					youtube = player;
					player.getIframe().title = title ?? 'YouTube video player';
					if (!isActive) player.pauseVideo();
					const markReady = () => {
						const duration = player.getDuration();
						if (duration <= 0) return;

						mediaDuration = duration;
						player.setPlaybackRate(playbackRate ?? 1);
						canPlay = true;
						if (youtubeReadyTimer) clearInterval(youtubeReadyTimer);
						youtubeReadyTimer = undefined;
					};
					youtubeReadyTimer = setInterval(markReady, 250);
					markReady();
				},
				onStateChange: handleYouTubeState,
				onError: () => {
					if (youtubeReadyTimer) clearInterval(youtubeReadyTimer);
					youtubeReadyTimer = undefined;
					canPlay = false;
				}
			});
		} catch {
			canPlay = false;
		}
	};

	const load = () => {
		if (isLoaded) return;
		isLoaded = true;
		if (sourceType === 'youtube') void initializeYouTube();
		else if (sourceType !== 'unsupported') initializeNativeVideo();
	};

	const pauseMedia = () => {
		if (sourceType === 'youtube') youtube?.pauseVideo();
		else video?.pause();
	};

	const playMedia = async () => {
		if (!isActive) return;

		if (sourceType === 'youtube') {
			youtube?.playVideo();
			return;
		}

		try {
			await video?.play();
		} catch {
			// Playback can still be rejected when the browser has not registered a user gesture.
		}
	};

	const restart = () => {
		if (!canPlay || !isActive) return;
		time = 0;
		seekTo(0);
		PLAYERS.watchDurations[id] = 0;
		PLAYERS.watchTimePercentages[id] = 0;
		doPlay = false;
		doPause = false;
		doRestart = false;
		almostEnded = false;
		isEnded = false;
		doEnd = false;
		didHandleEnd = false;
		void playMedia();
	};

	const stopAndEndWatching = () => {
		pauseMedia();
		endWatching();
		if (isEnded) didHandleEnd = true;
	};

	$effect(() => {
		if (doBuffer) load();
	});

	$effect(() => {
		if (PLAYERS.didUserInteract && almostEnded) bufferNext();
	});

	$effect(() => {
		if (PLAYERS.didUserInteract && isEnded && !didHandleEnd) {
			didHandleEnd = true;
			doPlay = false;
			playNext();
		}
	});

	$effect(() => {
		if (doEnd) stopAndEndWatching();
	});

	$effect(() => {
		if (!doPlay || !PLAYERS.didUserInteract || !isActive) return;
		load();
		if (canPlay && !isPlaying) restart();
	});

	$effect(() => {
		if (!doRestart || !isActive) return;
		load();
		if (canPlay) restart();
	});

	$effect(() => {
		if (doPause && isPlaying) {
			pauseMedia();
			doPause = false;
		}
	});

	$effect(() => {
		if (!isActive) pauseMedia();
	});

	const resizeAmbient = () => {
		setAmbientCanvasSize();
		paintAmbientVideo();
	};

	onDestroy(() => {
		if (watchTimer) clearInterval(watchTimer);
		if (progressTimer) clearInterval(progressTimer);
		if (ambientTimer) clearTimeout(ambientTimer);
		if (youtubeReadyTimer) clearInterval(youtubeReadyTimer);
		hls?.destroy();
		youtube?.destroy();
	});
</script>

<svelte:window onresize={resizeAmbient} />

<div
	bind:this={playerContainer}
	class={cn('group relative size-full overflow-hidden bg-black', className)}
>
	{#if poster && isInitialPart && !hasStarted}
		<MediaFile
			src={poster}
			class="pointer-events-none absolute inset-0 z-0 size-full scale-125 object-cover opacity-60 blur-3xl"
		/>
	{:else if sourceType !== 'youtube'}
		<canvas
			bind:this={ambientCanvas}
			class="pointer-events-none absolute inset-0 z-0 size-full scale-125 opacity-60 blur-3xl"
			aria-hidden="true"
		></canvas>
	{/if}

	{#if !canPlay}
		<div
			class="pointer-events-none absolute inset-0 z-10 grid place-items-center text-white opacity-50"
		>
			<LoaderIcon class="size-14 animate-spin" />
		</div>
	{/if}

	{#if sourceType === 'youtube'}
		<div
			bind:this={youtubeContainer}
			class="pointer-events-none absolute inset-0 z-10 size-full"
		></div>
	{:else}
		<video
			bind:this={video}
			class="absolute inset-0 z-10 size-full object-contain"
			aria-label={title}
			preload="none"
			playsinline
			onloadedmetadata={() => {
				mediaDuration = video.duration;
				video.playbackRate = playbackRate ?? 1;
				seekTo(0);
				paintAmbientVideo();
			}}
			oncanplay={() => (canPlay = true)}
			onplay={startWatching}
			onplaying={startWatching}
			onpause={pauseWatching}
			onwaiting={pauseWatching}
			onseeking={pauseWatching}
			onseeked={() => {
				updateProgress();
				if (!video.paused) startWatching();
			}}
			onended={handleEnded}
		></video>
	{/if}

	{#if poster && isInitialPart && !hasStarted}
		<MediaFile
			src={poster}
			class="pointer-events-none absolute inset-0 z-10 size-full object-contain"
		/>
	{/if}

	<div
		class="pointer-events-none absolute inset-0 z-20 flex size-full flex-col bg-linear-to-t from-black/10 to-transparent opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
	>
		<div class="pointer-events-auto grid h-full w-full place-items-center">
			<button
				type="button"
				aria-label={isPlaying ? 'Pause' : 'Play'}
				class="group/control grid size-full place-items-center px-2 pt-10 outline-none"
				onclick={() => {
					if (!isActive) return;
					PLAYERS.didUserInteract = true;
					load();
					if (isPlaying) pauseMedia();
					else if (canPlay) void playMedia();
					else doPlay = true;
				}}
			>
				{#if !isOverlaid && !isPlaying}
					<div
						class="grid size-24 cursor-pointer place-items-center rounded-full bg-black/50 text-white ring-black backdrop-blur-md transition-colors outline-none group-hover/control:bg-black/30 group-focus/control:ring-4"
					>
						<PlayIcon
							class="size-12 opacity-80 transition-opacity group-hover/control:opacity-100"
						/>
					</div>
				{/if}
			</button>
		</div>
		<div class="pointer-events-auto flex w-full items-center px-4 pb-2">
			<div
				class="relative h-10 w-full cursor-pointer touch-none outline-none"
				style={`--slider-fill: ${progressPercentage}%`}
			>
				<div
					class="absolute top-1/2 h-2 w-full -translate-y-1/2 overflow-hidden rounded-sm bg-white/20 backdrop-blur-md"
				>
					<div class="h-full w-(--slider-fill) rounded-sm bg-white"></div>
				</div>
				<input
					type="range"
					aria-label="Video progress"
					class="absolute inset-0 size-full cursor-pointer opacity-0"
					min="0"
					max={clipDuration || 0}
					step="0.01"
					value={time}
					disabled={!canPlay}
					oninput={(event) => seekTo(event.currentTarget.valueAsNumber)}
				/>
			</div>
		</div>
	</div>
</div>

<style lang="postcss">
	@reference 'tailwindcss';

	:global(iframe[src*='youtube-nocookie.com']) {
		@apply size-full;
	}
</style>
