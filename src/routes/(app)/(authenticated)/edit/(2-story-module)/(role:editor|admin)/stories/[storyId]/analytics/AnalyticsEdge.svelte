<script lang="ts">
	import { BaseEdge, getBezierPath, Position, type EdgeProps } from '@xyflow/svelte';

	type AnalyticsEdgeData = { count: number; width: number };

	let {
		target,
		source,
		sourceX,
		sourceY,
		targetX,
		targetY,
		markerEnd,
		data
	}: EdgeProps & { data?: AnalyticsEdgeData } = $props();

	let path = $derived.by(() => {
		if (target === source || sourceX > targetX) {
			const edgePadX = target === source ? 10 : 25;
			const direction = Math.sign(sourceX - targetX) || 1;
			const arcStartX = sourceX + edgePadX * direction;
			const arcEndX = targetX - edgePadX * direction;
			const radiusX = Math.max(Math.abs(arcStartX - arcEndX) * 0.6, 80);
			const radiusY = target === source ? 200 : 360;

			return `M ${sourceX} ${sourceY} L ${arcStartX} ${sourceY} A ${radiusX} ${radiusY} 0 1 1 ${arcEndX} ${targetY} L ${targetX} ${targetY}`;
		}

		return getBezierPath({
			sourceX,
			sourceY,
			sourcePosition: Position.Right,
			targetX,
			targetY,
			targetPosition: Position.Left
		})[0];
	});
	let labelX = $derived((sourceX + targetX) / 2);
	let labelY = $derived(
		(sourceY + targetY) / 2 - (target === source ? 150 : sourceX > targetX ? 100 : 0)
	);
</script>

<BaseEdge
	{path}
	{markerEnd}
	style={`stroke-width: ${data?.width ?? 1.5}px`}
	class="stroke-primary!"
/>
<text
	x={labelX}
	y={labelY}
	text-anchor="middle"
	dominant-baseline="central"
	class="pointer-events-none fill-foreground text-[10px] font-semibold tabular-nums"
>
	{data?.count ?? 0}
</text>
