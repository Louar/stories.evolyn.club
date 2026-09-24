<script lang="ts">
	import {
		createYouTubePlayer,
		getVideoSourceType,
		isYouTubeShort,
		type YouTubePlayer
	} from '$lib/media/video';
	import { cn } from '$lib/utils';
	import Hls from 'hls.js';
	import { onDestroy } from 'svelte';

	const YOUTUBE_PREVIEW_DEBOUNCE_MS = 200;

	type Props = {
		src?: string;
		time: number;
		label: string;
		class?: string;
	};

	let { src, time, label, class: className }: Props = $props();

	let video: HTMLVideoElement = $state()!;
	let youtubeElement: HTMLDivElement = $state()!;
	let youtubePlayer = $state<YouTubePlayer>();
	let hls: Hls | undefined;
	let loadedSrc: string | undefined;
	let loadedYouTubeSrc: string | undefined;
	let canPreview = $state(false);
	let canPreviewYouTube = $state(false);
	let youtubePreviewTimer: ReturnType<typeof setTimeout> | undefined;
	let youtubePauseTimer: ReturnType<typeof setTimeout> | undefined;
	let shouldPauseYouTube = false;
	let sourceType = $derived(src ? getVideoSourceType(src) : undefined);
	let isPreviewable = $derived(sourceType === 'native' || sourceType === 'hls');
	let isYouTubePreviewable = $derived(sourceType === 'youtube' && !!src);
	let isShort = $derived(sourceType === 'youtube' && src ? isYouTubeShort(src) : false);

	function clearYouTubeTimers() {
		clearTimeout(youtubePreviewTimer);
		clearTimeout(youtubePauseTimer);
	}

	function seekAndPauseYouTube(nextTime: number) {
		if (!youtubePlayer) return;

		youtubePlayer.mute();
		youtubePlayer.seekTo(Math.max(0, nextTime), true);
		shouldPauseYouTube = true;
		youtubePlayer.playVideo();
		youtubePauseTimer = setTimeout(() => {
			if (!shouldPauseYouTube || !youtubePlayer) return;

			youtubePlayer.pauseVideo();
			shouldPauseYouTube = false;
		}, 100);
	}

	function previewYouTubeFrame(nextTime: number, delay = YOUTUBE_PREVIEW_DEBOUNCE_MS) {
		clearYouTubeTimers();
		if (delay <= 0) {
			seekAndPauseYouTube(nextTime);
			return;
		}

		youtubePreviewTimer = setTimeout(() => seekAndPauseYouTube(nextTime), delay);
	}

	function styleYouTubeIframe(player: YouTubePlayer) {
		const iframe = player.getIframe();
		iframe.title = label;
		iframe.classList.add('vds-youtube');
		iframe.dataset.noControls = 'true';
		iframe.dataset.aspect = isShort ? 'shorts' : 'video';
		iframe.style.width = isShort ? '1000%' : '100%';
		iframe.style.height = isShort ? '100%' : '1000%';
		iframe.style.left = isShort ? '-450%' : '0';
		iframe.style.top = isShort ? '0' : '-450%';
	}

	$effect(() => {
		if (!video || !src || src === loadedSrc) return;

		loadedSrc = src;
		canPreview = false;
		hls?.destroy();
		hls = undefined;

		if (!isPreviewable) return;

		if (sourceType === 'hls' && Hls.isSupported()) {
			hls = new Hls();
			hls.loadSource(src);
			hls.attachMedia(video);
		} else {
			video.src = src;
			video.load();
		}
	});

	$effect(() => {
		const nextTime = time;
		if (!video || !canPreview) return;
		const duration = Number.isFinite(video.duration) ? video.duration : Infinity;
		video.currentTime = Math.max(0, Math.min(nextTime, duration));
	});

	$effect(() => {
		if (!src || sourceType !== 'youtube') {
			loadedYouTubeSrc = undefined;
			canPreviewYouTube = false;
			shouldPauseYouTube = false;
			clearYouTubeTimers();
			youtubePlayer?.destroy();
			youtubePlayer = undefined;
			return;
		}

		if (!youtubeElement || src === loadedYouTubeSrc) return;

		loadedYouTubeSrc = src;
		canPreviewYouTube = false;
		shouldPauseYouTube = false;
		clearYouTubeTimers();
		youtubePlayer?.destroy();
		youtubePlayer = undefined;

		let cancelled = false;
		void createYouTubePlayer(youtubeElement, src, {
			onReady: (player) => {
				if (cancelled) {
					player.destroy();
					return;
				}

				youtubePlayer = player;
				player.mute();
				styleYouTubeIframe(player);
				previewYouTubeFrame(time, 0);
				canPreviewYouTube = true;
			},
			onStateChange: (state) => {
				if (state !== 1 || !shouldPauseYouTube || !youtubePlayer) return;

				youtubePlayer.pauseVideo();
				shouldPauseYouTube = false;
			},
			onError: () => {
				canPreviewYouTube = false;
			}
		});

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		const nextTime = time;
		if (!canPreviewYouTube || !youtubePlayer) return;
		previewYouTubeFrame(nextTime);

		return clearYouTubeTimers;
	});

	onDestroy(() => {
		clearYouTubeTimers();
		hls?.destroy();
		youtubePlayer?.destroy();
	});
</script>

<div class={cn('overflow-hidden rounded-md border bg-muted', className)}>
	{#if src && isPreviewable}
		<div class="relative aspect-video w-full overflow-hidden bg-black">
			<video
				bind:this={video}
				class="mx-auto h-full object-cover"
				muted
				playsinline
				preload="metadata"
				title={label}
				onloadedmetadata={() => {
					canPreview = true;
					const duration = Number.isFinite(video.duration) ? video.duration : Infinity;
					video.currentTime = Math.max(0, Math.min(time, duration));
				}}
			></video>
			<div class="absolute inset-0 bg-transparent" aria-hidden="true"></div>
		</div>
	{:else if isYouTubePreviewable}
		<div class="relative aspect-video w-full overflow-hidden bg-black">
			<div
				bind:this={youtubeElement}
				class="youtube-frame absolute inset-0 size-full"
				title={label}
			></div>
			<div class="absolute inset-0 bg-transparent" aria-hidden="true"></div>
		</div>
	{:else if src}
		<div class="grid aspect-video w-full place-items-center text-xs text-muted-foreground">
			Frame preview is not available for this video source.
		</div>
	{:else}
		<div class="grid aspect-video w-full place-items-center text-xs text-muted-foreground">
			Select a video to preview this frame.
		</div>
	{/if}
</div>

<style lang="postcss">
	@reference 'tailwindcss';

	.youtube-frame :global(iframe[src*='youtube-nocookie.com']) {
		@apply size-full;
		position: absolute;
		inset: 0;
		border: 0;
	}

	.youtube-frame :global(iframe.vds-youtube[data-no-controls][data-aspect='video']) {
		height: 1000% !important;
		top: -450% !important;
	}

	.youtube-frame :global(iframe.vds-youtube[data-no-controls][data-aspect='shorts']) {
		width: 1000% !important;
		left: -450% !important;
	}
</style>
