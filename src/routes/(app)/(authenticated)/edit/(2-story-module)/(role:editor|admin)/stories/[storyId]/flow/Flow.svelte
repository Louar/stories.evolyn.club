<script lang="ts">
	import type { findOneStoryById } from '$lib/db/repositories/2-story-module';
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

	type Story = Awaited<ReturnType<typeof findOneStoryById>>;
	type Part = Story['parts'][number];
	type Props = {
		story: Story | undefined;
		selectedPartId?: string;
		onSelectPart: (partId?: string) => void;
		onPartSaved: (part: Part) => void;
		onPartCreated: (part: Part) => void;
		onPartDeleted: (partId: string) => void;
		onConnectionChange: (sourceId: string, handle: string, targetId: string | null) => void;
	};
	let {
		story,
		selectedPartId,
		onSelectPart,
		onPartSaved,
		onPartCreated,
		onPartDeleted,
		onConnectionChange
	}: Props = $props();

	let nodes = $derived<Node[]>(
		story?.parts?.map((part) => ({
			id: part.id,
			type: 'media',
			position: part.position ?? { x: 0, y: 0 },
			selected: part.id === selectedPartId,
			data: { part }
		})) ?? []
	);

	let edges = $derived.by(() => {
		const e: Edge[] = [];
		for (const part of story?.parts ?? []) {
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
				for (const rule of part.quizLogicForPart.rules ?? []) {
					if (rule.nextPartId) {
						e.push({
							id: `e-${part.id}-${rule.id}-${rule.nextPartId}`,
							type: 'media',
							source: part.id,
							sourceHandle: rule.id,
							target: rule.nextPartId
						});
					}
				}
			}

			if (part.taxonomyDraftForPart) {
				if (part.taxonomyDraftForPart.defaultNextPartId) {
					e.push({
						id: `e-${part.id}-default-after-taxonomy-${part.taxonomyDraftForPart.defaultNextPartId}`,
						type: 'media',
						source: part.id,
						sourceHandle: 'default-after-taxonomy',
						target: part.taxonomyDraftForPart.defaultNextPartId
					});
				}
				for (const rule of part.taxonomyDraftForPart.rules) {
					if (rule.nextPartId) {
						e.push({
							id: `e-${part.id}-taxonomy-${rule.id}-${rule.nextPartId}`,
							type: 'media',
							source: part.id,
							sourceHandle: `taxonomy-rule:${rule.id}`,
							target: rule.nextPartId
						});
					}
				}
			}
		}
		return e;
	});

	const { screenToFlowPosition } = useSvelteFlow();

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
			} else if (sourceHandle && targetNode)
				onConnectionChange(sourceNode, sourceHandle, targetNode);
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
				return;
			}
			const part = (await result.json()) as Part;

			const result2 = await fetch(`/api/stories/${story?.id}/parts/${fromNode}/connections`, {
				method: 'POST',
				body: JSON.stringify({ handle: fromHandle, target: part.id })
			});
			if (!result2.ok) {
				toast.error('Connecting nodes failed, please refresh', {
					closeButton: true,
					duration: Infinity
				});
			} else if (fromHandle) onConnectionChange(fromNode, fromHandle, part.id);

			onPartCreated(part);
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
			} else onConnectionChange(sourceNode, sourceHandle ?? 'default', null);
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
			} else onPartDeleted(nodes[0].id);
		}
	};

	const persistPosition = async ({ targetNode: node }: { targetNode: Node | null }) => {
		if (!node) return;
		const part = story?.parts.find((item) => item.id === node.id);
		if (!part || !story) return;
		const result = await fetch(`/api/stories/${story.id}/parts/${part.id}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ ...part, position: node.position })
		});
		if (!result.ok) {
			toast.error('Saving node position failed', { closeButton: true, duration: Infinity });
			return;
		}
		onPartSaved(await result.json());
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
	onnodeclick={({ node }) => onSelectPart(node.id)}
	onpaneclick={() => onSelectPart(undefined)}
	onnodedragstop={persistPosition}
	proOptions={{ hideAttribution: true }}
	snapGrid={[50, 50]}
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
