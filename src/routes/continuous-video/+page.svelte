<script lang="ts">
	import { onMount } from 'svelte';
	import Player from './Player.svelte';

	let { data } = $props();
	let story = $derived(data.story);
	// svelte-ignore state_referenced_locally
	let players = $state(data.players);
	let pid: string | undefined = $state();
	let activepart: (typeof data.story.parts)[number] | undefined = $state();
	let activeplayer: (typeof players)[number] | undefined = $state();

	onMount(() => {
		pid = story?.parts?.[0]?.id;
		activepart = story.parts?.find((part) => part.id === pid);
		activeplayer = players?.find((player) => player.id === pid);
	});
</script>

<div class="relative mx-auto aspect-video w-full max-w-2xl p-8">
	{#if story?.parts?.length}
		{#each story?.parts as part (part.id)}
			{@const player = players.find((player) => player.id === part.id)}

			<div class="absolute inset-0 {part.id === pid ? 'opacity-100' : 'opacity-0'}">
				{#if part?.background?.type === 'video' && player}
					<Player
						id={player.id}
						src={player.source}
						poster={player?.poster}
						start={player?.start}
						end={player?.end}
						bind:doBuffer={player.doBuffer}
						bind:doPlay={player.doPlay}
						bind:watchPercentage={player.watchPercentage}
						bufferNext={() => {
							const nextPlayer = players.find((p) => p.id === player.next);
							if (nextPlayer) nextPlayer.doBuffer = true;
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

				<!-- {#if activepart?.foreground && activeplayer?.watchPercentage >= activepart.foreground.start}
				<div
					transition:fade
					class="absolute inset-0 top-0 z-50 grid gap-4 rounded-2xl bg-black/50 p-8 backdrop-blur-sm"
				>
					<div
						transition:fly={{ y: 50, duration: 250, delay: 150 }}
						class="flex h-20 w-full rounded-lg bg-black"
					></div>
					<div
						transition:fly={{ y: 50, duration: 250, delay: 300 }}
						class="flex h-20 w-full rounded-lg bg-black"
					></div>
				</div>
			{/if} -->
			</div>
		{/each}
	{/if}
</div>
