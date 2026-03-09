<script lang="ts">
	import Story from '$lib/components/app/player/Story.svelte';

	let { data } = $props();
	let story = $derived(data.story);
	let orientation = $derived(data.orientation);
	// svelte-ignore state_referenced_locally
	let players = $state(data.players);
</script>

<svelte:head>
	<title>{story.name}</title>
</svelte:head>

<Story {story} {orientation} {players} class="rounded-3xl" />

<style lang="postcss">
	@reference 'tailwindcss';
	:global(body) {
		@apply bg-transparent;
	}
</style>
