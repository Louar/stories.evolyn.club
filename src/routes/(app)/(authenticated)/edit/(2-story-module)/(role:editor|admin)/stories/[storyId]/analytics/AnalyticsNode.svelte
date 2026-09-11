<script lang="ts">
	import { translateLocalizedField } from '$lib/db/schemas/0-utils.js';
	import { PartTerminationStrategy } from '$lib/db/schemas/2-story-module.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import BanIcon from '@lucide/svelte/icons/ban';
	import CirclePlayIcon from '@lucide/svelte/icons/circle-play';
	import ImageIcon from '@lucide/svelte/icons/image';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import ShapesIcon from '@lucide/svelte/icons/shapes';
	import VideoIcon from '@lucide/svelte/icons/video';
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';

	type Answer = { id: string; label: unknown; count: number; percentage: number };
	type Question = { id: string; title: unknown; total: number; answers: Answer[] };
	type AnalyticsNodeData = {
		part: {
			id: string;
			isInitial: boolean;
			terminationStrategy: PartTerminationStrategy;
			backgroundType: string | null;
			foregroundType: string | null;
		};
		label: string;
		backgroundLabel: string;
		backgroundDetail?: string;
		foregroundLabel: string;
		foregroundDetail?: string;
		arrivals: number;
		departures: number;
		questions: Question[];
	};

	let { data }: NodeProps & { data: AnalyticsNodeData } = $props();
	let part = $derived(data.part);
	let terminationLabel = $derived(
		part.terminationStrategy === PartTerminationStrategy.completeStory
			? 'Completes story'
			: part.terminationStrategy === PartTerminationStrategy.failStory
				? 'Fails story'
				: undefined
	);
</script>

<div
	class="relative w-80 rounded-xl border bg-card shadow-md"
	aria-label={`Analytics for ${data.label}`}
>
	{#if part.isInitial}
		<span
			class="absolute -top-2 -right-2 z-10 inline-flex items-center gap-1 rounded-full border bg-primary px-2 py-1 text-[0.65rem] font-medium text-primary-foreground shadow-sm"
		>
			<CirclePlayIcon class="size-3" />Initial
		</span>
	{/if}
	{#if terminationLabel}
		<span
			class="absolute -right-2 -bottom-2 z-10 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[0.65rem] font-medium shadow-sm {part.terminationStrategy ===
			PartTerminationStrategy.completeStory
				? 'bg-emerald-600 text-primary-foreground'
				: 'bg-destructive text-primary-foreground'}"
		>
			{terminationLabel}
		</span>
	{/if}
	<Handle
		type="target"
		position={Position.Left}
		isConnectable={false}
		class="size-3! bg-primary!"
	/>
	<Handle
		type="source"
		position={Position.Right}
		isConnectable={false}
		class="size-3! bg-primary!"
	/>

	<div class="grid gap-2 p-2">
		<div class="px-1 pt-1">
			<p class="text-xs font-semibold">{data.label}</p>
			<p class="truncate font-mono text-[0.6rem] text-muted-foreground">{part.id}</p>
		</div>
		<div class="flex items-center gap-2 rounded-lg border bg-background/60 p-2">
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
				<p class="truncate text-sm font-medium">{data.backgroundLabel}</p>
				{#if data.backgroundDetail}
					<p class="text-xs text-muted-foreground">{data.backgroundDetail}</p>
				{/if}
			</div>
		</div>

		<div class="flex items-center gap-2 rounded-lg border bg-background/60 p-2">
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
				<p class="truncate text-sm font-medium">{data.foregroundLabel}</p>
				{#if data.foregroundDetail}
					<p class="text-xs text-muted-foreground">{data.foregroundDetail}</p>
				{/if}
			</div>
		</div>
	</div>

	<Separator />
	<div class="space-y-3 p-4">
		<div class="grid grid-cols-2 gap-2 text-xs">
			<div class="rounded-md bg-muted/60 p-2">
				<p class="text-muted-foreground">Arrivals</p>
				<p class="mt-1 text-lg font-semibold tabular-nums">{data.arrivals}</p>
			</div>
			<div class="rounded-md bg-muted/60 p-2">
				<p class="text-muted-foreground">Departures</p>
				<p class="mt-1 text-lg font-semibold tabular-nums">{data.departures}</p>
			</div>
		</div>

		{#if part.foregroundType === 'quiz'}
			<div class="space-y-3 border-t pt-3">
				<div class="flex items-center gap-1.5 text-xs font-medium">
					<ShapesIcon class="size-3.5" />Answer popularity
				</div>
				{#if data.questions.length === 0}
					<p class="text-xs text-muted-foreground">No answers in this period.</p>
				{:else}
					{#each data.questions as question (question.id)}
						<div class="space-y-1.5">
							<p class="truncate text-xs font-medium">
								{translateLocalizedField(question.title as never)}
							</p>
							{#each question.answers as answer (answer.id)}
								<div class="space-y-1">
									<div class="flex justify-between gap-3 text-[0.65rem]">
										<span class="truncate">{translateLocalizedField(answer.label as never)}</span>
										<span class="shrink-0 tabular-nums">{answer.percentage}% ({answer.count})</span>
									</div>
									<div class="h-1.5 overflow-hidden rounded-full bg-muted">
										<div
											class="h-full rounded-full bg-violet-500"
											style={`width: ${answer.percentage}%`}
										></div>
									</div>
								</div>
							{/each}
						</div>
					{/each}
				{/if}
			</div>
		{/if}
	</div>
</div>
