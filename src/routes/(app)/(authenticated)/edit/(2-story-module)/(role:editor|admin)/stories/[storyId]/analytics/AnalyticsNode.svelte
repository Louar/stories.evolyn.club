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
	import type { findOneStoryById } from '$lib/db/repositories/2-story-module.js';

	type Part = Awaited<ReturnType<typeof findOneStoryById>>['parts'][number];
	type Answer = { id: string; label: unknown; count: number; percentage: number };
	type Question = { id: string; title: unknown; total: number; answers: Answer[] };
	type AnalyticsNodeData = {
		part: Part;
		label: string;
		backgroundLabel: string;
		foregroundLabel: string;
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
	let isTerminal = $derived(part.terminationStrategy !== PartTerminationStrategy.none);
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
	{#if !isTerminal}
		<Handle
			type="source"
			position={Position.Right}
			id="default"
			isConnectable={false}
			class="size-3! bg-primary!"
		/>
	{/if}

	<div class="flex items-center gap-2 p-2">
		<p class="shrink-0 pl-1 text-sm font-semibold">{data.label}</p>
		<div class="ml-auto flex min-w-0 items-center gap-1.5">
			<div
				class="flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-[0.65rem] {part.backgroundType
					? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
					: 'bg-muted text-muted-foreground'}"
				title={data.backgroundLabel}
			>
				{#if !part.backgroundType}
					<BanIcon class="size-3" />
				{:else if part.backgroundType === 'video'}
					<VideoIcon class="size-3" />
				{:else}
					<ImageIcon class="size-3" />
				{/if}
				<span class="max-w-20 truncate">{data.backgroundLabel}</span>
			</div>
			<div
				class="flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-[0.65rem] {part.foregroundType
					? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
					: 'bg-muted text-muted-foreground'}"
				title={data.foregroundLabel}
			>
				{#if !part.foregroundType}
					<BanIcon class="size-3" />
				{:else if part.foregroundType === 'quiz'}
					<ShapesIcon class="size-3" />
				{:else if part.foregroundType === 'taxonomy'}
					<LayersIcon class="size-3" />
				{:else}
					<MessageSquareIcon class="size-3" />
				{/if}
				<span class="max-w-20 truncate">{data.foregroundLabel}</span>
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

	{#if part.foregroundType === 'quiz' && !isTerminal}
		<Separator />
		<div class="grid gap-2 py-3">
			{#each part.quizLogicForPart?.rules ?? [] as rule (rule.id)}
				{#if !rule.isRemoved}
					<div class="relative px-4 pr-7">
						<p class="truncate text-xs">{rule.name || `Rule ${rule.order}`}</p>
						<Handle
							type="source"
							position={Position.Right}
							id={rule.id}
							isConnectable={false}
							class="size-3! bg-amber-300!"
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
					isConnectable={false}
					class="size-3! bg-amber-300!"
				/>
			</div>
		</div>
	{/if}

	{#if part.foregroundType === 'taxonomy' && !isTerminal}
		<Separator />
		<div class="grid gap-2 py-3">
			{#each part.taxonomyDraftForPart?.rules ?? [] as rule (rule.id)}
				{#if !rule.isRemoved}
					<div class="relative px-4 pr-7">
						<p class="truncate text-xs">{rule.name || `Rule ${rule.order}`}</p>
						<Handle
							type="source"
							position={Position.Right}
							id={`taxonomy-rule:${rule.id}`}
							isConnectable={false}
							class="size-3! bg-emerald-300!"
						/>
					</div>
				{/if}
			{/each}
			<div class="relative px-4 pr-7">
				<p class="text-xs text-muted-foreground italic">Default after taxonomy draft</p>
				<Handle
					type="source"
					position={Position.Right}
					id="default-after-taxonomy"
					isConnectable={false}
					class="size-3! bg-emerald-300!"
				/>
			</div>
		</div>
	{/if}
</div>
