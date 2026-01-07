<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import type { findOneStoryById } from '$lib/db/repositories/2-stories-module';
	import { formatDuration } from '$lib/db/schemas/0-utils';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import Slider from './Slider.svelte';

	let {
		data
	}: NodeProps & {
		data: {
			videos: Awaited<ReturnType<typeof findOneStoryById>>['videos'];
			announcements: Awaited<ReturnType<typeof findOneStoryById>>['announcements'];
			quizzes: Awaited<ReturnType<typeof findOneStoryById>>['quizzes'];
			part: Awaited<ReturnType<typeof findOneStoryById>>['parts'][number] | undefined;
		};
	} = $props();

	let part = $derived(data.part);

	let videos = $derived(data.videos);
	let announcements = $derived(data.announcements);
	let quizzes = $derived(data.quizzes);

	const overlayOptions = [
		{ value: 'none', label: 'None' },
		{ value: 'quiz', label: 'Quiz' },
		{ value: 'announcement', label: 'Announcement' }
	];

	let duration = $derived(part?.background?.duration ?? 0);
	let range = $state([
		part?.backgroundConfiguration?.start ?? 0,
		part?.foregroundConfiguration?.start ?? 0.5,
		part?.backgroundConfiguration?.end ?? 1
	]);

	// Selection state
	let selectedVideoId = $state(part?.videoId || '');
	let selectedOverlayType = $state(part?.foregroundType || 'none');
	let selectedAnnouncementId = $state(
		part?.foregroundType === 'announcement' ? part.foreground?.id || '' : ''
	);
	let selectedQuizId = $state(part?.foregroundType === 'quiz' ? part.foreground?.id || '' : '');

	function selectVideo(videoId: string) {
		selectedVideoId = videoId;
		// In a real app, this would update the part's videoId
	}

	function selectOverlay(type: string) {
		selectedOverlayType = type;
		// Reset selections when changing overlay type
		if (type !== 'announcement') selectedAnnouncementId = '';
		if (type !== 'quiz') selectedQuizId = '';
	}

	function selectAnnouncement(announcementId: string) {
		selectedAnnouncementId = announcementId;
	}

	function selectQuiz(quizId: string) {
		selectedQuizId = quizId;
	}
</script>

