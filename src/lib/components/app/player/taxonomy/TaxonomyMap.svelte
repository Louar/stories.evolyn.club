<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import * as d3 from 'd3';
	import MapArtwork from './MapArtwork.svelte';
	import MapRegion from './MapRegion.svelte';
	import type { GuessResult, LoadedPlayableMap, PlayableMapRegion } from './playable-map.types';

	interface Props {
		foundRegions: PlayableMapRegion[];
		getRegionAriaLabel?: (itemId: string, index: number) => string;
		height: number;
		hintRegions: PlayableMapRegion[];
		map: LoadedPlayableMap;
		onRegionFocus: (region?: PlayableMapRegion) => void;
		onRegionGuess: (region: PlayableMapRegion) => GuessResult;
		unfoundRegions: PlayableMapRegion[];
		width: number;
	}

	let {
		foundRegions,
		getRegionAriaLabel,
		height,
		hintRegions,
		map,
		onRegionFocus,
		onRegionGuess,
		unfoundRegions,
		width
	}: Props = $props();
	let transform = $state(d3.zoomIdentity);
	const foundIds = $derived(new Set(foundRegions.map((region) => region.properties.id)));
	const hintedIds = $derived(new Set(hintRegions.map((region) => region.properties.id)));
	const unfoundIds = $derived(new Set(unfoundRegions.map((region) => region.properties.id)));
	const projectionState = $derived.by(() => {
		if (map.projection === 'identity' && map.viewBox) {
			const [minX, minY, sceneWidth, sceneHeight] = map.viewBox;
			const scale = 0.95 * Math.min(width / sceneWidth, height / sceneHeight);
			const x = (width - sceneWidth * scale) / 2 - minX * scale;
			const y = (height - sceneHeight * scale) / 2 - minY * scale;
			const projection = d3.geoIdentity().scale(scale).translate([x, y]);
			return {
				artworkTransform: `translate(${x} ${y}) scale(${scale})`,
				path: d3.geoPath().projection(projection),
				helperPath: d3
					.geoPath()
					.projection(projection)
					.pointRadius(map.minTargetDiameter / 2),
				strokeWidth: 1.5
			};
		}
		const boundsProjection = d3.geoNaturalEarth1().rotate([-11, 0]).scale(1).translate([0, 0]);
		const bounds = d3.geoPath().projection(boundsProjection).bounds(map.geojson);
		const mapWidth = bounds[1][0] - bounds[0][0];
		const mapHeight = bounds[1][1] - bounds[0][1];
		const scale = 0.95 / Math.max(mapWidth / width, mapHeight / height);
		const projection = d3
			.geoNaturalEarth1()
			.rotate([-11, 0])
			.scale(scale)
			.translate([
				(width - scale * (bounds[1][0] + bounds[0][0])) / 2,
				(height - scale * (bounds[1][1] + bounds[0][1])) / 2
			]);
		return {
			artworkTransform: '',
			path: d3.geoPath().projection(projection),
			helperPath: d3
				.geoPath()
				.projection(projection)
				.pointRadius(map.minTargetDiameter / 2),
			strokeWidth: 1.5
		};
	});
	const mapData = $derived(
		map.regions.map((region, index) => {
			const bounds = projectionState.path.bounds(region.feature);
			return {
				ariaLabel:
					getRegionAriaLabel?.(region.properties.id, index) ??
					m.taxonomy_map_region({ index: index + 1 }),
				baseHeight: bounds[1][1] - bounds[0][1],
				baseWidth: bounds[1][0] - bounds[0][0],
				labelPosition: projectionState.path(region.properties.center)
					? projectionState.path.centroid(region.properties.center)
					: projectionState.path.centroid(region.feature),
				region
			};
		})
	);
	const labelWidth = $derived(
		map.projection === 'identity'
			? Math.max(56, Math.min(180, width * 0.2))
			: Math.max(100, Math.min(220, Math.min(width, height) * 0.26))
	);
	const labelHeight = $derived(labelWidth * 0.62);
	const labelFontSize = $derived(Math.max(11, Math.min(18, Math.min(width, height) * 0.02)));
	const iconFontSize = $derived(labelFontSize * 1.75);
	const sceneStyle = $derived(
		[
			map.defaults?.labelColor
				? `--map-label-color: ${toCssValue(map.defaults.labelColor)}; --map-label-shadow: none`
				: null,
			map.defaults?.fill ? `--map-scene-fill: ${toCssValue(map.defaults.fill)}` : null,
			map.defaults?.stroke ? `--map-scene-stroke: ${toCssValue(map.defaults.stroke)}` : null,
			map.defaults?.strokeWidth !== undefined
				? `--map-scene-stroke-width: ${map.defaults.strokeWidth}`
				: null,
			map.defaults?.fillOpacity !== undefined
				? `--map-scene-fill-opacity: ${map.defaults.fillOpacity}`
				: null,
			map.defaults?.feedbackOpacity !== undefined
				? `--map-feedback-opacity: ${map.defaults.feedbackOpacity}`
				: null
		]
			.filter(Boolean)
			.join('; ') || undefined
	);

	function toCssValue(value: string) {
		return value.startsWith('--') ? `var(${value})` : value;
	}

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

