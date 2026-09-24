<script lang="ts">
	import * as m from '$lib/paraglide/messages';
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
		const createProjection = () =>
			map.projection === 'identity'
				? d3.geoIdentity().reflectY(true)
				: d3.geoNaturalEarth1().rotate([-11, 0]);
		const boundsProjection = createProjection().scale(1).translate([0, 0]);
		const bounds = d3.geoPath().projection(boundsProjection).bounds(map.geojson);
		const mapWidth = bounds[1][0] - bounds[0][0];
		const mapHeight = bounds[1][1] - bounds[0][1];
		const scale = 0.95 / Math.max(mapWidth / width, mapHeight / height);
		const projection = createProjection()
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
			project: (point: [number, number]) => projection(point),
			strokeWidth: 0.002 * scale
		};
	});
	const path = $derived(projectionState.path);
	const strokeWidth = $derived(projectionState.strokeWidth);
	const labelWidth = $derived(Math.max(100, Math.min(220, Math.min(width, height) * 0.26)));
	const labelHeight = $derived(labelWidth * 0.62);
	const labelFontSize = $derived(Math.max(11, Math.min(18, Math.min(width, height) * 0.02)));
	const iconFontSize = $derived(labelFontSize * 1.75);
	const mapData = $derived(
		map.geojson.features.map((feature, index) => {
			const geometry = map.geometries[index];
			const coordinates = geometry.properties.center?.geometry.coordinates;
			return {
				feature,
				geometry,
				labelPosition: coordinates
					? projectionState.project([coordinates[0], coordinates[1]])
					: projectionState.path.centroid(feature)
			};
		})
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

<svg {@attach zoomable} {width} {height} viewBox={`0 0 ${width} ${height}`} aria-label={m.taxonomy_item_map()}>
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
		{#if map.showLabels}
			{#each mapData as data (`label-${data.geometry.properties.id}`)}
				{#if data.geometry.properties.icons.length > 0 && data.labelPosition}
					<foreignObject
						x={data.labelPosition[0] - labelWidth / 2}
						y={data.labelPosition[1] - labelHeight / 2}
						width={labelWidth}
						height={labelHeight}
						aria-hidden="true"
					>
						<div
							class="map-label"
							style:--map-label-font-size={`${labelFontSize}px`}
							style:--map-icon-font-size={`${iconFontSize}px`}
						>
							<div class="map-label-icons">{data.geometry.properties.icons.join(' ')}</div>
							<div class="map-label-name">{data.geometry.properties.name}</div>
						</div>
					</foreignObject>
				{/if}
			{/each}
		{/if}
	</g>
</svg>

<style>
	foreignObject {
		pointer-events: none;
		overflow: visible;
	}

	.map-label {
		display: flex;
		height: 100%;
		align-items: center;
		justify-content: center;
		flex-direction: column;
		gap: 0.2rem;
		color: white;
		font-family: var(--font-sans);
		font-size: var(--map-label-font-size);
		font-weight: 800;
		line-height: 1.05;
		text-align: center;
		text-wrap: balance;
		text-shadow: 0 1px 3px rgb(0 0 0 / 55%);
	}

	.map-label-icons {
		font-size: var(--map-icon-font-size);
		line-height: 1;
		text-shadow: 0 2px 4px rgb(0 0 0 / 25%);
		white-space: nowrap;
	}
</style>
