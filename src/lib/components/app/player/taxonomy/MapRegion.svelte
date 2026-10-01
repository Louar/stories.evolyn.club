<script lang="ts">
	import type { GeoPath } from 'd3-geo';
	import type { GuessResult, PlayableMapRegion } from './playable-map.types';

	interface Props {
		ariaLabel: string;
		disabled: boolean;
		found: boolean;
		helper?: boolean;
		hinted: boolean;
		onRegionFocus: (region?: PlayableMapRegion) => void;
		onRegionGuess: (region: PlayableMapRegion) => GuessResult;
		path: GeoPath;
		region: PlayableMapRegion;
		strokeWidth?: number;
	}

	let {
		ariaLabel,
		disabled,
		found,
		helper = false,
		hinted,
		onRegionFocus,
		onRegionGuess,
		path,
		region,
		strokeWidth
	}: Props = $props();

	const color = $derived(toCssColor(region.properties.color));
	const style = $derived(
		[
			color ? `--map-item-fill: ${color}` : null,
			strokeWidth === undefined ? null : `--map-helper-stroke-width: ${strokeWidth}px`
		]
			.filter(Boolean)
			.join('; ') || undefined
	);
	const d = $derived(path(helper ? region.properties.center : region.feature) ?? '');

	function toCssColor(value: string | null) {
		if (!value) return null;
		return value.startsWith('--') ? `var(${value})` : value;
	}

	function activate(event: MouseEvent | KeyboardEvent) {
		if (disabled) return;
		event.stopPropagation();
		onRegionGuess(region);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		activate(event);
	}
</script>

<path
	role="button"
	tabindex={disabled ? -1 : 0}
	aria-label={ariaLabel}
	aria-disabled={disabled}
	class={{ found, hinted, disabled, helper }}
	data-map-item-id={region.properties.id}
	{d}
	{style}
	onmouseover={() => onRegionFocus(region)}
	onmouseleave={() => onRegionFocus()}
	onfocus={() => onRegionFocus(region)}
	onblur={() => onRegionFocus()}
	onclick={activate}
	onkeydown={handleKeydown}
/>

<style>
	path {
		cursor: pointer;
		fill: var(--map-item-fill, var(--map-scene-fill, var(--game-region-blue)));
		fill-opacity: var(--map-scene-fill-opacity, 1);
		outline: none;
		stroke: var(--map-scene-stroke, var(--map-region-stroke));
		stroke-width: var(--map-scene-stroke-width, 0.45);
		transition:
			fill 120ms ease,
			filter 120ms ease,
			opacity 120ms ease;
	}
	path:not(.disabled):hover,
	path:not(.disabled):focus-visible {
		fill: var(--map-region-hover);
	}
	path:not(.disabled):focus-visible {
		stroke: var(--game-warning);
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}
	.found {
		fill: var(--map-found-fill);
		opacity: var(--map-feedback-opacity, 1);
	}
	.hinted {
		fill: var(--map-hint-fill);
	}
	.disabled {
		cursor: default;
		opacity: 0.65;
	}
	.helper {
		/* fill: var(--map-helper-fill); */
		fill: transparent;
		stroke: var(--map-region-stroke);
		stroke-width: var(--map-helper-stroke-width, 1.5);
	}
</style>