<svg
	{@attach zoomable}
	{width}
	{height}
	viewBox={`0 0 ${width} ${height}`}
	aria-label={m.taxonomy_item_map()}
	style={sceneStyle}
>
	<g transform={transform.toString()}>
		<g transform={projectionState.artworkTransform}>
			<MapArtwork artwork={map.artwork} layer="underlay" viewBox={map.viewBox} />
		</g>
		{#each mapData as data (data.region.properties.id)}
			<MapRegion
				region={data.region}
				path={projectionState.path}
				found={foundIds.has(data.region.properties.id)}
				hinted={hintedIds.has(data.region.properties.id)}
				disabled={!unfoundIds.has(data.region.properties.id)}
				ariaLabel={data.ariaLabel}
				{onRegionGuess}
				{onRegionFocus}
			/>
		{/each}
		<g transform={projectionState.artworkTransform}>
			<MapArtwork artwork={map.artwork} layer="overlay" viewBox={map.viewBox} />
		</g>
		{#each mapData as data (`helper-${data.region.properties.id}`)}
			{#if Math.min(data.baseWidth, data.baseHeight) * transform.k < map.minTargetDiameter}
				<MapRegion
					region={data.region}
					path={projectionState.helperPath}
					found={foundIds.has(data.region.properties.id)}
					hinted={hintedIds.has(data.region.properties.id)}
					disabled={!unfoundIds.has(data.region.properties.id)}
					ariaLabel={data.ariaLabel}
					{onRegionGuess}
					{onRegionFocus}
					strokeWidth={projectionState.strokeWidth}
					helper
				/>
			{/if}
		{/each}
		{#if map.showLabels}
			{#each mapData as data (`label-${data.region.properties.id}`)}
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
						{#if data.region.properties.icons.length}
							<div class="map-label-icons">{data.region.properties.icons.join(' ')}</div>
						{/if}
						<div class="map-label-name">{data.region.properties.name}</div>
					</div>
				</foreignObject>
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
		color: var(--map-label-color, white);
		font-family: var(--font-sans);
		font-size: var(--map-label-font-size);
		font-weight: 800;
		line-height: 1.05;
		text-align: center;
		text-wrap: balance;
		text-shadow: var(--map-label-shadow, 0 1px 3px rgb(0 0 0 / 55%));
	}
	.map-label-icons {
		font-size: var(--map-icon-font-size);
		line-height: 1;
		text-shadow: 0 2px 4px rgb(0 0 0 / 25%);
		white-space: nowrap;
	}
</style>
