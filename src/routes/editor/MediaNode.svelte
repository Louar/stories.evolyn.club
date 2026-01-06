<script lang="ts">
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import type { findOneStoryById } from '$lib/db/repositories/2-stories-module';
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
	let hasOverlay = $derived(part?.foregroundType !== 'none');

	let videos = $derived(data.videos);
	let announcements = $derived(data.announcements);
	let quizzes = $derived(data.quizzes);

	const overlayOptions = [
		{ value: 'none', label: 'None' },
		{ value: 'text', label: 'Text' },
		{ value: 'quiz', label: 'Quiz' },
		{ value: 'announcement', label: 'Announcement' }
	];
</script>

<div class="flex w-72 flex-col rounded-lg border border-stone-400 bg-white py-3 shadow-md">
	<div class="relative grid w-full gap-2">
		<!-- Part Label/Header -->
		<div class="px-4 pb-2">
			<p class="truncate text-sm font-medium" title={data.label}>{data.label}</p>
			{#if data.isInitial}
				<span
					class="inline-block rounded bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-800"
					>Initial</span
				>
			{/if}
			{#if data.isFinal}
				<span
					class="inline-block rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800"
					>Final</span
				>
			{/if}
		</div>

		<!-- Media Selector -->
		<div class="relative px-2">
			<Dialog.Root>
				<Dialog.Trigger
					class="flex w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground"
					data-placeholder
				>
					<span class="truncate"
						>{data.backgroundType === 'video'
							? 'Video'
							: data.backgroundType || 'Select media...'}</span
					>
					<ChevronDownIcon class="size-4 opacity-50" />
				</Dialog.Trigger>
				<Dialog.Content class="sm:max-w-106.25">
					<Dialog.Header>
						<Dialog.Title>Edit Media</Dialog.Title>
						<Dialog.Description>Configure the media for this part.</Dialog.Description>
					</Dialog.Header>
					<div class="grid gap-4">
						<div class="grid gap-3">
							<Label for="media-type">Media Type</Label>
							<Input
								id="media-type"
								name="media-type"
								value={data.backgroundType || 'None'}
								readonly
							/>
						</div>
						{#if data.backgroundSource}
							<div class="grid gap-3">
								<Label for="media-source">Source</Label>
								<Input
									id="media-source"
									name="media-source"
									value={data.backgroundSource}
									readonly
								/>
							</div>
						{/if}
					</div>
					<Dialog.Footer>
						<Dialog.Close class={buttonVariants({ variant: 'outline' })}>Close</Dialog.Close>
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
					class="flex w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground"
					data-placeholder
				>
					<span class="truncate"
						>{overlayOptions.find((o) => o.value === part?.foregroundType)?.label ||
							'Select overlay...'}</span
					>
					<ChevronDownIcon class="size-4 opacity-50" />
				</Dialog.Trigger>
				<Dialog.Content class="sm:max-w-106.25">
					<Dialog.Header>
						<Dialog.Title>Edit Overlay</Dialog.Title>
						<Dialog.Description>Configure the overlay for this part.</Dialog.Description>
					</Dialog.Header>
					<div class="grid gap-4">
						<div class="grid gap-3">
							<Label for="overlay-type">Overlay Type</Label>
							<Input
								id="overlay-type"
								name="overlay-type"
								value={part?.foregroundType || 'none'}
								readonly
							/>
						</div>
						{#if part?.foregroundType === 'announcement' && part?.foreground}
							<div class="grid gap-3">
								<Label>Title</Label>
								<Input value={part?.foreground.title || ''} readonly />
							</div>
							<div class="grid gap-3">
								<Label>Message</Label>
								<Input value={part?.foreground.message || ''} readonly />
							</div>
						{/if}
					</div>
					<Dialog.Footer>
						<Dialog.Close class={buttonVariants({ variant: 'outline' })}>Close</Dialog.Close>
					</Dialog.Footer>
				</Dialog.Content>
			</Dialog.Root>
		</div>

		<!-- Slider for timeline -->
		<div class="flex gap-3 p-4">
			<Slider bind:range {duration} {hasOverlay} />
		</div>
	</div>

	<!-- Quiz Handles -->
	{#if part?.foregroundType === 'quiz' && part?.foreground && 'rawlogic' in part.foreground}
		<Separator class="mt-1 mb-3" />
		<div class="grid w-full gap-2">
			{#if part?.foreground?.rawlogic?.rules?.length}
				{#each part?.foreground?.rawlogic?.rules as rule}
					<div class="relative px-2">
						<p class="text-sm" title={rule._description}>
							{rule._description || `Rule ${rule._id}`}
						</p>
						<Handle
							type="source"
							position={Position.Right}
							id={rule._id}
							class="size-4! bg-amber-300!"
						/>
					</div>
				{/each}
			{:else}
				<!-- Fallback handles for backward compatibility -->
				<div class="relative px-2">
					<p class="text-sm">All correct</p>
					<Handle
						type="source"
						position={Position.Right}
						id="correct"
						class="size-4! bg-amber-300!"
					/>
				</div>
				<div class="relative px-2">
					<p class="text-sm">Some incorrect</p>
					<Handle
						type="source"
						position={Position.Right}
						id="incorrect"
						class="size-4! bg-amber-300!"
					/>
				</div>
			{/if}
		</div>
	{/if}
</div>
