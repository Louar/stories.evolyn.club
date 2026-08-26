<script lang="ts">
	import * as d3 from 'd3';
	import MapCountry from './MapCountry.svelte';
	import type { GuessResult, LoadedPlayableMap, TopoGeometry } from './map-types';

	interface Props {
		clickCountryHandler: (feature: TopoGeometry) => GuessResult;
		countryFocusedHandler: (feature?: TopoGeometry) => void;
		foundFeatures: TopoGeometry[];
		height: number;
		hintFeatures: TopoGeometry[];
		map: LoadedPlayableMap;
		unfoundFeatures: TopoGeometry[];
		width: number;
	}

	let {
		clickCountryHandler,
		countryFocusedHandler,
		foundFeatures,
		height,
		hintFeatures,
		map,
		unfoundFeatures,
		width
	}: Props = $props();
	let transform = $state(d3.zoomIdentity);
	const projectionState = $derived.by(() => {
		const boundsProjection = d3.geoNaturalEarth1().scale(1).translate([0, 0]).rotate([-11, 0]);
		const bounds = d3.geoPath().projection(boundsProjection).bounds(map.geojson);
		const mapWidth = bounds[1][0] - bounds[0][0];
		const mapHeight = bounds[1][1] - bounds[0][1];
		const scale = 0.95 / Math.max(mapWidth / width, mapHeight / height);
		const projection = d3
			.geoNaturalEarth1()
			.scale(scale)
			.translate([
				(width - scale * (bounds[1][0] + bounds[0][0])) / 2,
				(height - scale * (bounds[1][1] + bounds[0][1])) / 2
			]);
		return {
			path: d3
				.geoPath()
				.projection(projection)
				.pointRadius(0.01 * scale),
			strokeWidth: 0.002 * scale
		};
	});
	const path = $derived(projectionState.path);
	const strokeWidth = $derived(projectionState.strokeWidth);
	const mapData = $derived(
		map.geojson.features.map((feature, index) => ({ feature, geometry: map.geometries[index] }))
	);

	function zoomable(node: SVGSVGElement) {
		const d3Svg = d3.select(node);
		const zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([1, 50])
			.clickDistance(10)
			.on('zoom', (event) => {
				const next = event.transform;
				next.x = Math.min(width / 2, Math.max(next.x, width / 2 - width * next.k));
				next.y = Math.min(height / 2, Math.max(next.y, height / 2 - height * next.k));
				transform = next;
			});
		d3Svg.call(zoom).on('click.zoom', null).on('dblclick.zoom', null);
		return () => d3Svg.on('.zoom', null);
	}
</script>

<svg {@attach zoomable} {width} {height} viewBox={`0 0 ${width} ${height}`} aria-label="Item map">
	<g transform={transform.toString()}>
		{#each mapData as data (data.geometry.properties.id)}
			<MapCountry
				{data}
				{path}
				{foundFeatures}
				{hintFeatures}
				{unfoundFeatures}
				{clickCountryHandler}
				{countryFocusedHandler}
			/>
		{/each}
		{#each mapData as data (`helper-${data.geometry.properties.id}`)}
			{#if data.geometry.properties.helper}
				<MapCountry
					{data}
					{path}
					{foundFeatures}
					{hintFeatures}
					{unfoundFeatures}
					{clickCountryHandler}
					{countryFocusedHandler}
					{strokeWidth}
					helper
				/>
			{/if}
		{/each}
	</g>
</svg>
