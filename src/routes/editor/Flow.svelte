<script lang="ts">
	import {
		Background,
		SvelteFlow,
		useSvelteFlow,
		type Edge,
		type Node,
		type OnConnectEnd
	} from '@xyflow/svelte';
	import MediaEdge from './MediaEdge.svelte';
	import MediaNode from './MediaNode.svelte';
	import { initialEdges, initialNodes } from './nodes-and-edges';

	let nodes = $state.raw<Node[]>(initialNodes);
	let edges = $state.raw<Edge[]>(initialEdges);

	const nodeTypes = {
		media: MediaNode
	};

	const edgeTypes = {
		media: MediaEdge
	};

	const { screenToFlowPosition } = useSvelteFlow();

	const handleConnectEnd: OnConnectEnd = (event, connectionState) => {
		if (connectionState.isValid) return;

		const sourceNodeId = connectionState.fromNode?.id ?? '1';
		const id = crypto.randomUUID().toString();
		const { clientX, clientY } = 'changedTouches' in event ? event.changedTouches[0] : event;

		const newNode: Node = {
			id,
			type: 'media',
			data: { label: `Node ${id}` },
			// project the screen coordinates to pane coordinates
			position: screenToFlowPosition({
				x: clientX,
				y: clientY
			}),
			// set the origin of the new node so it is centered
			origin: [0.5, 0.0]
		};
		nodes = [...nodes, newNode];
		edges = [
			...edges,
			{
				source: sourceNodeId,
				target: id,
				id: `${sourceNodeId}--${id}`
			}
		];
	};
</script>

<SvelteFlow
	bind:nodes
	{nodeTypes}
	bind:edges
	{edgeTypes}
	fitView
	defaultEdgeOptions={{ type: 'media' }}
	onconnectend={handleConnectEnd}
	proOptions={{ hideAttribution: true }}
	snapGrid={[400, 200]}
>
	<Background patternColor="#aaa" gap={16} />
</SvelteFlow>

<style lang="postcss">
	:root {
		--xy-background-color: #f7f9fb;
		--xy-edge-stroke-selected-default: red;
		--xy-connectionline-stroke-default: green;
	}
</style>
