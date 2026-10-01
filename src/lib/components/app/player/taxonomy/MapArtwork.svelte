<script lang="ts">
	import { mediaUrl } from './map-asset';
	import type { MapArtwork, MediaReference } from './playable-map.types';

	let {
		artwork,
		layer,
		viewBox
	}: {
		artwork?: MapArtwork;
		layer: 'underlay' | 'overlay';
		viewBox?: [number, number, number, number];
	} = $props();

	const media = $derived(artwork?.[layer]);

	function href(reference: MediaReference) {
		return mediaUrl(reference);
	}
</script>

{#if media && viewBox}
	<image
		href={href(media)}
		x={viewBox[0]}
		y={viewBox[1]}
		width={viewBox[2]}
		height={viewBox[3]}
		preserveAspectRatio="none"
		aria-hidden="true"
	/>
{/if}

<style>
	image {
		pointer-events: none;
	}
</style>
