<script lang="ts">
	import { getVideoSourceType, getYouTubeEmbedUrl } from '$lib/media/video';
	import { cn } from '$lib/utils';
	import Hls from 'hls.js';
	import { onDestroy } from 'svelte';

	type Props = {
		src?: string;
		time: number;
		label: string;
		class?: string;
	};

	let { src, time, label, class: className }: Props = $props();

	let video: HTMLVideoElement = $state()!;
	let hls: Hls | undefined;
	let loadedSrc: string | undefined;
	let canPreview = false;
	let sourceType = $derived(src ? getVideoSourceType(src) : undefined);
	let isPreviewable = $derived(sourceType === 'native' || sourceType === 'hls');
	let youtubePreviewUrl = $derived(
		sourceType === 'youtube' && src ? getYouTubeEmbedUrl(src, { start: time }) : undefined
	);

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

	onDestroy(() => hls?.destroy());
</script>

<div class={cn('overflow-hidden rounded-md border bg-muted', className)}>
	{#if src && isPreviewable}
		<div class="aspect-video w-full bg-black">
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
		</div>
	{:else if youtubePreviewUrl}
		<div class="aspect-video w-full bg-black">
			<iframe
				class="size-full"
				src={youtubePreviewUrl}
				title={label}
				loading="lazy"
				referrerpolicy="strict-origin-when-cross-origin"
				allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
			></iframe>
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
