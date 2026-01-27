<script lang="ts">
	import HeaderBlank from '$lib/components/nav/app-header-blank.svelte';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import type { Snippet } from 'svelte';

	type Props = {
		children?: Snippet<[]>;
		class?: string;
	};
	let { children, class: className }: Props = $props();
</script>

<HeaderBlank class={className}>
	<Sidebar.Trigger class="-ml-1" />
	<Separator orientation="vertical" class="mr-2 data-[orientation=vertical]:h-4" />

	{@render children?.()}
</HeaderBlank>
