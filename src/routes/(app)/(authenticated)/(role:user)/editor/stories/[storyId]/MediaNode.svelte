<script lang="ts">
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import type {
		findOneQuizLogicById,
		findOneStoryById
	} from '$lib/db/repositories/2-stories-module';
	import { formatDuration } from '$lib/db/schemas/0-utils';
	import { EDITORS } from '$lib/states/editors.svelte';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import CogIcon from '@lucide/svelte/icons/cog';
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import QuizLogicEditor from './QuizLogicEditor.svelte';
	import Slider from './Slider.svelte';

	let {
		data
	}: NodeProps & {
		data: {
			storyId: string;
			part: Awaited<ReturnType<typeof findOneStoryById>>['parts'][number];
		};
	} = $props();

	let storyId = $derived(data.storyId);

	// svelte-ignore state_referenced_locally
	let part = $state(data.part);

	let videos = $derived(EDITORS.videos);
	let announcements = $derived(EDITORS.announcements);
	let quizzes = $derived(EDITORS.quizzes);
	let quiz: (typeof quizzes)[number] | undefined = $derived(
		quizzes.find((q) => q.id === part.quizTemplateId)
	);

	const overlayOptions = [
		{ value: 'none', label: 'None' },
		{ value: 'quiz', label: 'Quiz' },
		{ value: 'announcement', label: 'Announcement' }
	];

	let duration = $derived(videos.find((video) => video.id === part.videoId)?.duration ?? 0);
	let range = $state([
		// svelte-ignore state_referenced_locally
		part.backgroundConfiguration?.start ?? 0,
		// svelte-ignore state_referenced_locally
		part.foregroundConfiguration?.start ?? 0.5,
		// svelte-ignore state_referenced_locally
		part.backgroundConfiguration?.end ?? 1
	]);
	$effect(() => {
		updateRange(range);
		// part.backgroundConfiguration = {
		// 	...part.backgroundConfiguration,
		// 	start: range[0],
		// 	end: range[2]
		// };
		// if (part.foregroundType) {
		// 	part.foregroundConfiguration = {
		// 		...part.foregroundConfiguration,
		// 		start: range[1]
		// 	};
		// }
		// persist();
	});
	const updateRange = (range: number[]) => {
		if (part.backgroundType === 'video') {
			if (
				(part.backgroundConfiguration?.start ?? 0) !== range[0] ||
				(part.backgroundConfiguration?.end ?? 1) !== range[2]
			) {
				part.backgroundConfiguration = {
					...part.backgroundConfiguration,
					start: range[0],
					end: range[2]
				};
				persist();
			}
		}
		if (part.foregroundType && part.foregroundType !== 'none') {
			if ((part.foregroundConfiguration?.start ?? 0) !== range[1]) {
				part.foregroundConfiguration = {
					...part.foregroundConfiguration,
					start: range[1]
				};
				persist();
			}
		}
	};

	let isOpen = $state(false);
	const close = (output: {
		action: 'persist' | 'delete';
		id?: string;
		logic?: Awaited<ReturnType<typeof findOneQuizLogicById>>;
	}) => {
		const { action, id, logic } = output;
		if (action === 'persist' && logic) {
			part.quizLogicForPart = logic;
		}
		isOpen = false;
	};

	const persist = async () => {
		const result = await fetch(`/api/stories/${storyId}/parts/${part.id}`, {
			method: 'POST',
			body: JSON.stringify(part)
		});

		if (!result.ok) console.log(await result.json());
		else part = await result.json();
	};
</script>

