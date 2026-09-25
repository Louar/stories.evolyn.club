<script module lang="ts">
	import {
		webMotionConfigSchema,
		type WebMotionConfig,
		type ParsedWebMotionConfig,
		type ParsedLayer,
		type ParsedTrack,
		type EasingName
	} from '$lib/media/animation';
</script>

<script lang="ts">
	import {
		CanvasRenderer,
		Composition,
		Easing,
		Layer,
		PlaybackController,
		Runtime,
		Sequence,
		type Canvas2DContext,
		type CanvasRenderContext,
		type EasingFunction,
		type WebMotionComponent
	} from '@superhq/webmotion';
	import type { WPlayer } from '@superhq/webmotion/elements';
	import type { Attachment } from 'svelte/attachments';
	import { SvelteMap } from 'svelte/reactivity';

	type Props = {
		config: WebMotionConfig;
		label?: string;
		class?: string;
		controls?: boolean;
		/** Contain fills a bounded parent; responsive uses the viewbox's intrinsic ratio. */
		fit?: 'responsive' | 'contain';
		onready?: (controller: PlaybackController) => void;
		onerror?: (error: unknown) => void;
	};

	type JsonRecord = Record<string, unknown>;
	type PathPart = string | number;
	type Color = [red: number, green: number, blue: number, alpha: number];
	type Interpolator = (progress: number) => unknown;

	type CompiledTrack = {
		path: PathPart[];
		sample: (frame: number) => unknown;
	};

	type CompiledLayer = {
		definition: ParsedLayer;
		durationInFrames: number;
		baseProps: JsonRecord;
		tracks: CompiledTrack[];
	};

	type TrackDefaults = {
		duration?: number;
		delay: number;
		easing: EasingName;
	};

	type NormalizedTrack = {
		values: unknown[];
		at?: number[];
		frames?: number[];
		duration?: number;
		delay: number;
		easing?: EasingName;
		relative: boolean;
	};

	const easings: Record<EasingName, EasingFunction> = {
		linear: Easing.linear,
		easeInQuad: Easing.easeInQuad,
		easeOutQuad: Easing.easeOutQuad,
		easeInOutQuad: Easing.easeInOutQuad,
		easeInCubic: Easing.easeInCubic,
		easeOutCubic: Easing.easeOutCubic,
		easeInOutCubic: Easing.easeInOutCubic,
		easeInSine: Easing.easeInSine,
		easeOutSine: Easing.easeOutSine,
		easeInOutSine: Easing.easeInOutSine
	};

	let {
		config,
		label = 'Animation player',
		class: className,
		controls = false,
		fit = 'responsive',
		onready,
		onerror
	}: Props = $props();
	let controller: PlaybackController | undefined;
	let loadError = $state<string>();

	const numericValue = (props: JsonRecord, property: string, fallback = 0) => {
		const value = props[property];
		return typeof value === 'number' ? value : fallback;
	};

	const paintPath = (ctx: Canvas2DContext, props: JsonRecord) => {
		if (typeof props.fill === 'string') {
			ctx.fillStyle = props.fill;
			ctx.fill();
		}
		if (typeof props.stroke === 'string' && numericValue(props, 'lineWidth', 1) > 0) {
			ctx.strokeStyle = props.stroke;
			ctx.lineWidth = numericValue(props, 'lineWidth', 1);
			ctx.stroke();
		}
	};

	const parseColor = (value: unknown): Color | undefined => {
		if (typeof value !== 'string') return;
		const color = value.trim();

		if (color.startsWith('#')) {
			const hex = color.slice(1);
			if (![3, 4, 6, 8].includes(hex.length) || !/^[\da-f]+$/i.test(hex)) return;
			const expanded = hex.length <= 4 ? [...hex].map((part) => part + part).join('') : hex;
			return [
				Number.parseInt(expanded.slice(0, 2), 16),
				Number.parseInt(expanded.slice(2, 4), 16),
				Number.parseInt(expanded.slice(4, 6), 16),
				expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1
			];
		}

		const match = color.match(/^rgba?\(([^)]+)\)$/i);
		if (!match) return;
		const parts = match[1].split(',').map((part) => part.trim());
		if (parts.length !== 3 && parts.length !== 4) return;

		const channels = parts
			.slice(0, 3)
			.map((part) =>
				part.endsWith('%') ? (Number.parseFloat(part) / 100) * 255 : Number.parseFloat(part)
			);
		const alpha = parts[3]?.endsWith('%')
			? Number.parseFloat(parts[3]) / 100
			: Number.parseFloat(parts[3] ?? '1');

		if ([...channels, alpha].some((part) => !Number.isFinite(part))) return;
		return [channels[0], channels[1], channels[2], alpha];
	};

	const compileInterpolator = (from: unknown, to: unknown): Interpolator => {
		if (typeof from === 'number' && typeof to === 'number') {
			const delta = to - from;
			return (progress) => from + delta * progress;
		}

		const fromColor = parseColor(from);
		const toColor = parseColor(to);
		if (fromColor && toColor) {
			const deltas = fromColor.map((channel, index) => toColor[index] - channel) as Color;
			return (progress) =>
				`rgba(${fromColor[0] + deltas[0] * progress}, ${fromColor[1] + deltas[1] * progress}, ${fromColor[2] + deltas[2] * progress}, ${fromColor[3] + deltas[3] * progress})`;
		}

		if (Array.isArray(from) && Array.isArray(to) && from.length === to.length) {
			const interpolators = from.map((value, index) => compileInterpolator(value, to[index]));
			return (progress) => interpolators.map((interpolate) => interpolate(progress));
		}

		return (progress) => (progress < 1 ? from : to);
	};

	const pathParts = (property: string): PathPart[] =>
		property.split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : part));

	const getChild = (source: unknown, part: PathPart): unknown => {
		if (Array.isArray(source)) return typeof part === 'number' ? source[part] : undefined;
		if (source !== null && typeof source === 'object') {
			return (source as JsonRecord)[String(part)];
		}
		return undefined;
	};

	const getPath = (source: unknown, path: PathPart[]): unknown => {
		let value = source;
		for (const part of path) value = getChild(value, part);
		return value;
	};

	// Copy-on-write: shallow tracks only copy the props object; nested tracks copy only
	// the branch they touch (e.g. paths -> paths[0] -> fill).
	const setPath = (source: unknown, path: PathPart[], value: unknown): unknown => {
		if (path.length === 0) return value;
		const [head, ...tail] = path;
		const current = getChild(source, head);

		if (Array.isArray(source)) {
			if (typeof head !== 'number') return source;
			const clone = [...source];
			clone[head] = setPath(current, tail, value);
			return clone;
		}

		const clone = { ...((source ?? {}) as JsonRecord) };
		clone[String(head)] = setPath(current, tail, value);
		return clone;
	};

	const evenlySpaced = (count: number, start: number, end: number) => {
		if (count === 2) return [start, end];
		const span = end - start;
		return Array.from({ length: count }, (_, index) => start + (span * index) / (count - 1));
	};

	const normalizeTrack = (track: ParsedTrack): NormalizedTrack =>
		Array.isArray(track) ? { values: track, delay: 0, relative: false } : track;

	const compileTrack = (
		property: string,
		trackInput: ParsedTrack,
		layerDuration: number,
		baseProps: JsonRecord,
		defaults: TrackDefaults
	): CompiledTrack[] => {
		const track = normalizeTrack(trackInput);
		const properties = property === 'scale' ? ['scaleX', 'scaleY'] : [property];
		const trackDelay = defaults.delay + (track.delay ?? 0);
		const easing = easings[track.easing ?? defaults.easing];
		const span = track.duration ?? defaults.duration ?? Math.max(0, layerDuration - 1);

		let frames: number[];
		if (track.frames) {
			frames = track.frames.map((frame) => frame + trackDelay);
		} else if (track.at) {
			frames = track.at.map((position) => trackDelay + position * span);
		} else {
			frames = evenlySpaced(track.values.length, trackDelay, trackDelay + span);
		}

		if (frames.at(-1)! > layerDuration - 1) {
			throw new Error(
				`Animation '${property}' ends at local frame ${frames.at(-1)}, but the layer only has ${layerDuration} frames.`
			);
		}

		return properties.map((resolvedProperty) => {
			const path = pathParts(resolvedProperty);
			const baseValue = getPath(baseProps, path);
			if (track.relative) {
				if (
					typeof baseValue !== 'number' ||
					track.values.some((value) => typeof value !== 'number')
				) {
					throw new Error(
						`Relative animation '${resolvedProperty}' requires a numeric base value and numeric keyframes.`
					);
				}
			}

			const segments = track.values.slice(0, -1).map((from, index) => ({
				fromFrame: frames[index],
				toFrame: frames[index + 1],
				interpolate: compileInterpolator(from, track.values[index + 1])
			}));

			const resolve = (value: unknown) =>
				track.relative ? (baseValue as number) + (value as number) : value;

			return {
				path,
				sample(frame) {
					if (frame <= frames[0]) return resolve(track.values[0]);
					const lastIndex = frames.length - 1;
					if (frame >= frames[lastIndex]) return resolve(track.values[lastIndex]);

					const segment = segments.find(
						(candidate) => frame >= candidate.fromFrame && frame <= candidate.toFrame
					)!;
					const progress = easing(
						(frame - segment.fromFrame) / (segment.toFrame - segment.fromFrame)
					);
					return resolve(segment.interpolate(progress));
				}
			};
		});
	};

	const normalizedBaseProps = (props: JsonRecord): JsonRecord => {
		const base = { ...props };
		if (typeof base.scale === 'number') {
			base.scaleX ??= base.scale;
			base.scaleY ??= base.scale;
			delete base.scale;
		}
		return base;
	};

	const compileLayer = (definition: ParsedLayer, config: ParsedWebMotionConfig): CompiledLayer => {
		const layerDuration =
			definition.duration ?? config.composition.durationInFrames - definition.from;
		if (layerDuration <= 0) {
			throw new Error(
				`Layer '${definition.name ?? definition.type}' starts outside the composition.`
			);
		}
		if (definition.from + layerDuration > config.composition.durationInFrames) {
			throw new Error(
				`Layer '${definition.name ?? definition.type}' extends beyond the composition.`
			);
		}

		const baseProps = normalizedBaseProps(definition.props as JsonRecord);
		const trackMap = new SvelteMap<string, CompiledTrack>();

		const addAnimations = (
			animate: Record<string, ParsedTrack>,
			defaults: TrackDefaults = { delay: 0, easing: 'linear' }
		) => {
			for (const [property, track] of Object.entries(animate)) {
				for (const compiled of compileTrack(property, track, layerDuration, baseProps, defaults)) {
					trackMap.set(compiled.path.join('.'), compiled);
				}
			}
		};

		const motionNames = definition.motion
			? Array.isArray(definition.motion)
				? definition.motion
				: [definition.motion]
			: [];

		for (const motionName of motionNames) {
			const motion = config.motions[motionName];
			if (!motion) throw new Error(`Unknown motion '${motionName}'.`);
			addAnimations(motion.animate, {
				duration: motion.duration,
				delay: motion.delay,
				easing: motion.easing
			});
		}

		// Layer-level tracks intentionally win over named motions.
		addAnimations(definition.animate);

		return {
			definition,
			durationInFrames: layerDuration,
			baseProps,
			tracks: [...trackMap.values()]
		};
	};

	const renderers = {
		text(ctx: Canvas2DContext, props: JsonRecord) {
			ctx.fillStyle = String(props.color ?? '#ffffff');
			ctx.font = `${String(props.fontWeight ?? 400)} ${numericValue(props, 'fontSize', 64)}px ${String(props.fontFamily ?? 'system-ui')}`;
			ctx.textAlign = (props.align ?? 'center') as CanvasTextAlign;
			ctx.textBaseline = (props.baseline ?? 'middle') as CanvasTextBaseline;
			const maxWidth = props.maxWidth;
			if (typeof maxWidth === 'number') ctx.fillText(String(props.text), 0, 0, maxWidth);
			else ctx.fillText(String(props.text), 0, 0);
		},
		rectangle(ctx: Canvas2DContext, props: JsonRecord) {
			const width = numericValue(props, 'width');
			const height = numericValue(props, 'height');
			ctx.beginPath();
			ctx.roundRect(-width / 2, -height / 2, width, height, numericValue(props, 'cornerRadius'));
			paintPath(ctx, props);
		},
		circle(ctx: Canvas2DContext, props: JsonRecord) {
			ctx.beginPath();
			ctx.arc(0, 0, numericValue(props, 'radius'), 0, Math.PI * 2);
			paintPath(ctx, props);
		},
		ellipse(ctx: Canvas2DContext, props: JsonRecord) {
			ctx.beginPath();
			ctx.ellipse(
				0,
				0,
				numericValue(props, 'radiusX'),
				numericValue(props, 'radiusY'),
				0,
				0,
				Math.PI * 2
			);
			paintPath(ctx, props);
		},
		line(ctx: Canvas2DContext, props: JsonRecord) {
			ctx.beginPath();
			ctx.moveTo(numericValue(props, 'x1'), numericValue(props, 'y1'));
			ctx.lineTo(numericValue(props, 'x2'), numericValue(props, 'y2'));
			ctx.strokeStyle = String(props.stroke ?? '#ffffff');
			ctx.lineWidth = numericValue(props, 'lineWidth', 1);
			ctx.lineCap = (props.lineCap ?? 'butt') as CanvasLineCap;
			ctx.stroke();
		},
		polygon(ctx: Canvas2DContext, props: JsonRecord) {
			const [first, ...points] = props.points as [number, number][];
			ctx.beginPath();
			ctx.moveTo(first[0], first[1]);
			for (const [x, y] of points) ctx.lineTo(x, y);
			ctx.closePath();
			paintPath(ctx, props);
		}
	} satisfies Record<
		Exclude<ParsedLayer['type'], 'svg'>,
		(ctx: Canvas2DContext, props: JsonRecord) => void
	>;

	class JsonCanvasLayer implements WebMotionComponent {
		private readonly layer: CompiledLayer;
		private readonly svgPaths = new Map<string, Path2D>();

		constructor(layer: CompiledLayer) {
			this.layer = layer;
		}

		private svgPath(data: string) {
			let path = this.svgPaths.get(data);
			if (!path) {
				path = new Path2D(data);
				this.svgPaths.set(data, path);
			}
			return path;
		}

		mount() {}

		renderFrame({ ctx, frame }: CanvasRenderContext) {
			let props = { ...this.layer.baseProps };
			for (const track of this.layer.tracks) {
				props = setPath(props, track.path, track.sample(frame)) as JsonRecord;
			}

			ctx.save();
			try {
				ctx.globalAlpha = numericValue(props, 'opacity', 1);
				ctx.filter = `blur(${numericValue(props, 'blur')}px)`;
				ctx.translate(numericValue(props, 'x'), numericValue(props, 'y'));
				ctx.rotate((numericValue(props, 'rotation') * Math.PI) / 180);
				ctx.scale(numericValue(props, 'scaleX', 1), numericValue(props, 'scaleY', 1));

				const type = this.layer.definition.type;
				if (type !== 'svg') {
					renderers[type](ctx, props);
					return;
				}

				const [minX, minY, viewBoxWidth, viewBoxHeight] = props.viewBox as [
					number,
					number,
					number,
					number
				];
				const width = numericValue(props, 'width');
				const height = numericValue(props, 'height');
				ctx.translate(-width / 2, -height / 2);
				ctx.scale(width / viewBoxWidth, height / viewBoxHeight);
				ctx.translate(-minX, -minY);

				const paths = props.paths as Array<{
					d: string;
					fill?: string;
					stroke?: string;
					lineWidth?: number;
					fillRule?: CanvasFillRule;
				}>;
				for (const style of paths) {
					const path = this.svgPath(style.d);
					if (style.fill) {
						ctx.fillStyle = style.fill;
						ctx.fill(path, style.fillRule ?? 'nonzero');
					}
					if (style.stroke && (style.lineWidth ?? 1) > 0) {
						ctx.strokeStyle = style.stroke;
						ctx.lineWidth = style.lineWidth ?? 1;
						ctx.stroke(path);
					}
				}
			} finally {
				ctx.restore();
			}
		}

		destroy() {
			this.svgPaths.clear();
		}
	}

	const setupPlayer: Attachment<HTMLDivElement> = (host) => {
		let disposed = false;
		let runtime: Runtime | undefined;
		let playback: PlaybackController | undefined;
		const canvas = host.querySelector('canvas');
		const player = host.querySelector('w-player') as WPlayer | null;

		if (!canvas || !player) return;
		loadError = undefined;

		try {
			const parsed = webMotionConfigSchema.parse(config);
			// Keep authoring coordinates stable while CSS scales the canvas to its parent.
			const { viewBoxWidth, viewBoxHeight, ...settings } = parsed.composition;
			const composition = new Composition({
				...settings,
				width: viewBoxWidth,
				height: viewBoxHeight
			});
			const compiledLayers = parsed.layers.map((definition) => compileLayer(definition, parsed));
			const layers = compiledLayers.map(
				(compiled) =>
					new Layer({
						name: compiled.definition.name,
						component: new JsonCanvasLayer(compiled),
						sequence: new Sequence({
							from: compiled.definition.from,
							durationInFrames: compiled.durationInFrames
						})
					})
			);

			canvas.width = composition.width;
			canvas.height = composition.height;

			void import('@superhq/webmotion/elements')
				.then(() => {
					if (disposed) return;

					runtime = new Runtime({
						composition,
						renderer: new CanvasRenderer(composition.width, composition.height, {
							canvas,
							background: parsed.composition.background
						}),
						layers
					});
					playback = new PlaybackController({
						fps: composition.fps,
						durationInFrames: composition.durationInFrames,
						renderFrame: async (frame) => {
							await runtime!.renderFrame(frame);
						}
					});
					playback.loop = parsed.playback.loop;

					controller = playback;
					player.source = playback;
					onready?.(playback);
					if (parsed.playback.autoplay) playback.play();
				})
				.catch(showError);
		} catch (error) {
			showError(error);
		}

		function showError(error: unknown) {
			if (disposed) return;
			loadError = error instanceof Error ? error.message : 'The animation could not be loaded.';
			onerror?.(error);
		}

		return () => {
			disposed = true;
			if (player.source === playback) player.source = null;
			playback?.destroy();
			if (controller === playback) controller = undefined;
			void runtime?.destroy();
		};
	};

	export function play() {
		controller?.play();
	}

	export function pause() {
		controller?.pause();
	}

	export function seek(frame: number) {
		controller?.seek(frame);
	}
