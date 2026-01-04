<script lang="ts">
	import { onMount } from 'svelte';
	import InformationOverlay from './InformationOverlay.svelte';
	import InteractionOverlay from './InteractionOverlay.svelte';
	import Player from './Player.svelte';
	import type { InputFromLogic, Logic, OutputFromLogic } from './types.js';

	let { data } = $props();
	let story = $derived(data.story);
	// svelte-ignore state_referenced_locally
	let players = $state(data.players);
	let pid: string | undefined = $state();

	onMount(() => {
		pid = story?.parts?.[0]?.id;
	});

	const submit = (logic: Logic, input: InputFromLogic<Logic>) => {
		const output = executeLogic(logic, input);
		if (!output?.next || typeof output.next !== 'string') return;

		const player = players.find((p) => p.id === output.next);
		if (!player) return;

		if (pid === output.next) {
			player.doRestart = true;
		} else {
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

<div class="w-full bg-black px-2 py-2">
	<div class="relative mx-auto aspect-9/16 w-full max-w-sm overflow-hidden rounded-3xl p-8">
		{#if story?.parts?.length}
			{#each story?.parts as part (part.id)}
				{@const player = players.find((player) => player.id === part.id)}

				<div class="absolute inset-0 {part.id === pid ? 'opacity-100' : 'opacity-0'}">
					{#if part?.background?.type === 'video' && player}
						<Player
							id={player.id}
							class="portrait"
							src={player.source}
							poster={player?.poster}
							start={player?.start ?? undefined}
							end={player?.end ?? undefined}
							playbackRate={player?.playbackRate ?? undefined}
							bind:doBuffer={player.doBuffer}
							bind:doPlay={player.doPlay}
							bind:doRestart={player.doRestart}
							bind:watchPercentage={player.watchPercentage}
							bufferNext={() => {
								const playerById = new Map(players.map((p) => [p.id, p]));

								const nextPlayers = [
									player.next?.length ? playerById.get(player.next) : undefined,
									...(part.foreground?.logic?.rules?.map((rule) => playerById.get(rule.next)) ?? [])
								].filter((p): p is (typeof players)[number] => p !== undefined);
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
								}
							}}
						/>
					{/if}

					{#if part.foreground?.type === 'information' && (player?.watchPercentage ?? 0) >= (part.foreground?.start ?? 0)}
						<InformationOverlay title={part.foreground.title} message={part.foreground.message} />
					{/if}
					{#if part.foreground?.type === 'quiz' && (player?.watchPercentage ?? 0) >= (part.foreground?.start ?? 0)}
						<InteractionOverlay
							interactions={part.foreground.interactions}
							logic={part.foreground.logic}
							{submit}
						/>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</div>