<div class="flex w-75 flex-col rounded-lg border border-stone-400 bg-white py-3 shadow-md">
	<div class="relative grid w-full gap-2">
		<!-- Media Selector -->
		<div class="relative px-2">
			<Dialog.Root>
				<Dialog.Trigger
					class="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground {!part.backgroundType
						? 'text-muted-foreground'
						: ''}"
				>
					<span class="truncate">
						{#if part.backgroundType === 'video'}
							{@const video = videos.find((video) => video.id === part.videoId)}
							Video: {video?.name || 'Unknown'}
						{:else}
							Select media...
						{/if}
					</span>
					<ChevronDownIcon class="size-4 opacity-50" />
				</Dialog.Trigger>
				<Dialog.Content
					class="scrollbar-none max-h-[90vh] overflow-y-auto pt-0 sm:max-w-106.25"
					showCloseButton={false}
				>
					<Dialog.Header class="sticky top-0 z-50 -mx-6 bg-background/50 pt-6 backdrop-blur-md">
						<div class="flex justify-between gap-2 px-6">
							<div>
								<Dialog.Title>Edit background</Dialog.Title>
								<Dialog.Description>Select the background media for this part.</Dialog.Description>
							</div>

							<div class="flex gap-2">
								<Dialog.Close class={buttonVariants({ variant: 'ghost', size: 'icon' })}>
									<CheckIcon />
								</Dialog.Close>
							</div>
						</div>

						<Separator class="mt-4" />
					</Dialog.Header>
					<div class="grid gap-4">
						<div class="grid gap-3">
							<Label>Available videos</Label>
							<RadioGroup.Root
								value={part.videoId ?? 'none'}
								onValueChange={(value) => {
									part.backgroundType = 'video';
									part.videoId = value;
									persist();
								}}
								class="grid gap-2"
							>
								{#each videos as video}
									<Label
										class="flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted {part.videoId ===
										video.id
											? 'bg-muted/75'
											: ''}"
									>
										<RadioGroup.Item value={video.id} />
										<div class="flex-1">
											<p class="text-sm">{video.name ?? 'Unnamed video'}</p>
											<p class="text-xs text-muted-foreground">{formatDuration(video.duration)}</p>
										</div>
									</Label>
								{/each}
							</RadioGroup.Root>
						</div>
					</div>
					<!-- <Dialog.Footer>
						<Dialog.Close class={buttonVariants({ variant: 'outline' })}>Cancel</Dialog.Close>
						<Dialog.Close class={buttonVariants({ variant: 'default' })}>Save</Dialog.Close>
					</Dialog.Footer> -->
				</Dialog.Content>
			</Dialog.Root>

			<Handle type="target" position={Position.Left} class="size-4! bg-blue-400!" />
			<Handle type="source" position={Position.Right} id="default" class="size-4! bg-orange-300!" />
		</div>

		<!-- Overlay Selector -->
		<div class="flex gap-2 px-2">
			<Dialog.Root>
				<Dialog.Trigger
					class="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground {!part.foregroundType
						? 'text-muted-foreground'
						: ''}"
				>
					<span class="truncate">
						{#if part.foregroundType === 'announcement'}
							{@const announcement = announcements.find(
								(a) => a.id === part.announcementTemplateId
							)}
							Announcement: {announcement?.name || 'Unknown'}
						{:else if part.foregroundType === 'quiz'}
							Quiz: {quiz?.name || 'Unknown'}
						{:else}
							Select overlay...
						{/if}
					</span>
					<ChevronDownIcon class="size-4 opacity-50" />
				</Dialog.Trigger>
				<Dialog.Content
					class="scrollbar-none max-h-[90vh] overflow-y-auto pt-0 sm:max-w-106.25"
					showCloseButton={false}
				>
					<Dialog.Header class="sticky top-0 z-50 -mx-6 bg-background/50 pt-6 backdrop-blur-md">
						<div class="flex justify-between gap-2 px-6">
							<div>
								<Dialog.Title>Edit overlay</Dialog.Title>
								<Dialog.Description>Configure the overlay for this part.</Dialog.Description>
							</div>

							<div class="flex gap-2">
								<Dialog.Close class={buttonVariants({ variant: 'ghost', size: 'icon' })}>
									<CheckIcon />
								</Dialog.Close>
							</div>
						</div>

						<Separator class="mt-4" />
					</Dialog.Header>
					<div class="grid gap-4">
						<!-- Overlay Type Selection -->
						<div class="grid gap-3">
							<Label>Overlay Type</Label>
							<RadioGroup.Root
								value={part.foregroundType ?? 'none'}
								onValueChange={(value) => {
									if (!part) return;
									part.foregroundType = value;
									if (part.foregroundType !== 'announcement') part.announcementTemplateId = null;
									if (part.foregroundType !== 'quiz') part.quizTemplateId = null;
									persist();
								}}
								class="grid grid-cols-2 gap-2"
							>
								{#each overlayOptions as option}
									<Label
										class="flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted {part.foregroundType ===
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
						{#if part.foregroundType === 'announcement'}
							<Separator />
							<div class="grid gap-3">
								<Label>Select Announcement</Label>
								<RadioGroup.Root
									value={part.announcementTemplateId ?? 'none'}
									onValueChange={(value) => {
										part.announcementTemplateId = value;
										persist();
									}}
									class="grid gap-2"
								>
									{#each announcements as announcement}
										<Label
											class="flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted {part.announcementTemplateId ===
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
						{#if part.foregroundType === 'quiz'}
							<Separator />
							<div class="grid gap-3">
								<Label>Select Quiz</Label>
								<RadioGroup.Root
									value={part.quizTemplateId ?? 'none'}
									onValueChange={(value) => {
										part.quizTemplateId = value;
										persist();
									}}
									class="grid gap-2"
								>
									{#each quizzes as quiz}
										<Label
											class="flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted {part.quizTemplateId ===
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
					<!-- <Dialog.Footer>
						<Dialog.Close class={buttonVariants({ variant: 'outline' })}>Cancel</Dialog.Close>
						<Dialog.Close class={buttonVariants({ variant: 'default' })}>Save</Dialog.Close>
					</Dialog.Footer> -->
				</Dialog.Content>
			</Dialog.Root>

			{#if part.foregroundType === 'quiz' && quiz}
				<Dialog.Root bind:open={isOpen}>
					<Dialog.Trigger class="{buttonVariants({ variant: 'outline', size: 'icon' })} -mr-2">
						<CogIcon />
					</Dialog.Trigger>
					<QuizLogicEditor
						{storyId}
						partId={part.id}
						rules={part.quizLogicForPart?.rules ?? []}
						{quiz}
						{close}
					/>
				</Dialog.Root>
			{/if}
		</div>

		{#if part.backgroundType === 'video'}
			<div class="flex gap-3 p-4">
				<Slider bind:range {duration} hasOverlay={!!part.foregroundType} />
			</div>
		{/if}
	</div>

	<!-- Quiz Handles -->
	{#if part.foregroundType === 'quiz' && part.quizLogicForPart?.rules?.length}
		<Separator class="mt-1 mb-3" />
		<div class="grid w-full gap-2">
			{#each part.quizLogicForPart?.rules as rule}
				<div class="relative px-2">
					<p class="text-sm">
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
			<div class="relative px-2">
				<p class="text-sm italic">Default after quiz</p>
				<Handle
					type="source"
					position={Position.Right}
					id="default-after-quiz"
					class="size-4! bg-amber-300!"
				/>
			</div>
		</div>
	{/if}
</div>
