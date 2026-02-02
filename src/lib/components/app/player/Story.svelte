<script lang="ts">
	import type { findOneStoryByReference } from '$lib/db/repositories/2-stories-module.js';
	import { Orientation } from '$lib/db/schemas/0-utils.js';
	import { PLAYERS } from '$lib/states/players.svelte.js';
	import { cn } from '$lib/utils.js';
	import type { ClassValue } from 'clsx';
	import { onMount } from 'svelte';
	import AnnouncementOverlay from './AnnouncementOverlay.svelte';
	import InteractionOverlay from './InteractionOverlay.svelte';
	import PlayerComponent from './Player.svelte';
	import type { InputFromLogic, Logic, OutputFromLogic, Player } from './types.js';

	type Props = {
		story: NonNullable<Awaited<ReturnType<typeof findOneStoryByReference>>>;
		orientation: Orientation | undefined;
		players: Player[];

		class?: ClassValue | null | undefined;
	};
	let {
		story = $bindable(),
		orientation = $bindable(),
		players = $bindable(),
		class: className
	}: Props = $props();

	let pid: string | undefined = $state();
	let start: number | undefined = $state();

	onMount(() => {
		pid = story?.parts?.[0]?.id;
		start = new Date().getTime();
	});

	const submit = (logic: Logic | undefined, input: InputFromLogic<Logic>) => {
		if (!logic || !input) return;
		const output = executeLogic(logic, input);
		if (!output?.next || typeof output.next !== 'string') return;

		const player = players.find((p) => p.id === output.next);
		if (!player) return;

		if (pid === output.next) {
			player.doRestart = true;
		} else {
			players.find((player) => player.id === pid)!.doEnd = true;
			pid = output.next;
			player.doBuffer = true;
			player.doPlay = true;
		}
	};
	const executeLogic = (
		logic: Logic,
		input: InputFromLogic<Logic>
	): OutputFromLogic<Logic> | null => {
		const candidates = logic.rules
			.map((rule, idx) => {
				let score = 0;

				const matches = logic.inputs.every(({ field }) => {
					const raw = rule[field];

					// Missing value => wildcard/default for this field
					if (raw == null) return true;

					// If present but not a string, treat as non-match (keep your original strictness)
					if (typeof raw !== 'string') return false;

					let expected: unknown;
					try {
						expected = JSON.parse(raw);
					} catch {
						return false;
					}

					// JSON.stringify('') => wildcard/default for this field
					if (expected === '') return true;

					// Non-wildcard constraint
					score += 1;
					return input[field] === expected;
				});

				return matches ? { rule, score, idx } : null;
			})
			.filter(Boolean) as Array<{ rule: any; score: number; idx: number }>;

		if (candidates.length === 0) return null;

		// Prefer most specific; if tied, prefer later rule
		const matchedRule = candidates.reduce((best, cur) => {
			if (cur.score > best.score) return cur;
			if (cur.score === best.score && cur.idx > best.idx) return cur;
			return best;
		}).rule;

		return logic.outputs.reduce(
			(result, { field }) => ({ ...result, [field]: matchedRule[field] }),
			{} as OutputFromLogic<Logic>
		);
	};
</script>

<div
	class={cn('relative mx-auto max-h-dvh max-w-dvw overflow-hidden', className)}
	class:aspect-portrait={!orientation || orientation === Orientation.portrait}
	class:aspect-video={orientation === Orientation.landscape}
	class:aspect-square={orientation === Orientation.square}
>
	{#if story?.parts?.length}
		{#each story?.parts as part (part.id)}
			{@const player = players.find((player) => player.id === part.id)}

			<div class="absolute inset-0 {part.id === pid ? 'opacity-100' : 'opacity-0'}">
				{#if part?.backgroundType === 'video' && player}
					{@const nextPlayers = [
						player.next?.length
							? new Map(players.map((p) => [p.id, p])).get(player.next)
							: undefined,
						...('logic' in part.foreground
							? (part.foreground?.logic?.rules?.map((rule) =>
									typeof rule.next === 'string'
										? new Map(players.map((p) => [p.id, p])).get(rule.next)
										: undefined
								) ?? [])
							: [])
					].filter((p): p is (typeof players)[number] => p !== undefined)}
					<PlayerComponent
						id={player.id}
						class={orientation ?? Orientation.portrait}
						src={player.source}
						poster={player?.thumbnail}
						start={player?.start ?? undefined}
						end={player?.end ?? undefined}
						playbackRate={player?.playbackRate ?? undefined}
						isInitialPart={player?.isInitialPart}
						bind:doBuffer={player.doBuffer}
						bind:doPlay={player.doPlay}
						bind:doRestart={player.doRestart}
						bind:doEnd={player.doEnd}
						bind:time={player.time}
						bufferNext={() => {
							if (nextPlayers?.length) {
								nextPlayers.forEach((nextPlayer) => (nextPlayer.doBuffer = true));
							}
						}}
						playNext={() => {
							const nextPlayer = players.find((p) => p.id === player.next);
							if (nextPlayer) {
								nextPlayer.doBuffer = true;
								nextPlayer.doPlay = true;
								pid = nextPlayer.id;
							} else if (!nextPlayers?.length) {
								const watchTime = Math.round(
									Object.values(PLAYERS.watchDurations)?.reduce((a, b) => a + b, 0)
								);
								const percentages = Object.values(PLAYERS.watchTimePercentages);
								const watchTimePercentage = Math.round(
									percentages?.reduce((a, b) => a + b, 0) / percentages.length
								);
								parent.postMessage(
									{
										isCompleted: true,
										start,
										end: new Date().getTime(),
										watchTime,
										watchTimePercentage
									},
									'*'
								);
							}
						}}
					/>
				{/if}

				{#if PLAYERS.didUserInteract && part.foreground && (player?.start ?? 0) + (player?.time ?? 0) >= (part.foreground?.start ?? 0) * part.background?.duration}
					{#if part.foregroundType === 'announcement' && 'title' in part.foreground && 'message' in part.foreground}
						<AnnouncementOverlay
							title={part.foreground?.title}
							message={part.foreground?.message}
						/>
					{/if}
					{#if part.foregroundType === 'quiz' && 'questions' in part.foreground && 'logic' in part.foreground}
						{@const questions = part.foreground?.doRandomize
							? part.foreground?.questions?.sort(() => Math.random() - 0.5)
							: part.foreground?.questions}
						<InteractionOverlay {questions} logic={part.foreground?.logic} {submit} />
					{/if}
				{/if}
			</div>
		{/each}
	{/if}
</div>
