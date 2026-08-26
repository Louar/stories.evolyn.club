<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	type Props = {
		children?: Snippet<[]>;
		class?: string;
	};
	let { children, class: className }: Props = $props();
</script>

<header
	class={cn(
		'pointer-events-none sticky top-0 z-20 mx-auto flex h-16 shrink-0 items-center gap-2 border-b',
		className
	)}
>
	<div class="backdrop"></div>
	<div class="pointer-events-auto z-20 flex w-full items-center gap-2 px-4">
		{@render children?.()}
	</div>
</header>

<style lang="postcss">
	.backdrop {
		position: absolute;
		inset: 0;
		height: 200%;
		z-index: 19;
		background: linear-gradient(to bottom, var(--color-background), transparent 50%);
		backdrop-filter: blur(16px);
		mask-image: linear-gradient(to bottom, var(--color-background) 0% 50%, transparent 50% 100%);
		pointer-events: none;
	}
</style>
