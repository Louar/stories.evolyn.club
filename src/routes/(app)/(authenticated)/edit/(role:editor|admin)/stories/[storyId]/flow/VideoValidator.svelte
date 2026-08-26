<script lang="ts">
	import { createYouTubePlayer, getVideoSourceType, type YouTubePlayer } from '$lib/media/video.js';
	import Hls from 'hls.js';

	type Props = {
		src: string;
		setError: (hasError: boolean | undefined) => void;
		setDuration: (duration: number | undefined) => void;
	};
	let { src, setError, setDuration }: Props = $props();

	let video: HTMLVideoElement = $state()!;
	let youtubeContainer: HTMLDivElement = $state()!;

	$effect(() => {
		const sourceType = getVideoSourceType(src);
		let hls: Hls | undefined;
		let youtube: YouTubePlayer | undefined;
		let durationTimer: ReturnType<typeof setInterval> | undefined;
		let durationTimeout: ReturnType<typeof setTimeout> | undefined;
		let handleMetadata: (() => void) | undefined;
		let handleError: (() => void) | undefined;
		let disposed = false;

		const fail = () => {
			if (disposed) return;
			setDuration(undefined);
			setError(true);
		};

		const succeed = (duration: number) => {
			if (disposed || !Number.isFinite(duration) || duration <= 0) return;
			setDuration(Math.round(duration));
			setError(false);
		};

		if (sourceType === 'youtube') {
			void createYouTubePlayer(youtubeContainer, src, {
				onReady: (player) => {
					youtube = player;
					const readDuration = () => {
						const duration = player.getDuration();
						if (duration > 0) {
							if (durationTimer) clearInterval(durationTimer);
							durationTimer = undefined;
							succeed(duration);
						}
					};
					durationTimer = setInterval(readDuration, 250);
					readDuration();
					durationTimeout = setTimeout(() => {
						if (durationTimer) {
							clearInterval(durationTimer);
							durationTimer = undefined;
							fail();
						}
					}, 15_000);
				},
				onStateChange: () => {},
				onError: fail
			}).then((player) => {
				if (disposed) player.destroy();
				else youtube = player;
			}, fail);
		} else if (sourceType === 'unsupported') {
			fail();
		} else {
			handleMetadata = () => succeed(video.duration);
			handleError = () => fail();
			video.addEventListener('loadedmetadata', handleMetadata);
			video.addEventListener('error', handleError);

			if (sourceType === 'hls' && Hls.isSupported()) {
				hls = new Hls();
				hls.on(Hls.Events.ERROR, (_event, data) => {
					if (data.fatal) fail();
				});
				hls.loadSource(src);
				hls.attachMedia(video);
			} else {
				video.src = src;
				video.load();
			}
		}

		return () => {
			disposed = true;
			if (durationTimer) clearInterval(durationTimer);
			if (durationTimeout) clearTimeout(durationTimeout);
			hls?.destroy();
			youtube?.destroy();
			if (handleMetadata) video?.removeEventListener('loadedmetadata', handleMetadata);
			if (handleError) video?.removeEventListener('error', handleError);
			video?.removeAttribute('src');
			video?.load();
		};
	});
</script>

<div class="pointer-events-none fixed size-px overflow-hidden opacity-0" aria-hidden="true">
	<video bind:this={video} preload="metadata" muted playsinline></video>
	<div bind:this={youtubeContainer}></div>
</div>
