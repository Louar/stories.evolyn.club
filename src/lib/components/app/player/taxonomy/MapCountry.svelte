<script lang="ts">
	import type { GeoPath } from 'd3-geo';
	import type { GuessResult, ItemFeature, TopoGeometry } from './map-types';

	interface Props {
		clickCountryHandler: (feature: TopoGeometry) => GuessResult;
		countryFocusedHandler: (feature?: TopoGeometry) => void;
		data: { feature: ItemFeature; geometry: TopoGeometry };
		foundFeatures: TopoGeometry[];
		helper?: boolean;
		hintFeatures: TopoGeometry[];
		path: GeoPath;
		strokeWidth?: number;
		unfoundFeatures: TopoGeometry[];
	}

	let {
		clickCountryHandler,
		countryFocusedHandler,
		data,
		foundFeatures,
		helper = false,
		hintFeatures,
		path,
		strokeWidth,
		unfoundFeatures
	}: Props = $props();

	const itemId = $derived(data.geometry.properties.id);
	const found = $derived(foundFeatures.some((feature) => feature.properties.id === itemId));
	const hinted = $derived(hintFeatures.some((feature) => feature.properties.id === itemId));
	const disabled = $derived(!unfoundFeatures.some((feature) => feature.properties.id === itemId));
	const color = $derived(toCssColor(data.geometry.properties.color));
	const style = $derived(
		[
			color ? `--map-item-fill: ${color}` : null,
			strokeWidth === undefined ? null : `stroke-width: ${strokeWidth}px`
		]
			.filter(Boolean)
			.join('; ') || undefined
	);
	const d = $derived(path(helper ? data.geometry.properties.center! : data.feature) ?? '');

	function toCssColor(colorValue: string | null) {
		if (!colorValue) return null;
		return colorValue.startsWith('--') ? `var(${colorValue})` : colorValue;
	}

	function handleClick(event: MouseEvent) {
		event.stopPropagation();
		clickCountryHandler(data.geometry);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		clickCountryHandler(data.geometry);
	}
</script>

<path
	role="button"
	tabindex={disabled ? -1 : 0}
	aria-label={data.geometry.properties.name}
	aria-disabled={disabled}
	class:found
	class:hinted
	class:disabled
	class:helper
	data-map-item-id={data.geometry.properties.id}
	{d}
	{style}
	onmouseover={() => countryFocusedHandler(data.geometry)}
	onmouseleave={() => countryFocusedHandler()}
	onfocus={() => countryFocusedHandler(data.geometry)}
	onblur={() => countryFocusedHandler()}
	onclick={handleClick}
	onkeydown={handleKeydown}
/>

<style>
	path {
		cursor: pointer;
		fill: var(--map-item-fill, var(--game-region-blue));
		stroke: var(--map-region-stroke);
		stroke-width: 0.45;
		transition:
			fill 120ms ease,
			filter 120ms ease,
			opacity 120ms ease;
	}
	path:not(.disabled):hover,
	path:not(.disabled):focus-visible {
		fill: var(--map-region-hover);
	}
	.found {
		fill: var(--map-found-fill);
	}
	.hinted {
		fill: var(--map-hint-fill);
	}
	.disabled {
		cursor: default;
		opacity: 0.65;
	}
	.helper {
		fill: var(--map-helper-fill);
		stroke: var(--map-region-stroke);
		stroke-width: 1.5;
	}
</style>
