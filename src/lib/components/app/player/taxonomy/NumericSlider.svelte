<script lang="ts">
	import { formatSliderValue, type NumericSliderSettings } from './numeric-slider';
	import { getLocale } from '$lib/paraglide/runtime';

	let {
		value = $bindable(),
		settings,
		label,
		disabled = false,
		onchange
	}: {
		value: number;
		settings: NumericSliderSettings;
		label: string;
		disabled?: boolean;
		onchange: () => void;
	} = $props();

	const percentage = $derived(((value - settings.min) / (settings.max - settings.min)) * 100);
</script>

<section
	class="absolute inset-0 z-1 grid place-items-center overflow-y-auto px-4 pt-40 pb-8"
	aria-label={label}
>
	<div
		class="w-full max-w-2xl rounded-xl border border-game-border bg-game-panel/95 p-5 shadow-panel backdrop-blur sm:p-8"
	>
		<div
			class="mb-7 text-center font-serif text-[clamp(2.5rem,9vw,5.5rem)] leading-none font-black tabular-nums"
		>
			{formatSliderValue(value, settings.precision, getLocale())}
		</div>
		<input
			type="range"
			aria-label={label}
			class="numeric-slider w-full cursor-grab active:cursor-grabbing disabled:cursor-default"
			style={`--slider-fill: ${percentage}%`}
			min={settings.min}
			max={settings.max}
			step={settings.step}
			bind:value
			{disabled}
			oninput={onchange}
		/>
		<div class="mt-3 flex justify-between text-sm font-bold text-game-text-muted tabular-nums">
			<span>{formatSliderValue(settings.min, settings.precision, getLocale())}</span>
			<span>{formatSliderValue(settings.max, settings.precision, getLocale())}</span>
		</div>
	</div>
</section>

<style>
	.numeric-slider {
		height: 2.75rem;
		appearance: none;
		background: transparent;
	}

	.numeric-slider::-webkit-slider-runnable-track {
		height: 0.75rem;
		border-radius: 9999px;
		background: linear-gradient(
			to right,
			var(--color-game-region-blue) var(--slider-fill),
			var(--color-game-border) var(--slider-fill)
		);
	}

	.numeric-slider::-moz-range-track {
		height: 0.75rem;
		border-radius: 9999px;
		background: var(--color-game-border);
	}

	.numeric-slider::-moz-range-progress {
		height: 0.75rem;
		border-radius: 9999px;
		background: var(--color-game-region-blue);
	}

	.numeric-slider::-webkit-slider-thumb {
		width: 2.75rem;
		height: 2.75rem;
		margin-top: -1rem;
		appearance: none;
		border: 0.35rem solid var(--color-game-panel);
		border-radius: 9999px;
		background: var(--color-game-region-blue);
		box-shadow:
			0 0 0 2px var(--color-game-text),
			0 0.5rem 1rem rgb(0 0 0 / 0.2);
	}

	.numeric-slider::-moz-range-thumb {
		width: 2.1rem;
		height: 2.1rem;
		border: 0.35rem solid var(--color-game-panel);
		border-radius: 9999px;
		background: var(--color-game-region-blue);
		box-shadow:
			0 0 0 2px var(--color-game-text),
			0 0.5rem 1rem rgb(0 0 0 / 0.2);
	}

	.numeric-slider:focus-visible {
		border-radius: 9999px;
		outline: 0.25rem solid var(--color-game-text);
		outline-offset: 0.35rem;
	}
</style>
