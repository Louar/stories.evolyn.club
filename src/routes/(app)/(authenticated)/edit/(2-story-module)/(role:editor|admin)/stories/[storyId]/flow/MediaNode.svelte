<script lang="ts">
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import type { findOneQuizLogicById, findOneStoryById } from '$lib/db/repositories/2-story-module';
	import { formatDuration } from '$lib/db/schemas/0-utils';
	import { EDITORS } from '$lib/states/editors.svelte';
	import CheckIcon from '@lucide/svelte/icons/check';
	import CirclePlayIcon from '@lucide/svelte/icons/circle-play';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import CogIcon from '@lucide/svelte/icons/cog';
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import { toast } from 'svelte-sonner';
	import QuizLogicEditor from './QuizLogicEditor.svelte';
	import Slider from './Slider.svelte';
	import TaxonomyLogicEditor from './TaxonomyLogicEditor.svelte';

	type Part = Awaited<ReturnType<typeof findOneStoryById>>['parts'][number];

	let {
		data
	}: NodeProps & {
		data: {
			storyId: string;
			part: Part;
			onPartSaved: (part: Part) => void;
		};
	} = $props();

	let storyId = $derived(data.storyId);

	let part = $derived(structuredClone($state.snapshot(data.part)));

	let videos = $derived(EDITORS.videos);
	let stills = $derived(EDITORS.stills);
	let announcements = $derived(EDITORS.announcements);
	let quizzes = $derived(EDITORS.quizzes);
	let taxonomies = $derived(EDITORS.taxonomies);
	let quiz: (typeof quizzes)[number] | undefined = $derived(
		quizzes.find((q) => q.id === part.quizTemplateId)
	);
	let taxonomy = $derived(taxonomies.find((item) => item.id === part.taxonomyId));

	const overlayOptions = [
		{ value: 'none', label: 'None' },
		{ value: 'quiz', label: 'Quiz' },
		{ value: 'taxonomy', label: 'Taxonomy' },
		{ value: 'announcement', label: 'Announcement' }
	];

	let duration = $derived(videos.find((video) => video.id === part.videoId)?.duration ?? 0);
	let range = $state([
		// eslint-disable-next-line svelte/no-unused-svelte-ignore
		// svelte-ignore state_referenced_locally
		part.backgroundConfiguration?.start ?? 0,
		// eslint-disable-next-line svelte/no-unused-svelte-ignore
		// svelte-ignore state_referenced_locally
		part.foregroundConfiguration?.start ?? 0.5,
		// eslint-disable-next-line svelte/no-unused-svelte-ignore
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
				} as typeof part.backgroundConfiguration;
				persist();
			}
		}
		if (part.foregroundType && part.foregroundType !== 'none') {
			if ((part.foregroundConfiguration?.start ?? 0) !== range[1]) {
				part.foregroundConfiguration = {
					...part.foregroundConfiguration,
					start: range[1]
				} as typeof part.foregroundConfiguration;
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
		const { action, logic } = output;
		if (action === 'persist' && logic) {
			part.quizLogicForPart = logic;
			data.onPartSaved($state.snapshot(part) as Part);
		}
		isOpen = false;
	};
	const closeTaxonomy = (
		draft?: NonNullable<typeof part.taxonomyDraftForPart>,
		keepOpen = false
	) => {
		if (draft) {
			part.taxonomyDraftForPart = draft;
			data.onPartSaved($state.snapshot(part) as Part);
		}
		if (!keepOpen) isOpen = false;
	};

	const persist = async () => {
		const result = await fetch(`/api/stories/${storyId}/parts/${part.id}`, {
			method: 'POST',
			body: JSON.stringify(part)
		});

		if (!result.ok) {
			toast.error('Creating part failed, please refresh', {
				closeButton: true,
				duration: Infinity
			});
		} else {
			part = await result.json();
			data.onPartSaved($state.snapshot(part) as Part);
		}
	};
</script>

<div class="flex w-75 flex-col rounded-lg border bg-card py-3 shadow-md">
	<div class="relative flex flex-col gap-2">
		{#if part.isInitial}
			<div class="inline-flex items-center gap-1.5 px-2">
				<CirclePlayIcon class="size-3 text-muted-foreground" />
				<p class="text-xs text-muted-foreground">Initial part</p>
			</div>
		{/if}
		<!-- Media Selector -->
		<div class="relative px-2">
			<Dialog.Root>
				<Dialog.Trigger
					class="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-2 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground {!part.backgroundType
						? 'text-muted-foreground'
						: ''}"
				>
					<span class="truncate">
						{#if part.backgroundType === 'video'}
							{@const video = videos.find((video) => video.id === part.videoId)}
							Video: {video?.name || 'Unknown'}
						{:else if part.backgroundType === 'still'}
							{@const still = stills.find((item) => item.id === part.stillId)}
							Still: {still?.image?.filename ?? still?.color ?? 'Unknown'}
						{:else}
							Select media...
						{/if}
					</span>
					<ChevronDownIcon class="size-4 opacity-50" />
				</Dialog.Trigger>
				<Dialog.Content
					class="max-h-[90vh] scrollbar-none overflow-y-auto pt-0 sm:max-w-106.25"
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
							<Label>Available stills</Label>
							<RadioGroup.Root
								value={part.stillId ?? 'none'}
								onValueChange={(value) => {
									part.backgroundType = 'still';
									part.stillId = value;
									part.videoId = null;
									persist();
								}}
								class="grid gap-2"
							>
								{#each stills as still (still.id)}
									<Label
										class="flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted {part.stillId ===
										still.id
											? 'bg-muted/75'
											: ''}"
									>
										<RadioGroup.Item value={still.id} />
										<div
											class="size-8 rounded border"
											style:background-color={still.color ?? undefined}
										></div>
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm">
												{still.image?.filename ?? still.color ?? 'Untitled still'}
											</p>
											{#if still.style}<p class="truncate text-xs text-muted-foreground">
													{still.style}
												</p>{/if}
										</div>
									</Label>
								{/each}
							</RadioGroup.Root>
						</div>
						<Separator />
						<div class="grid gap-3">
							<Label>Available videos</Label>
							<RadioGroup.Root
								value={part.videoId ?? 'none'}
								onValueChange={(value) => {
									part.backgroundType = 'video';
									part.videoId = value;
									part.stillId = null;
									persist();
								}}
								class="grid gap-2"
							>
								{#each videos as video (video.id)}
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
					class="flex h-9 min-w-59.5 grow items-center justify-between gap-2 rounded-md border border-input bg-transparent px-2 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground {!part.foregroundType
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
						{:else if part.foregroundType === 'taxonomy'}
							Taxonomy: {taxonomy?.name || 'Unknown'}
						{:else}
							Select overlay...
						{/if}
					</span>
					<ChevronDownIcon class="size-4 opacity-50" />
				</Dialog.Trigger>
				<Dialog.Content
					class="max-h-[90vh] scrollbar-none overflow-y-auto pt-0 sm:max-w-106.25"
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
									if (part.foregroundType !== 'taxonomy') part.taxonomyId = null;
									persist();
								}}
								class="grid grid-cols-2 gap-2"
							>
								{#each overlayOptions as option (option.value)}
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
									{#each announcements as announcement (announcement.id)}
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
									{#each quizzes as quiz (quiz.id)}
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

						{#if part.foregroundType === 'taxonomy'}
							<Separator />
							<div class="grid gap-3">
								<Label>Select Taxonomy</Label>
								<RadioGroup.Root
									value={part.taxonomyId ?? 'none'}
									onValueChange={(value) => {
										part.taxonomyId = value;
										persist();
									}}
									class="grid gap-2"
								>
									{#each taxonomies as item (item.id)}
										<Label
											class="flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted {part.taxonomyId ===
											item.id
												? 'bg-muted/75'
												: ''}"
										>
											<RadioGroup.Item value={item.id} />
											<p class="text-sm">{item.name}</p>
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
					<Dialog.Trigger class={buttonVariants({ variant: 'outline', size: 'icon' })}>
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
			{#if part.foregroundType === 'taxonomy' && part.taxonomyDraftForPart}
				<Dialog.Root bind:open={isOpen}>
					<Dialog.Trigger
						class={buttonVariants({ variant: 'outline', size: 'icon' })}
						aria-label="Edit taxonomy game"
					>
						<CogIcon />
					</Dialog.Trigger>
					<TaxonomyLogicEditor
						{storyId}
						partId={part.id}
						draft={part.taxonomyDraftForPart}
						close={closeTaxonomy}
					/>
				</Dialog.Root>
			{/if}
		</div>

		{#if part.backgroundType === 'video' && part.videoId}
			<div class="flex gap-3 p-4">
				<Slider bind:range {duration} hasOverlay={!!part.foregroundType} />
			</div>
		{/if}
	</div>

	<!-- Quiz Handles -->
	{#if part.foregroundType === 'quiz'}
		<Separator class="mt-1 mb-3" />
		<div class="grid w-full gap-2">
			{#each part.quizLogicForPart?.rules as rule (rule.id)}
				<div class="relative px-2">
					<p class="text-sm">
						{rule.name}
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

	{#if part.foregroundType === 'taxonomy'}
		<Separator class="mt-1 mb-3" />
		<div class="grid w-full gap-2">
			{#each part.taxonomyDraftForPart?.rules ?? [] as rule (rule.id)}
				{#if !rule.isRemoved}
					<div class="relative px-2">
						<p class="text-sm">Rule {rule.order}</p>
						<Handle
							type="source"
							position={Position.Right}
							id={`taxonomy-rule:${rule.id}`}
							class="size-4! bg-emerald-300!"
						/>
					</div>
				{/if}
			{/each}
			<div class="relative px-2">
				<p class="text-sm italic">Default after taxonomy</p>
				<Handle
					type="source"
					position={Position.Right}
					id="default-after-taxonomy"
					class="size-4! bg-emerald-300!"
				/>
			</div>
		</div>
	{/if}
</div>
