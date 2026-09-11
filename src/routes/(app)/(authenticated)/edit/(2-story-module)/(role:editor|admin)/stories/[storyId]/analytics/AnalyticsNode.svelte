<script lang="ts">
	import { translateLocalizedField } from '$lib/db/schemas/0-utils.js';
	import CirclePlayIcon from '@lucide/svelte/icons/circle-play';
	import ShapesIcon from '@lucide/svelte/icons/shapes';
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';

	type Answer = { id: string; label: unknown; count: number; percentage: number };
	type Question = { id: string; title: unknown; total: number; answers: Answer[] };
	type AnalyticsNodeData = {
		part: {
			id: string;
			isInitial: boolean;
			foregroundType: string | null;
		};
		label: string;
		arrivals: number;
		departures: number;
		questions: Question[];
	};

	let { data }: NodeProps & { data: AnalyticsNodeData } = $props();
	let part = $derived(data.part);
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

	<div class="space-y-3 p-4">
		<div>
			<p class="truncate text-sm font-semibold">{data.label}</p>
			<p class="font-mono text-[0.65rem] text-muted-foreground">{part.id}</p>
		</div>
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
