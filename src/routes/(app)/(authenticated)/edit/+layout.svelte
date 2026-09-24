<script lang="ts">
	import { afterNavigate, invalidateAll } from '$app/navigation';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import LayoutSidebar from './Sidebar.svelte';

	let { children, data } = $props();

	afterNavigate((navigation) => {
		if (navigation.type === 'popstate') void invalidateAll();
	});

	function handlePageShow(event: PageTransitionEvent) {
		if (event.persisted) void invalidateAll();
	}
</script>

<svelte:window onpageshow={handlePageShow} />

<Sidebar.Provider>
	<LayoutSidebar {data} />

	<Sidebar.Inset>
		<div class="w-full **:data-[slot=grid-wrapper]:pb-10">
			{@render children?.()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
