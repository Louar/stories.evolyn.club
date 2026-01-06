<script lang="ts">
	import type { findOneStoryById } from '$lib/db/repositories/2-stories-module';
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

	type Props = {
		story: Awaited<ReturnType<typeof findOneStoryById>> | undefined;
	};
	let { story }: Props = $props();

	let nodes = $state.raw<Node[]>([]);
	let edges = $state.raw<Edge[]>([]);

	// Transform story parts into nodes
	$effect(() => {
		if (!story?.parts) {
			nodes = [];
			edges = [];
			return;
		}

		const newNodes: Node[] = story.parts.map((part, index) => {
			const hasQuiz =
				part.foregroundType === 'quiz' && part.foreground && 'rawlogic' in part.foreground;
			const background = part.background;
			const duration = background?.duration ?? 300;

			// Calculate position based on index (simple layout)
			const x = (index % 3) * 400;
			const y = Math.floor(index / 3) * 300;

			return {
				id: part.id,
				type: 'media',
				position: { x, y },
				data: {
					part,
					videos: story.videos,
					announcements: story.announcements,
					quizzes: story.quizzes,
					label:
						part.backgroundType === 'video'
							? background?.source
								? background.source.split('/').pop()?.split('.')[0] || 'Video'
								: 'Video'
							: part.foregroundType === 'quiz'
								? 'Quiz'
								: part.foregroundType === 'announcement'
									? 'Announcement'
									: 'Part',
					duration,
					hasQuiz,
					isInitial: part.isInitial || false,
					isFinal: part.isFinal || false,
					backgroundType: part.backgroundType,
					backgroundSource: background?.source
				}
			};
		});

		// Create edges based on defaultNextPartId and quiz logic
		const newEdges: Edge[] = [];

		story.parts.forEach((part) => {
			// Default edge from defaultNextPartId
			if (part.defaultNextPartId) {
				newEdges.push({
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
						newEdges.push({
							id: `e-${part.id}-${rule.order}-${rule.nextPartId}`,
							source: part.id,
							target: rule.nextPartId,
							sourceHandle: String(rule.order)
						});
					}
				});
			}
		});

		nodes = newNodes;
		edges = newEdges;
	});

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
