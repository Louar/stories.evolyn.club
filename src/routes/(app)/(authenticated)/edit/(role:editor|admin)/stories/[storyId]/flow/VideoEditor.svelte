<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import OrientationInput from '$lib/components/ui/orientation-input/orientation-input.svelte';
	import * as Select from '$lib/components/ui/select/index.js';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { Toggle } from '$lib/components/ui/toggle/index.js';
	import type { findOneVideoById } from '$lib/db/repositories/2-stories-module';
	import { formatFormError } from '$lib/db/schemas/0-utils';
	import { EDITORS } from '$lib/states/editors.svelte';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import CircleXIcon from '@lucide/svelte/icons/circle-x';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import SquarePlusIcon from '@lucide/svelte/icons/square-plus';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { toast } from 'svelte-sonner';
	import { z } from 'zod/v4';
	import type { $ZodIssue } from 'zod/v4/core';
	import VideoValidator from './VideoValidator.svelte';

	type Props = {
		storyId: string;
		close: (output: {
			action: 'persist' | 'delete';
			id?: string;
			video?: Awaited<ReturnType<typeof findOneVideoById>>;
		}) => void;
	};
	let { storyId, close }: Props = $props();

	let videos = $derived(EDITORS.videos);

	// Initialize quiz from quizzes prop or use default
	const defaultVideo: (typeof videos)[number] = {
		id: 'new',
		name: '',
		source: {},
		thumbnail: {},
		captions: {},
		duration: 0
	};
	let video = $state(defaultVideo);
	let error = $state<$ZodIssue[] | null>(null);

	let isLoading = $state(false);
	let hasError: boolean | undefined = $state(undefined);
	let src = $state<string | undefined>();

	const persist = async (event: Event) => {
		event.preventDefault();

		const result = await fetch(`/api/stories/${storyId}/videos/${video.id ?? 'new'}`, {
			method: 'POST',
			body: JSON.stringify(video)
		});

		if (!result.ok) {
			toast.error(result.statusText ?? 'Something went wrong', {
				closeButton: true,
				duration: Infinity
			});
			if (result.status === 422) error = await result.json();
		} else {
			error = null;
			close({ action: 'persist', video: await result.json() });
		}
	};
	const remove = async () => {
		if (!video.id?.length) return;
		const result = await fetch(`/api/stories/${storyId}/videos/${video.id}`, {
			method: 'DELETE'
		});
		if (!result.ok) {
			toast.error(result.statusText ?? 'Something went wrong', {
				closeButton: true,
				duration: Infinity
			});
			if (result.status === 422) error = await result.json();
		} else {
			close({ action: 'delete', id: video.id });
			video = defaultVideo;
		}
	};

	const setError = async (error: boolean | undefined) => {
		hasError = error;
		src = undefined;
		isLoading = false;
	};
	const setDuration = async (duration: number | undefined) => {
		if (duration) video.duration = duration;
		else video.duration = 0;
	};
</script>

<form onsubmit={persist}>
	<Dialog.Content
		class="scrollbar-none max-h-[90vh] overflow-y-auto pt-0 sm:max-w-200"
		showCloseButton={false}
	>
		<Dialog.Header class="sticky top-0 z-50 -mx-6 bg-background/50 pt-6 backdrop-blur-md">
			<div class="flex flex-col justify-between gap-2 px-6 md:flex-row">
				<div class="flex grow flex-wrap items-center gap-2">
					{#if videos && videos.length > 0}
						<Dialog.Title>Edit:</Dialog.Title>
						<div>
							<Select.Root
								type="single"
								value={video.id ?? 'none'}
								onValueChange={(value) =>
									(video = videos.find((v) => v.id === value) ?? defaultVideo)}
							>
								<Select.Trigger
									class="min-w-40 {videos.find((v) => video.id && v.id === video.id)
										? ''
										: 'text-muted-foreground'}"
								>
									{videos.find((a) => video.id && a.id === video.id)?.name ?? 'Select a video...'}
								</Select.Trigger>
								<Select.Content align="start">
									<Select.Group>
										<!-- <Select.GroupHeading>Videos</Select.GroupHeading> -->
										{#each videos as video}
											<Select.Item class="block" value={video.id}>
												<p>{video.name}</p>
											</Select.Item>
										{/each}
									</Select.Group>
								</Select.Content>
							</Select.Root>
						</div>
						<Separator orientation="vertical" class="mr-2 ml-4" />
					{/if}
					<Toggle
						size="default"
						variant="default"
						class="bg-card! {video?.id === 'new'
							? 'text-blue-600! *:[svg]:fill-blue-100! *:[svg]:stroke-blue-500!'
							: ''}"
						onclick={() => (video = defaultVideo)}
					>
						<SquarePlusIcon />
						New
					</Toggle>
				</div>

				<div class="flex flex-wrap gap-2">
					<Dialog.Close class={buttonVariants({ variant: 'outline' })}>Cancel</Dialog.Close>
					{#if video.id && video.id !== 'new'}
						<Button variant="destructive" size="icon" onclick={remove}>
							<TrashIcon />
						</Button>
					{/if}
					<Button type="submit" disabled={isLoading || hasError} onclick={persist}>
						Save video
					</Button>
				</div>
			</div>

			<Separator class="mt-4" />
		</Dialog.Header>

		<Field.Group class="gap-2">
			<Field.Field>
				<Field.Label>Video reference name</Field.Label>
				<Input bind:value={video.name} placeholder="Name..." />
				<Field.Error>
					{formatFormError(error, `name`)}
				</Field.Error>
			</Field.Field>
			<Field.Field>
				<Field.Label>
					Source
					{#if isLoading}
						<LoaderIcon class="size-4 animate-spin text-muted-foreground" />
					{/if}
					{#if !isLoading && hasError === false}
						<CircleCheckIcon
							class="size-4 rounded-full border border-emerald-500 bg-emerald-500 text-white"
						/>
					{:else if !isLoading && hasError === true}
						<CircleXIcon
							class="size-4 rounded-full border border-rose-500 bg-rose-500 text-white"
						/>
					{/if}
				</Field.Label>
				<OrientationInput
					bind:value={video.source}
					placeholder=".m3u8 stream URL, or YouTube URL"
					oninput={(e) => {
						const url = z.url().min(1).safeParse(e.currentTarget.value)?.data;
						src = url;
						if (url?.length) isLoading = true;
					}}
				/>
				<Field.Error>
					{formatFormError(error, `source.*`)}
				</Field.Error>

				{#if src?.length}
					<VideoValidator {src} {setError} {setDuration} />
				{/if}
			</Field.Field>
			<Field.Field>
				<Field.Label>Thumbnail (optional)</Field.Label>
				<OrientationInput bind:value={video.thumbnail} placeholder="Thumbnail URL" />
				<Field.Error>
					{formatFormError(error, `thumbnail.*`)}
				</Field.Error>
			</Field.Field>
			<Field.Field>
				<Field.Label>Duration (in seconds)</Field.Label>
				<Input
					type="number"
					bind:value={video.duration}
					placeholder="Duration..."
					class="text-muted-foreground"
				/>
				<Field.Error>
					{formatFormError(error, `duration`)}
				</Field.Error>
			</Field.Field>
		</Field.Group>
	</Dialog.Content>
</form>