</script>

<div class={className} data-fit={fit} inert={!controls} {@attach setupPlayer}>
	<w-player aria-label={label} data-controls={controls}>
		<canvas
			aria-label={label}
			style:aspect-ratio={config.composition.viewBoxWidth / config.composition.viewBoxHeight}
		></canvas>
	</w-player>

	{#if loadError}
		<p class="error" role="alert">{loadError}</p>
	{/if}
</div>

<style>
	div {
		width: 100%;
		min-width: 0;
	}

	w-player {
		--w-player-accent: #f4f4f5;
		--w-player-accent-contrast: #18181b;
		--w-player-line: rgb(255 255 255 / 0.12);
		--w-player-chip: rgb(255 255 255 / 0.08);
		--w-player-chip-active: rgb(255 255 255 / 0.2);
		display: flex;
		width: 100%;
		overflow: hidden;
		border-radius: inherit;
		background: #09090b;
		color: #f4f4f5;
	}

	w-player[data-controls='false']::part(bar) {
		display: none;
	}

	/* Override the transport's inline fit-to-height width when the parent grows. */
	w-player::part(shell) {
		width: 100% !important;
	}

	/* Reserve the bar's natural height and contain the canvas in the remaining viewport. */
	div[data-fit='contain'],
	[data-fit='contain'] w-player,
	[data-fit='contain'] w-player::part(shell) {
		height: 100%;
	}

	[data-fit='contain'] w-player::part(viewport) {
		flex-basis: 0;
		overflow: hidden;
	}

	[data-fit='contain'] canvas {
		height: 100%;
	}

	/* The installed player calls its multiplier timeline zoom, not playback speed. */
	w-player::part(sound),
	w-player::part(zoom),
	w-player::part(fullscreen-button) {
		display: none;
	}

	w-player::part(bar) {
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	w-player::part(track) {
		min-width: 4rem;
	}

	canvas {
		display: block;
		width: 100%;
		height: auto;
		object-fit: contain;
	}

	.error {
		overflow-wrap: anywhere;
		margin-top: 0.75rem;
		color: #dc2626;
		font-size: 0.875rem;
	}
</style>
