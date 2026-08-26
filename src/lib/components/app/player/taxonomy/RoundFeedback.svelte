<script lang="ts">
	import type { Snippet } from 'svelte';

	let { correct, title, description, children } = $props<{
		correct: boolean;
		title?: string;
		description?: string;
		children?: Snippet;
	}>();
</script>

<div
	class:!border-game-success={correct}
	class:!border-game-danger={!correct}
	class="border-game-border bg-game-panel text-game-text overflow-hidden rounded-3xl border-2 shadow-[0_5px_0_0_var(--game-border)]"
	role="status"
	aria-live="polite"
>
	<div class="bg-game-border/40 h-1.5">
		<div
			class:!bg-game-success={correct}
			class:!bg-game-danger={!correct}
			class="feedback-progress bg-game-inverse h-full origin-left"
		></div>
	</div>
	<div class="p-5">
		<strong class="text-lg font-black"
			>{title ?? (correct ? 'Perfect order!' : 'Not quite.')}</strong
		>
		<p class="text-game-text-muted mt-1 text-sm">
			{description ??
				(correct
					? 'You placed every item from lowest value to highest value.'
					: 'Correct positions are marked. Adjust the order and try again.')}
		</p>
		{#if children}
			<div class="mt-4">{@render children()}</div>
		{/if}
	</div>
</div>

<style>
	.feedback-progress {
		animation: feedback-countdown 3000ms linear forwards;
	}

	@keyframes feedback-countdown {
		from {
			transform: scaleX(0);
		}
		to {
			transform: scaleX(1);
		}
	}
</style>
