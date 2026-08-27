<script lang="ts">
	import { Separator } from '$lib/components/ui/separator/index.js';
	import type { findOneStoryById } from '$lib/db/repositories/2-story-module';
	import { formatDuration } from '$lib/db/schemas/0-utils';
	import { EDITORS } from '$lib/states/editors.svelte';
	import BanIcon from '@lucide/svelte/icons/ban';
	import CirclePlayIcon from '@lucide/svelte/icons/circle-play';
	import ImageIcon from '@lucide/svelte/icons/image';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import ShapesIcon from '@lucide/svelte/icons/shapes';
	import VideoIcon from '@lucide/svelte/icons/video';
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';

	type Part = Awaited<ReturnType<typeof findOneStoryById>>['parts'][number];

	let { data, selected }: NodeProps & { data: { part: Part } } = $props();

	let part = $derived(data.part);
	let video = $derived(EDITORS.videos.find((item) => item.id === part.videoId));
	let still = $derived(EDITORS.stills.find((item) => item.id === part.stillId));
	let announcement = $derived(
		EDITORS.announcements.find((item) => item.id === part.announcementTemplateId)
	);
	let quiz = $derived(EDITORS.quizzes.find((item) => item.id === part.quizTemplateId));
	let taxonomy = $derived(EDITORS.taxonomies.find((item) => item.id === part.taxonomyId));

	let backgroundLabel = $derived(
		part.backgroundType === 'video'
			? (video?.name ?? 'Unselected video')
			: part.backgroundType === 'still'
				? (still?.image?.filename ?? still?.color ?? 'Unselected still')
				: 'No background'
	);
	let foregroundLabel = $derived(
		part.foregroundType === 'quiz'
			? (quiz?.name ?? 'Unselected quiz')
			: part.foregroundType === 'taxonomy'
				? (taxonomy?.name ?? 'Unselected taxonomy')
				: part.foregroundType === 'announcement'
					? (announcement?.name ?? 'Unselected announcement')
					: 'No foreground'
	);
</script>

<div
	class="group relative w-80 cursor-pointer rounded-xl border shadow-md transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg {selected
		? 'border-primary/40 bg-muted ring-2 ring-primary/15'
		: 'bg-card'}"
	aria-label={`Edit part ${part.id}`}
>
	{#if part.isInitial}
		<span
			class="absolute -top-2 -right-2 z-10 inline-flex items-center gap-1 rounded-full border bg-primary px-2 py-1 text-[0.65rem] font-medium text-primary-foreground shadow-sm"
		>
			<CirclePlayIcon class="size-3" />Initial
		</span>
	{/if}
	<Handle type="target" position={Position.Left} class="size-4! bg-blue-400!" />
	<Handle type="source" position={Position.Right} id="default" class="size-4! bg-orange-300!" />

	<div class="grid gap-2 p-2">
		<div
			class="flex items-center gap-2 rounded-lg border p-2 bg-background/60"
		>
			<div
				class="grid size-9 shrink-0 place-items-center rounded-md {part.backgroundType
					? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
					: 'bg-muted text-muted-foreground'}"
			>
				{#if !part.backgroundType}
					<BanIcon class="size-4" />
				{:else if part.backgroundType === 'video'}
					<VideoIcon class="size-4" />
				{:else}
					<ImageIcon class="size-4" />
				{/if}
			</div>
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm font-medium">{backgroundLabel}</p>
				{#if part.backgroundType === 'video' && video}
					<p class="text-xs text-muted-foreground">{formatDuration(video.duration)}</p>
				{:else if !part.backgroundType}
					<p class="text-xs text-muted-foreground">Transparent canvas</p>
				{/if}
			</div>
		</div>

		<div
			class="flex items-center gap-2 rounded-lg border p-2 bg-background/60"
		>
			<div
				class="grid size-9 shrink-0 place-items-center rounded-md {part.foregroundType
					? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
					: 'bg-muted text-muted-foreground'}"
			>
				{#if !part.foregroundType}
					<BanIcon class="size-4" />
				{:else if part.foregroundType === 'quiz'}
					<ShapesIcon class="size-4" />
				{:else if part.foregroundType === 'taxonomy'}
					<LayersIcon class="size-4" />
				{:else}
					<MessageSquareIcon class="size-4" />
				{/if}
			</div>
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm font-medium">{foregroundLabel}</p>
				{#if part.foregroundType === 'quiz'}
					<p class="text-xs text-muted-foreground">{quiz?.questions.length ?? 0} questions</p>
				{:else if part.foregroundType === 'taxonomy'}
					<p class="text-xs text-muted-foreground">Taxonomy game</p>
				{:else if !part.foregroundType}
					<p class="text-xs text-muted-foreground">No overlay</p>
				{/if}
			</div>
		</div>
	</div>

	{#if part.foregroundType === 'quiz'}
		<Separator />
		<div class="grid gap-2 py-2">
			{#each part.quizLogicForPart?.rules ?? [] as rule (rule.id)}
				{#if !rule.isRemoved}
					<div class="relative px-4 pr-7">
						<p class="truncate text-xs">{rule.name || `Rule ${rule.order}`}</p>
						<Handle
							type="source"
							position={Position.Right}
							id={rule.id}
							class="size-4! bg-amber-300!"
						/>
					</div>
				{/if}
			{/each}
			<div class="relative px-4 pr-7">
				<p class="text-xs text-muted-foreground italic">Default after quiz</p>
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
		<Separator />
		<div class="grid gap-2 py-2">
			{#each part.taxonomyDraftForPart?.rules ?? [] as rule (rule.id)}
				{#if !rule.isRemoved}
					<div class="relative px-4 pr-7">
						<p class="truncate text-xs">{rule.name || `Rule ${rule.order}`}</p>
						<Handle
							type="source"
							position={Position.Right}
							id={`taxonomy-rule:${rule.id}`}
							class="size-4! bg-emerald-300!"
						/>
					</div>
				{/if}
			{/each}
			<div class="relative px-4 pr-7">
				<p class="text-xs text-muted-foreground italic">Default after taxonomy</p>
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
