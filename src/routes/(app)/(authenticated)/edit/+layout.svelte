<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import LayoutSidebar from './Sidebar.svelte';

	let { children, data } = $props();
</script>

<Sidebar.Provider>
	<LayoutSidebar {data} />

	<Sidebar.Inset>
		<div class="w-full">
			{@render children?.()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
