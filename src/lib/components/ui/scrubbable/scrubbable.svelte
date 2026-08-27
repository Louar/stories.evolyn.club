<script lang="ts">
	import { cn } from '$lib/utils';
	import { setScrubbableContext } from './ctx';
	import type { Snippet } from 'svelte';
	import { cva, type VariantProps } from 'class-variance-authority';

	const scrubbableVariants = cva(
		'group relative inline-flex items-center justify-between cursor-ew-resize select-none touch-none rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
		{
			variants: {
				variant: {
					default: 'bg-muted text-foreground hover:bg-muted/80',
					primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
					outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
					secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
					ghost: 'hover:bg-accent hover:text-accent-foreground'
				},
				size: {
					default: 'h-9',
					sm: 'h-8 px-2 text-xs',
					lg: 'h-10 px-4',
					icon: 'h-9 w-9 justify-center px-0'
				}
			},
			defaultVariants: {
				variant: 'default',
				size: 'default'
			}
		}
	);

	type Props = VariantProps<typeof scrubbableVariants> & {
		value: number;
		min?: number;
		max?: number;
		step?: number;
		keyboardStep?: number;
		sensitivity?: number;
		snapValues?: number[];
		snapThreshold?: number;
		defaultValue?: number;
		class?: string;
		onValueChange?: (v: number) => void;
		children: Snippet;
	};

	let {
		value = $bindable(0),
		min = -Infinity,
		max = Infinity,
		step = 1,
		keyboardStep = step / 10,
		sensitivity = 2,
		snapValues = [],
		snapThreshold = step,
		defaultValue,
		variant,
		size,
		class: className,
		onValueChange,
		children
	}: Props = $props();

	let isDragging = $state(false);
	let startX = 0;
	let startValue = 0;

	function clamp(v: number) {
		return Math.max(min, Math.min(max, v));
	}

	function snap(v: number) {
		let next = v;
		let closestDistance = snapThreshold;

		for (const snapValue of snapValues) {
			const clampedSnapValue = clamp(snapValue);
			const distance = Math.abs(v - clampedSnapValue);
			if (distance <= closestDistance) {
				closestDistance = distance;
				next = clampedSnapValue;
			}
		}

		return next;
	}

	function setValue(next: number, options: { precision?: boolean; snap?: boolean } = {}) {
		let newValue = clamp(options.snap ? snap(next) : next);

		if (!options.precision) {
			newValue = Math.round(newValue / step) * step;
		}

		const decimals = step.toString().split('.')[1]?.length || 0;
		newValue = parseFloat(newValue.toFixed(options.precision ? decimals + 1 : decimals));

		value = newValue;
		onValueChange?.(newValue);
	}

	function handleMouseDown(e: MouseEvent) {
		if (e.button !== 0) return;

		isDragging = true;
		startX = e.clientX;
		startValue = value;

		document.body.style.cursor = 'ew-resize';
		document.body.style.userSelect = 'none';

		window.addEventListener('mousemove', handleMove);
		window.addEventListener('mouseup', handleUp);
	}

	function handleMove(e: MouseEvent) {
		if (!isDragging) return;

		const deltaX = e.clientX - startX;
		const isPrecision = e.shiftKey;

		const dragScale = isPrecision ? 0.1 : 1;
		const change = (deltaX / sensitivity) * step * dragScale;

		setValue(startValue + change, { precision: isPrecision, snap: !isPrecision });
	}

	function handleUp() {
		isDragging = false;
		document.body.style.cursor = '';
		document.body.style.userSelect = '';

		window.removeEventListener('mousemove', handleMove);
		window.removeEventListener('mouseup', handleUp);
	}

	function handleDoubleClick() {
		let resetVal = defaultValue;

		if (resetVal === undefined) {
			if (min > -Infinity) resetVal = min;
			else resetVal = 0;
		}

		setValue(resetVal);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

		e.preventDefault();
		const direction = e.key === 'ArrowRight' ? 1 : -1;
		setValue(value + direction * keyboardStep, { precision: true });
	}

	setScrubbableContext({
		value: () => value,
		isDragging: () => isDragging
	});
</script>

<div
	role="slider"
	aria-valuenow={value}
	aria-valuemin={min}
	aria-valuemax={max}
	tabindex="0"
	onmousedown={handleMouseDown}
	ondblclick={handleDoubleClick}
	onkeydown={handleKeyDown}
	class={cn(scrubbableVariants({ variant, size, className }))}
>
	{@render children()}
</div>
