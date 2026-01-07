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
					id: `e-${part.id}-default-${part.defaultNextPartId}`,
					type: 'media',
					source: part.id,
					sourceHandle: 'default',
					target: part.defaultNextPartId
				});
			}

			// Quiz logic edges from rawlogic rules
			if (part.foreground && 'rawlogic' in part.foreground && part.foreground.rawlogic?.rules) {
				part.foreground.rawlogic.rules.forEach((rule) => {
					if (rule.nextPartId) {
						e.push({
							id: `e-${part.id}-${rule.id}-${rule.nextPartId}`,
							type: 'media',
							source: part.id,
							sourceHandle: rule.id,
							target: rule.nextPartId
						});
					}
				});
			}
		});
		edges = e;
	});

	const connect: OnConnectEnd = (event, connectionState) => {
		if (connectionState.isValid) {
			if (!connectionState.fromHandle || !connectionState.toHandle) return;
			const { type: fromType, nodeId: fromNode, id: fromHandle } = connectionState.fromHandle;
			const { type: toType, nodeId: toNode, id: toHandle } = connectionState.toHandle;

			let sourceNode = fromNode;
			let sourceHandle = fromHandle;
			let targetNode = toNode;
			if (fromType === 'target' && toType === 'source') {
				sourceNode = toNode;
				sourceHandle = toHandle;
				targetNode = fromNode;
			}

			// Remove existing edge if source already has an outgoing edge on the same handle
			edges = edges.filter(
				(e) =>
					!(e.source === sourceNode && e.sourceHandle === sourceHandle && e.target !== targetNode)
			);
		} else {
			if (!connectionState.fromHandle) return;
			const { type: fromType, nodeId: fromNode, id: fromHandle } = connectionState.fromHandle;
			if (fromType !== 'source') return;
			const id = crypto.randomUUID().toString();
			const { clientX, clientY } = 'changedTouches' in event ? event.changedTouches[0] : event;

			const newNode: Node = {
				id,
				type: 'media',
				data: {
					part: undefined,
					videos: story?.videos ?? [],
					announcements: story?.announcements ?? [],
					quizzes: story?.quizzes ?? []
				},
				position: screenToFlowPosition(
					{
						x: clientX,
						y: clientY
					},
					{ snapToGrid: true }
				)
				// set the origin of the new node so it is centered
				// origin: [0.5, 0.0]
			};

			nodes = [...nodes, newNode];
			edges = [
				...edges,
				{
					id: `e-${fromNode}-${fromHandle ?? 'default'}-${id}`,
					type: 'media',
					source: fromNode,
					sourceHandle: fromHandle ?? 'default',
					target: id
				}
			];
		}
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
