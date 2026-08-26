<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	let {
		embedded = false,
		class: className,
		children
	}: { embedded?: boolean; class?: string; children: Snippet } = $props();
</script>

{#if embedded}
	<div class={cn('h-full min-h-0 overflow-y-auto', className)}>
		{@render children()}
	</div>
{:else}
	<Dialog.Content class={className} showCloseButton={false}>
		{@render children()}
	</Dialog.Content>
{/if}
