<script lang="ts">
	import { formatDuration } from '$lib/db/schemas/0-utils';
	import { cn } from '$lib/utils';
	import CirclePause from '@lucide/svelte/icons/circle-pause';
	import CirclePlay from '@lucide/svelte/icons/circle-play';
	import CircleStart from '@lucide/svelte/icons/circle-star';
	import { Slider as SliderPrimitive, type Orientation } from 'bits-ui';
	import type { ClassValue } from 'clsx';

	type Props = {
		range: number[];
		duration: number;
		hasOverlay: boolean;
		class?: ClassValue | null | undefined;
		orientation?: Orientation;
	};
	let {
		range = $bindable(),
		duration,
		hasOverlay,
		class: className,
		orientation = 'horizontal'
	}: Props = $props();

	let step = $derived(1 / (duration * 2));

	const update = (next: number[], bounds = { min: -Infinity, max: Infinity }) => {
		// Fallback for unexpected shapes
		if (!Array.isArray(next) || next.length !== 3) {
			range = next;
			return;
		}

		let [a, b, c] = next;

		// 1) Clamp to slider bounds (optional but recommended)
		a = Math.min(Math.max(a, bounds.min), bounds.max);
		b = Math.min(Math.max(b, bounds.min), bounds.max);
		c = Math.min(Math.max(c, bounds.min), bounds.max);

		// 2) Ensure endpoints don't cross
		const min = Math.min(a, c);
		const max = Math.max(a, c);

		// 3) Ensure middle stays between endpoints
		const mid = Math.min(Math.max(b, min), max);

		range = [min, mid, max];
	};
</script>

<SliderPrimitive.Root
	{step}
	min={0}
	max={1}
	type="multiple"
	bind:value={range}
	class={cn(
		'relative mt-6 flex w-full touch-none items-center select-none data-disabled:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
		className
	)}
	autoSort={false}
	{orientation}
	data-slot="slider"
	onValueChange={update}
>
	{#snippet children()}
		<span
			data-orientation={orientation}
			data-slot="slider-track"
			class="relative grow overflow-hidden rounded-full bg-muted data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
		>
			<SliderPrimitive.Range
				class="absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
			/>
		</span>
		<SliderPrimitive.Thumb
			index={0}
			class="grid size-6 shrink-0 place-items-center rounded-full border border-primary bg-white shadow-sm ring-ring/50 transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
		>
			<CirclePlay size="16" class="rounded-full bg-muted" />
		</SliderPrimitive.Thumb>
		<SliderPrimitive.ThumbLabel
			index={0}
			class="mb-3 rounded-md border bg-muted px-2 py-1 text-xs text-nowrap text-foreground"
		>
			{formatDuration(duration, range?.[0] ?? 0)}
		</SliderPrimitive.ThumbLabel>

		<SliderPrimitive.Thumb
			index={1}
			class="{!hasOverlay
				? 'hidden'
				: ''} z-20 grid size-6 shrink-0 place-items-center rounded-full border border-primary bg-white shadow-sm ring-ring/50 transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
		>
			<CircleStart size="16" class="rounded-full bg-muted" />
		</SliderPrimitive.Thumb>
		<SliderPrimitive.ThumbLabel
			index={1}
			class="{!hasOverlay
				? 'hidden'
				: ''} z-20 mb-3 rounded-md border bg-muted px-2 py-1 text-xs text-nowrap text-foreground"
		>
			{formatDuration(duration, range?.[1] ?? 0)}
		</SliderPrimitive.ThumbLabel>

		<SliderPrimitive.Thumb
			index={2}
			class="grid size-6 shrink-0 place-items-center rounded-full border border-primary bg-white shadow-sm ring-ring/50 transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
		>
			<CirclePause size="16" class="rounded-full bg-muted" />
		</SliderPrimitive.Thumb>
		<SliderPrimitive.ThumbLabel
			index={2}
			class="mb-3 rounded-md border bg-muted px-2 py-1 text-xs text-nowrap text-foreground"
		>
			{formatDuration(duration, range?.[2] ?? 0)}
		</SliderPrimitive.ThumbLabel>
	{/snippet}
</SliderPrimitive.Root>
