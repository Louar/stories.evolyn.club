<script lang="ts">
	import favicon from '$lib/assets/evolyn-logo.svg';
	import { ModeWatcher } from 'mode-watcher';

	import { Toaster } from 'svelte-sonner';
	import './layout.css';

	let { data, children } = $props();
	const { client } = $derived(data);
</script>

<svelte:head>
	<title>{client.name}</title>

	{#if !client.isFindableBySearchEngines}
		<meta name="robots" content="noindex, nofollow" />
	{/if}

	{#if client.favicon?.collection?.length && client.favicon?.filename?.length}
		<link rel="icon" href="/api/media/{client.favicon.collection}/{client.favicon.filename}" />
		<link
			rel="apple-touch-icon"
			sizes="180x180"
			href="/api/media/{client.favicon.collection}/{client.favicon.filename}"
		/>
	{:else}
		<link rel="icon" href={favicon} />
		<link rel="apple-touch-icon" sizes="180x180" href={favicon} />
	{/if}

	{#if client.plausibleDomain?.length && import.meta.env.MODE === 'production'}
		<script defer data-domain={client.plausibleDomain} src="/js/script.outbound-links.js"></script>
	{/if}

	<link rel="stylesheet" type="text/css" href="/variables.css" />
	<link rel="stylesheet" type="text/css" href="/api/styles.css" />

	<link rel="manifest" href="/api/manifest.json" />

	<meta
		name="theme-color"
		media="(prefers-color-scheme: light)"
		content={client?.css?.[':root']?.['--background'] || '#ffffff'}
	/>
	<meta
		name="theme-color"
		media="(prefers-color-scheme: dark)"
		content={client?.css?.['.dark']?.['--background'] || '#09090b'}
	/>
</svelte:head>

<ModeWatcher />
<Toaster />
{@render children?.()}
