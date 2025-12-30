<script lang="ts">
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import Flow from './Flow.svelte';
</script>

<div class="mx-auto h-screen w-screen overflow-hidden">
	<SvelteFlowProvider>
		<Flow />
	</SvelteFlowProvider>
</div>