<div class="flex w-75 flex-col rounded-lg border border-stone-400 bg-white py-3 shadow-md">
	<div class="relative grid w-full gap-2">
		<!-- Media Selector -->
		<div class="relative px-2">
			<Dialog.Root>
				<Dialog.Trigger
					class="flex w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground {!part?.backgroundType
						? 'text-muted-foreground'
						: ''}"
				>
					<span class="truncate">
						{#if part?.backgroundType === 'video'}
							{@const video = videos.find((video) => video.id === part?.videoId)}
							Video: {video?.name || 'Unknown'}
						{:else}
							Select media...
						{/if}
					</span>
					<ChevronDownIcon class="size-4 opacity-50" />
				</Dialog.Trigger>
				<Dialog.Content class="sm:max-w-106.25">
					<Dialog.Header>
						<Dialog.Title>Edit background</Dialog.Title>
						<Dialog.Description>Select the background media for this part.</Dialog.Description>
					</Dialog.Header>
					<div class="grid gap-4">
						<div class="grid gap-3">
							<Label>Available videos</Label>
							<RadioGroup.Root
								value={selectedVideoId}
								onValueChange={(v) => selectVideo(v)}
								class="grid gap-2"
							>
								{#each videos as video}
									<Label
										class="flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted {selectedVideoId ===
										video.id
											? 'bg-muted/75'
											: ''}"
									>
										<RadioGroup.Item value={video.id} />
										<div class="flex-1">
											<p class="text-sm">{video.name ?? 'Unnamed video'}</p>
											<p class="text-xs text-muted-foreground">{formatDuration(duration)}</p>
										</div>
									</Label>
								{/each}
							</RadioGroup.Root>
						</div>
					</div>
					<Dialog.Footer>
						<Dialog.Close class={buttonVariants({ variant: 'outline' })}>Cancel</Dialog.Close>
						<Button type="submit" onclick={() => {}}>Save</Button>
					</Dialog.Footer>
				</Dialog.Content>
			</Dialog.Root>

			<Handle type="target" position={Position.Left} class="size-4! bg-blue-400!" />
			<Handle type="source" position={Position.Right} id="default" class="size-4! bg-orange-300!" />
		</div>

		<!-- Overlay Selector -->
		<div class="px-2">
			<Dialog.Root>
				<Dialog.Trigger
					class="flex w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground {!part?.foregroundType
						? 'text-muted-foreground'
						: ''}"
				>
					<span class="truncate">
						{#if part?.foregroundType === 'announcement'}
							{@const announcement = announcements.find((a) => a.id === part?.foreground?.id)}
							Announcement: {announcement?.name || 'Unknown'}
						{:else if part?.foregroundType === 'quiz'}
							{@const quiz = quizzes.find((q) => q.id === part?.foreground?.id)}
							Quiz: {quiz?.name || 'Unknown'}
						{:else}
							Select overlay...
						{/if}
					</span>
					<ChevronDownIcon class="size-4 opacity-50" />
				</Dialog.Trigger>
				<Dialog.Content class="sm:max-w-106.25">
					<Dialog.Header>
						<Dialog.Title>Edit Overlay</Dialog.Title>
						<Dialog.Description>Configure the overlay for this part.</Dialog.Description>
					</Dialog.Header>
					<div class="grid gap-4">
						<!-- Overlay Type Selection -->
						<div class="grid gap-3">
							<Label>Overlay Type</Label>
							<RadioGroup.Root
								value={selectedOverlayType}
								onValueChange={(v) => selectOverlay(v)}
								class="grid grid-cols-2 gap-2"
							>
								{#each overlayOptions as option}
									<Label
										class="flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted {selectedOverlayType ===
										option.value
											? 'bg-muted/75'
											: ''}"
									>
										<RadioGroup.Item value={option.value} />
										<div class="flex-1">
											<p class="text-sm">{option.label}</p>
										</div>
									</Label>
								{/each}
							</RadioGroup.Root>
						</div>

						<!-- Announcement Selection -->
						{#if selectedOverlayType === 'announcement'}
							<Separator />
							<div class="grid gap-3">
								<Label>Select Announcement</Label>
								<RadioGroup.Root
									value={selectedAnnouncementId}
									onValueChange={(v) => selectAnnouncement(v)}
									class="grid gap-2"
								>
									{#each announcements as announcement}
										<Label
											class="flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted {selectedAnnouncementId ===
											announcement.id
												? 'bg-muted/75'
												: ''}"
										>
											<RadioGroup.Item value={announcement.id} />
											<div class="flex-1">
												<p class="text-sm">{announcement.name ?? 'Unnamed announcement'}</p>
											</div>
										</Label>
									{/each}
								</RadioGroup.Root>
							</div>
						{/if}

						<!-- Quiz Selection -->
						{#if selectedOverlayType === 'quiz'}
							<Separator />
							<div class="grid gap-3">
								<Label>Select Quiz</Label>
								<RadioGroup.Root
									value={selectedQuizId}
									onValueChange={(v) => selectQuiz(v)}
									class="grid gap-2"
								>
									{#each quizzes as quiz}
										<Label
											class="flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted {selectedQuizId ===
											quiz.id
												? 'bg-muted/75'
												: ''}"
										>
											<RadioGroup.Item value={quiz.id} />
											<div class="flex-1">
												<p class="text-sm">{quiz.name ?? 'Unnamed quiz'}</p>
												<p class="text-xs text-muted-foreground">
													{quiz.questions?.length || 0} questions
												</p>
											</div>
										</Label>
									{/each}
								</RadioGroup.Root>
							</div>
						{/if}
					</div>
					<Dialog.Footer>
						<Dialog.Close class={buttonVariants({ variant: 'outline' })}>Cancel</Dialog.Close>
						<Button type="submit" onclick={() => {}}>Save</Button>
					</Dialog.Footer>
				</Dialog.Content>
			</Dialog.Root>
		</div>

		<!-- Slider for timeline -->
		<div class="flex gap-3 p-4">
			<Slider bind:range {duration} hasOverlay={!!part?.foregroundType} />
		</div>
	</div>

	<!-- Quiz Handles -->
	{#if part?.foregroundType === 'quiz' && part?.foreground && 'rawlogic' in part.foreground}
		<Separator class="mt-1 mb-3" />
		<div class="grid w-full gap-2">
			{#each part?.foreground?.rawlogic?.rules as rule}
				<div class="relative px-2">
					<p class="text-sm" title={rule.name}>
						{rule.name || `Rule ${rule.order}`}
					</p>
					<Handle
						type="source"
						position={Position.Right}
						id={rule.id}
						class="size-4! bg-amber-300!"
					/>
				</div>
			{/each}
		</div>
	{/if}
</div>
