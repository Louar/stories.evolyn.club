<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { Toggle } from '$lib/components/ui/toggle/index.js';
	import type { findOneStoryById, findOneVideoById } from '$lib/db/repositories/2-stories-module';
	import SquarePlus from '@lucide/svelte/icons/square-plus';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import type { $ZodIssue } from 'zod/v4/core';

	type Props = {
		storyId: string;
		videos: Awaited<ReturnType<typeof findOneStoryById>>['videos'];
		close: (output: {
			action: 'persist' | 'delete';
			id?: string;
			video?: Awaited<ReturnType<typeof findOneVideoById>>;
		}) => void;
	};
	let { storyId, videos, close }: Props = $props();

	// Initialize quiz from quizzes prop or use default
	const defaultVideo: (typeof videos)[number] = {
		id: 'new',
		name: '',
		source: '',
		thumbnail: '',
		captions: '',
		duration: 0
	};
	let video = $state(defaultVideo);
	let error = $state<$ZodIssue[] | null>(null);

	const persist = async (event: Event) => {
		event.preventDefault();

		const result = await fetch(`/api/stories/${storyId}/videos/${video.id ?? 'new'}`, {
			method: 'POST',
			body: JSON.stringify(video)
		});

		if (!result.ok) error = await result.json();
		else close({ action: 'persist', video: await result.json() });
	};
	const remove = async () => {
		if (!video.id?.length) return;
		const result = await fetch(`/api/stories/${storyId}/videos/${video.id}`, {
			method: 'DELETE'
		});
		if (!result.ok) error = await result.json();
		else {
			close({ action: 'delete', id: video.id });
			video = defaultVideo;
		}
	};
</script>

<form onsubmit={persist}>
	<Dialog.Content
		class="scrollbar-none max-h-[90vh] overflow-y-auto pt-0 sm:max-w-200"
		showCloseButton={false}
	>
		<Dialog.Header class="sticky top-0 z-50 -mx-6 bg-background/50 pt-6 backdrop-blur-md">
			<div class="flex justify-between gap-2 px-6">
				<div class="flex w-full items-center gap-2">
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
					{/if}
					<Separator orientation="vertical" class="mr-2 ml-4" />
					<Toggle
						size="default"
						variant="default"
						class="bg-card! {video?.id === 'new'
							? 'text-blue-600! *:[svg]:fill-blue-100! *:[svg]:stroke-blue-500!'
							: ''}"
						onclick={() => (video = defaultVideo)}
					>
						<SquarePlus />
						New
					</Toggle>
				</div>
				<!-- <Dialog.Close class={buttonVariants({ variant: 'ghost', size: 'icon' })}>
					<XIcon />
				</Dialog.Close> -->

				<div class="flex gap-2">
					<Dialog.Close class={buttonVariants({ variant: 'outline' })}>Cancel</Dialog.Close>
					{#if video.id && video.id !== 'new'}
						<Button variant="destructive" size="icon" onclick={remove}>
							<TrashIcon />
						</Button>
					{/if}
					<Button type="submit" onclick={persist}>Save video</Button>
				</div>
			</div>

			<Separator class="mt-4" />
		</Dialog.Header>

		<Field.Group class="gap-2">
			<Field.Field>
				<Field.Label>Video reference name</Field.Label>
				<Input bind:value={video.name} placeholder="Name..." />
				<Field.Error>
					{error?.find((e) => e.path?.join('.') === ['name'].join('.'))?.message}
				</Field.Error>
			</Field.Field>
			<Field.Field>
				<Field.Label>Source</Field.Label>
				<Input bind:value={video.source} placeholder="Source..." />
				<Field.Error>
					{error?.find((e) => e.path?.join('.') === ['source'].join('.'))?.message}
				</Field.Error>
			</Field.Field>
			<Field.Field>
				<Field.Label>Duration (in seconds)</Field.Label>
				<Input bind:value={video.duration} placeholder="Duration..." />
				<Field.Error>
					{error?.find((e) => e.path?.join('.') === ['duration'].join('.'))?.message}
				</Field.Error>
			</Field.Field>
		</Field.Group>
	</Dialog.Content>
</form>
