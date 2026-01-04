<script lang="ts">
	import { BaseEdge, getBezierPath, Position, type EdgeProps } from '@xyflow/svelte';

	let { target, source, sourceX, sourceY, targetX, targetY, markerEnd }: EdgeProps = $props();

	let path: string = $derived.by(() => {
		if (target === source) {
			const radiusX = (sourceX - targetX) * 0.6;
			const radiusY = 50;
			return `M ${sourceX - 5} ${sourceY} A ${radiusX} ${radiusY} 0 1 0 ${targetX + 2} ${targetY}`;
		} else if (sourceX > targetX) {
			const edgePadX = 25;
			const dir = Math.sign(sourceX - targetX) || 1;

			const arcStartX = sourceX + edgePadX * dir;
			const arcEndX = targetX - edgePadX * dir;

			const dx = Math.abs(arcStartX - arcEndX);
			const radiusX = Math.max(dx * 0.6, 80);
			const radiusY = 360;

			return `M ${sourceX} ${sourceY}
			  L ${arcStartX} ${sourceY}
			  A ${radiusX} ${radiusY} 0 1 1 ${arcEndX} ${targetY}
			  L ${targetX} ${targetY}`;
		} else {
			const [path] = getBezierPath({
				sourceX,
				sourceY,
				sourcePosition: Position.Right,
				targetX,
				targetY,
				targetPosition: Position.Left
			});
			return path;
		}
	});
</script>

<BaseEdge {path} {markerEnd} class="stroke-2!" />
