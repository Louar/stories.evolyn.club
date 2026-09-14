<script lang="ts">
	import { AnthologyVisualization } from '$lib/db/schemas/2-story-module';
	import AnthologyFeed from './AnthologyFeed.svelte';
	import AnthologyGrid from './AnthologyGrid.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

{#if data.anthology.visualization === AnthologyVisualization.feed}
	<AnthologyFeed {data} />
{:else}
	<AnthologyGrid {data} />
{/if}
