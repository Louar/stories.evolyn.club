<script lang="ts">
	import HeaderBlank from '$lib/components/app/header/app-header-blank.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { MediaFile } from '$lib/components/ui/media-file/index.js';
	import type { findOneVideoById } from '$lib/db/repositories/2-story-module.js';
	import { translateLocalizedMediaField, type TranslatableMedia } from '$lib/db/schemas/0-utils.js';
	import { getYouTubeThumbnailUrl } from '$lib/media/video.js';
	import { UI } from '$lib/states/ui.svelte.js';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import SearchIcon from '@lucide/svelte/icons/search';
	import VideoIcon from '@lucide/svelte/icons/video';
	import XIcon from '@lucide/svelte/icons/x';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	type Video = Awaited<ReturnType<typeof findOneVideoById>>;
	type VideoAsset = Omit<Video, 'id'> & { id: string; asset: string };
	type Props = {
		storyId: string;
		selectedVideoIds: string[];
		close: (video?: Video) => void;
	};

	let { storyId, selectedVideoIds, close }: Props = $props();
	let videos = $state<Video[]>([]);
	let isLoading = $state(true);
	let addingId = $state<string>();
	let loadError = $state(false);
	let search = $state('');

	const getMedia = (value?: TranslatableMedia | null) =>
		translateLocalizedMediaField(value, UI.language);
	const getYouTubeThumbnail = (video: Video) => {
		const source = getMedia(video.source);
		return source ? getYouTubeThumbnailUrl(source.filename) : undefined;
	};
	let filteredVideos = $derived.by(() => {
		const query = search.trim().toLocaleLowerCase();
		if (!query) return videos;
		return videos.filter((video) => {
			const source = getMedia(video.source)?.filename ?? '';
			return `${video.name} ${source}`.toLocaleLowerCase().includes(query);
		});
	});

	const loadVideos = async () => {
		isLoading = true;
		loadError = false;
		try {
			const response = await fetch('/api/stories/-/assets?type=video');
			if (!response.ok) throw new Error('Loading videos failed');
			const assets = (await response.json()) as VideoAsset[];
			videos = assets
				.filter((asset) => !selectedVideoIds.includes(asset.asset))
				.map((asset) => ({
					id: asset.asset,
					name: asset.name,
					source: asset.source,
					thumbnail: asset.thumbnail,
					captions: asset.captions,
					duration: asset.duration
				}));
		} catch {
			loadError = true;
		} finally {
			isLoading = false;
		}
	};

	const selectVideo = async (video: Video) => {
		addingId = video.id;
		try {
			const response = await fetch(`/api/stories/${storyId}/assets`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ type: 'video', asset: video.id })
			});
			if (!response.ok) throw new Error('Adding video failed');
			toast.success('Video added to story');
			close(video);
		} catch {
			toast.error('Could not add video to story');
		} finally {
			addingId = undefined;
		}
	};

	onMount(loadVideos);
</script>

<div class="flex h-full min-h-0 flex-col">
	<HeaderBlank class="w-full shrink-0">
		<div class="px-2">
			<h1 class="text-sm font-medium">Add a video</h1>
			<p class="text-xs text-muted-foreground">Choose a video from a story you can edit.</p>
		</div>
		<Button class="ml-auto" variant="ghost" size="icon" onclick={() => close()} aria-label="Close">
			<XIcon />
		</Button>
	</HeaderBlank>

	<div class="min-h-0 flex-1 muted-scrollbar overflow-y-auto p-4">
		{#if isLoading}
			<div class="grid min-h-48 place-items-center text-muted-foreground">
				<LoaderIcon class="size-6 animate-spin" aria-label="Loading videos" />
			</div>
		{:else if loadError}
			<div class="grid min-h-48 place-items-center gap-3 text-center">
				<p class="text-sm text-muted-foreground">Could not load available videos.</p>
				<Button variant="outline" onclick={loadVideos}>Try again</Button>
			</div>
		{:else}
			<div class="relative mb-4">
				<SearchIcon
					class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					bind:value={search}
					class="pl-9"
					placeholder="Search videos..."
					aria-label="Search videos"
				/>
			</div>
			<div class="grid grid-cols-2 gap-3">
				{#each filteredVideos as video (video.id)}
					{@const thumbnail = getMedia(video.thumbnail)}
					{@const youtubeThumbnail = thumbnail ? undefined : getYouTubeThumbnail(video)}
					<button
						type="button"
						class="group overflow-hidden rounded-lg border bg-card text-left shadow-xs transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-60"
						disabled={addingId !== undefined}
						onclick={() => selectVideo(video)}
					>
						<div class="relative grid aspect-video place-items-center overflow-hidden bg-muted">
							{#if thumbnail}
								<MediaFile
									src={thumbnail}
									class="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-xl"
								/>
								<MediaFile src={thumbnail} class="relative h-full w-full object-contain" />
							{:else if youtubeThumbnail}
								<img src={youtubeThumbnail} alt="" class="h-full w-full object-cover" />
							{:else}
								<VideoIcon class="size-10 text-muted-foreground/60" />
							{/if}
							{#if addingId === video.id}
								<div class="absolute inset-0 grid place-items-center bg-background/70">
									<LoaderIcon class="size-6 animate-spin" aria-label="Adding video" />
								</div>
							{/if}
						</div>
						<div class="p-3">
							<p class="truncate text-sm font-medium">{video.name || 'Untitled video'}</p>
							<p class="text-xs text-muted-foreground">{Math.round(video.duration)} seconds</p>
						</div>
					</button>
				{:else}
					<div
						class="col-span-2 grid min-h-48 place-items-center rounded-lg border border-dashed p-6"
					>
						<div class="text-center">
							<VideoIcon class="mx-auto mb-3 size-8 text-muted-foreground/60" />
							<p class="text-sm font-medium">
								{search.trim() ? 'No videos match your search' : 'No videos available'}
							</p>
							<p class="mt-1 text-xs text-muted-foreground">
								{search.trim()
									? 'Try a different name or source.'
									: 'Videos already added to this story are not shown.'}
							</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
