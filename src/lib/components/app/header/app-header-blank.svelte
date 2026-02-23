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
		'pointer-events-none sticky top-0 z-20 mx-auto -mb-4 flex h-24 shrink-0 items-center gap-2 bg-linear-to-b from-background from-65% to-transparent pb-8',
		className
	)}
>
	<div class="pointer-events-auto flex w-full items-center gap-2 px-4">
		{@render children?.()}
	</div>
</header>
