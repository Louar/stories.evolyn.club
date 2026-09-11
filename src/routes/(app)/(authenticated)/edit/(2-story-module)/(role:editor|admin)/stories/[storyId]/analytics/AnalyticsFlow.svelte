<script lang="ts">
	import type { findOneStoryById } from '$lib/db/repositories/2-story-module';
	import { formatDuration, translateLocalizedField } from '$lib/db/schemas/0-utils.js';
	import { Background, Controls, SvelteFlow, type Edge, type Node } from '@xyflow/svelte';
	import { mode } from 'mode-watcher';
	import { SvelteMap } from 'svelte/reactivity';
	import AnalyticsEdge from './AnalyticsEdge.svelte';
	import AnalyticsNode from './AnalyticsNode.svelte';

	type Story = Awaited<ReturnType<typeof findOneStoryById>>;
	type Transition = { fromPartId: string; toPartId: string; count: number };
	type Interaction = {
		partId: string;
		quizQuestionTemplateId: string;
		quizQuestionTemplateAnswerItemId: string | null;
		value: object | null;
		count: number;
	};
	type Props = { story: Story; transitions: Transition[]; interactions: Interaction[] };

	let { story, transitions, interactions }: Props = $props();

	const incoming = $derived.by(() => {
		const counts = new SvelteMap<string, number>();
		for (const transition of transitions) {
			counts.set(transition.toPartId, (counts.get(transition.toPartId) ?? 0) + transition.count);
		}
		return counts;
	});
	const outgoing = $derived.by(() => {
		const counts = new SvelteMap<string, number>();
		for (const transition of transitions) {
			counts.set(
				transition.fromPartId,
				(counts.get(transition.fromPartId) ?? 0) + transition.count
			);
		}
		return counts;
	});

	let nodes: Node[] = $derived.by(() =>
		story.parts.map((part, index) => {
			const video = story.videos.find((item) => item.id === part.videoId);
			const still = story.stills.find((item) => item.id === part.stillId);
			const announcement = story.announcements.find(
				(item) => item.id === part.announcementTemplateId
			);
			const quiz = story.quizzes.find((item) => item.id === part.quizTemplateId);
			const taxonomy = story.taxonomies.find((item) => item.id === part.taxonomyId);
			const questions = (quiz?.questions ?? [])
				.map((question) => {
					const questionInteractions = interactions.filter(
						(interaction) =>
							interaction.partId === part.id && interaction.quizQuestionTemplateId === question.id
					);
					const total = questionInteractions.reduce(
						(sum, interaction) => sum + interaction.count,
						0
					);
					const answers = questionInteractions
						.map((interaction) => {
							const option = question.answerOptions.find(
								(item) => item.id === interaction.quizQuestionTemplateAnswerItemId
							);
							const fallback = interaction.value
								? JSON.stringify(interaction.value)
								: 'Unknown answer';
							return {
								id: interaction.quizQuestionTemplateAnswerItemId ?? `${question.id}-${fallback}`,
								label: option?.label ?? { en: fallback },
								count: interaction.count,
								percentage: total ? Math.round((interaction.count / total) * 100) : 0
							};
						})
						.sort((a, b) => b.count - a.count);
					return { id: question.id, title: question.title, total, answers };
				})
				.filter((question) => question.total > 0);

			return {
				id: part.id,
				type: 'analytics',
				position: part.position ?? { x: index * 400, y: 0 },
				data: {
					part,
					label: `Part ${index + 1}`,
					backgroundLabel:
						part.backgroundType === 'video'
							? (video?.name ?? 'Unselected video')
							: part.backgroundType === 'still'
								? (still?.image?.filename ?? still?.color ?? 'Unselected still')
								: 'No background',
					backgroundDetail:
						part.backgroundType === 'video' && video
							? formatDuration(video.duration)
							: part.backgroundType
								? undefined
								: 'Transparent canvas',
					foregroundLabel:
						part.foregroundType === 'quiz'
							? (quiz?.name ?? 'Unselected quiz')
							: part.foregroundType === 'taxonomy'
								? translateLocalizedField(taxonomy?.name) || 'Unselected taxonomy'
								: part.foregroundType === 'announcement'
									? (announcement?.name ?? 'Unselected announcement')
									: 'No foreground',
					foregroundDetail:
						part.foregroundType === 'quiz'
							? `${quiz?.questions.length ?? 0} questions`
							: part.foregroundType === 'taxonomy'
								? 'Taxonomy game'
								: part.foregroundType
									? undefined
									: 'No overlay',
					arrivals: incoming.get(part.id) ?? 0,
					departures: outgoing.get(part.id) ?? 0,
					questions
				}
			};
		})
	);

	const maxTransitionCount = $derived(Math.max(0, ...transitions.map((item) => item.count)));
	let edges: Edge[] = $derived.by(() =>
		transitions.map((transition) => ({
			id: `${transition.fromPartId}-${transition.toPartId}`,
			type: 'analytics',
			source: transition.fromPartId,
			target: transition.toPartId,
			data: {
				count: transition.count,
				width:
					maxTransitionCount <= 1
						? 2
						: 2 + (Math.log(transition.count) / Math.log(maxTransitionCount)) * 8
			}
		}))
	);
</script>

<SvelteFlow
	nodeTypes={{ analytics: AnalyticsNode }}
	edgeTypes={{ analytics: AnalyticsEdge }}
	bind:nodes
	bind:edges
	fitView
	maxZoom={1.25}
	minZoom={0.2}
	nodesDraggable={false}
	nodesConnectable={false}
	elementsSelectable={false}
	deleteKey={null}
	proOptions={{ hideAttribution: true }}
	colorMode={mode.current}
>
	<Background patternColor="#6a7282" gap={50} />
	<Controls showLock={false} />
</SvelteFlow>
