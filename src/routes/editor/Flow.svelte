<script lang="ts">
	import type { findOneStoryById } from '$lib/db/repositories/2-stories-module';
	import {
		Background,
		Controls,
		SvelteFlow,
		useSvelteFlow,
		type Edge,
		type Node,
		type OnConnectEnd
	} from '@xyflow/svelte';
	import MediaEdge from './MediaEdge.svelte';
	import MediaNode from './MediaNode.svelte';

	type Props = {
		story: Awaited<ReturnType<typeof findOneStoryById>> | undefined;
	};
	let { story }: Props = $props();

	let nodes = $state.raw<Node[]>([]);
	let edges = $state.raw<Edge[]>([]);

	const { screenToFlowPosition } = useSvelteFlow();

	// Transform story into nodes & edges
	$effect(() => {
		if (!story?.parts) {
			nodes = [];
			edges = [];
			return;
		}

		nodes = story.parts.map((part) => ({
			id: part.id,
			type: 'media',
			position: part.position ?? { x: 0, y: 0 },
			data: {
				part,
				videos: story.videos,
				announcements: story.announcements,
				quizzes: story.quizzes
			}
		}));

		const e: Edge[] = [];
		story.parts.forEach((part) => {
			// Default edge from defaultNextPartId
			if (part.defaultNextPartId) {
				e.push({
					id: `e-${part.id}-${part.defaultNextPartId}`,
					source: part.id,
					target: part.defaultNextPartId,
					sourceHandle: 'default'
				});
			}

			// Quiz logic edges from rawlogic rules
			if (part.foreground && 'rawlogic' in part.foreground && part.foreground.rawlogic?.rules) {
				part.foreground.rawlogic.rules.forEach((rule) => {
					if (rule.nextPartId) {
						e.push({
							id: `e-${part.id}-${rule.id}-${rule.nextPartId}`,
							source: part.id,
							target: rule.nextPartId,
							sourceHandle: rule.id
						});
					}
				});
			}
		});
		edges = e;
	});

	const connect: OnConnectEnd = (event, connectionState) => {
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
	nodeTypes={{ media: MediaNode }}
	edgeTypes={{ media: MediaEdge }}
	bind:nodes
	bind:edges
	fitView
	defaultEdgeOptions={{ type: 'media' }}
	onconnectend={connect}
	proOptions={{ hideAttribution: true }}
	snapGrid={[400, 200]}
>
	<Background patternColor="#6a7282" gap={50} />
	<Controls />
</SvelteFlow>

<style lang="postcss">
	:root {
		--xy-background-color: #f9fafb;
	}
</style>
