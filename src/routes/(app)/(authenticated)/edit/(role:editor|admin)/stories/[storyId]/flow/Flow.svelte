<script lang="ts">
	import type { findOnePartById, findOneStoryById } from '$lib/db/repositories/2-stories-module';
	import {
		Background,
		Controls,
		SvelteFlow,
		useSvelteFlow,
		type Edge,
		type Node,
		type OnConnectEnd,
		type OnDelete
	} from '@xyflow/svelte';
	import { mode } from 'mode-watcher';
	import { toast } from 'svelte-sonner';
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
				storyId: story.id,
				part
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
			if (part.quizLogicForPart) {
				if (part.quizLogicForPart.defaultNextPartId?.length) {
					e.push({
						id: `e-${part.id}-default-after-quiz-${part.quizLogicForPart.defaultNextPartId}`,
						type: 'media',
						source: part.id,
						sourceHandle: 'default-after-quiz',
						target: part.quizLogicForPart.defaultNextPartId
					});
				}
				part.quizLogicForPart?.rules?.forEach((rule) => {
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

	const connect: OnConnectEnd = async (event, connectionState) => {
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

			const result = await fetch(`/api/stories/${story?.id}/parts/${sourceNode}/connections`, {
				method: 'POST',
				body: JSON.stringify({ handle: sourceHandle, target: targetNode })
			});
			if (!result.ok) {
				toast.error('Connecting nodes failed, please refresh', {
					closeButton: true,
					duration: Infinity
				});
			}
		} else {
			if (!connectionState.fromHandle || !story?.id) return;
			const { type: fromType, nodeId: fromNode, id: fromHandle } = connectionState.fromHandle;
			if (fromType !== 'source') return;
			const { clientX, clientY } = 'changedTouches' in event ? event.changedTouches[0] : event;

			const position = screenToFlowPosition({ x: clientX, y: clientY }, { snapToGrid: true });

			const result = await fetch(`/api/stories/${story?.id}/parts/new`, {
				method: 'POST',
				body: JSON.stringify({ position })
			});
			if (!result.ok) {
				toast.error('Creating a new node failed, please refresh', {
					closeButton: true,
					duration: Infinity
				});
			}
			const part = (await result.json()) as Awaited<ReturnType<typeof findOnePartById>>;

			const newNode: Node = {
				id: part.id,
				type: 'media',
				data: {
					storyId: story.id,
					part
				},
				position
			};

			const result2 = await fetch(`/api/stories/${story?.id}/parts/${fromNode}/connections`, {
				method: 'POST',
				body: JSON.stringify({ handle: fromHandle, target: part.id })
			});
			if (!result2.ok) {
				toast.error('Connecting nodes failed, please refresh', {
					closeButton: true,
					duration: Infinity
				});
			}

			nodes = [...nodes, newNode];
			edges = [
				...edges.filter((e) => !(e.source === fromNode && e.sourceHandle === fromHandle)),
				{
					id: `e-${fromNode}-${fromHandle ?? 'default'}-${part.id}`,
					type: 'media',
					source: fromNode,
					sourceHandle: fromHandle ?? 'default',
					target: part.id
				}
			];
		}
	};

	const remove: OnDelete = async ({ nodes, edges }) => {
		if (edges?.length) {
			const { source: sourceNode, sourceHandle, target: targetNode } = edges[0];
			const result = await fetch(`/api/stories/${story?.id}/parts/${sourceNode}/connections`, {
				method: 'DELETE',
				body: JSON.stringify({ handle: sourceHandle, target: targetNode })
			});
			if (!result.ok) {
				toast.error('Deleting connecting between nodes failed, please refresh', {
					closeButton: true,
					duration: Infinity
				});
			}
		}
		if (nodes?.length) {
			const result = await fetch(`/api/stories/${story?.id}/parts/${nodes[0].id}`, {
				method: 'DELETE'
			});
			if (!result.ok) {
				toast.error('Deleting node failed, please refresh', {
					closeButton: true,
					duration: Infinity
				});
			}
		}
	};
</script>

<SvelteFlow
	nodeTypes={{ media: MediaNode }}
	edgeTypes={{ media: MediaEdge }}
	bind:nodes
	bind:edges
	fitView
	maxZoom={1}
	minZoom={0.25}
	defaultEdgeOptions={{ type: 'media' }}
	onconnectend={connect}
	ondelete={remove}
	proOptions={{ hideAttribution: true }}
	snapGrid={[400, 200]}
	colorMode={mode.current}
>
	<Background patternColor="#6a7282" gap={50} />
	<Controls />
</SvelteFlow>

<!-- <style lang="postcss">
	:root {
		--xy-background-color: #f9fafb;
	}
</style> -->
