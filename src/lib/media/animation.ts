import {
	translatableValidator,
	translateLocalizedField,
	type Language
} from '$lib/db/schemas/0-utils';
import { z } from 'zod';

const easingSchema = z.enum([
	'linear',
	'easeInQuad',
	'easeOutQuad',
	'easeInOutQuad',
	'easeInCubic',
	'easeOutCubic',
	'easeInOutCubic',
	'easeInSine',
	'easeOutSine',
	'easeInOutSine'
]);
const propertyPathSchema = z
	.string()
	.regex(
		/^[A-Za-z][A-Za-z0-9]*(?:\.(?:[A-Za-z][A-Za-z0-9]*|\d+))*$/,
		'property must be a dot-separated path'
	)
	.refine(
		(property) =>
			!property.split('.').some((part) => ['__proto__', 'prototype', 'constructor'].includes(part)),
		'property contains a reserved path segment'
	);
const trackObjectSchema = z
	.object({
		values: z.array(z.json()).min(2),
		at: z.array(z.number().min(0).max(1)).min(2).optional(),
		frames: z.array(z.number().int().nonnegative()).min(2).optional(),
		duration: z.number().int().positive().optional(),
		delay: z.number().int().nonnegative().default(0),
		easing: easingSchema.optional(),
		relative: z.boolean().default(false)
	})
	.strict()
	.superRefine((track, context) => {
		if (track.at && track.frames)
			context.addIssue({ code: 'custom', message: 'Use either at or frames, not both.' });
		const positions = track.at ?? track.frames;
		if (positions && positions.length !== track.values.length)
			context.addIssue({
				code: 'custom',
				message: 'Keyframe positions and values must contain the same number of entries.'
			});
		if (positions) {
			for (let index = 1; index < positions.length; index += 1) {
				if (positions[index] <= positions[index - 1]) {
					context.addIssue({ code: 'custom', message: 'Keyframe positions must increase.' });
					break;
				}
			}
		}
	});
const trackSchema = z.union([z.array(z.json()).min(2), trackObjectSchema]);
const animationMapSchema = z.record(propertyPathSchema, trackSchema);
const motionSchema = z
	.object({
		duration: z.number().int().positive().optional(),
		delay: z.number().int().nonnegative().default(0),
		easing: easingSchema.default('linear'),
		animate: animationMapSchema
	})
	.strict();
const layerShape = {
	name: z.string().min(1).optional(),
	from: z.number().int().nonnegative().default(0),
	duration: z.number().int().positive().optional(),
	motion: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional(),
	animate: animationMapSchema.default({})
};
const transformShape = {
	x: z.number().optional(),
	y: z.number().optional(),
	rotation: z.number().optional(),
	scale: z.number().optional(),
	scaleX: z.number().optional(),
	scaleY: z.number().optional(),
	opacity: z.number().min(0).max(1).optional(),
	blur: z.number().nonnegative().optional()
};
const paintShape = {
	fill: z.string().optional(),
	stroke: z.string().optional(),
	lineWidth: z.number().nonnegative().optional()
};
const textLayerSchema = z
	.object({
		type: z.literal('text'),
		...layerShape,
		props: z
			.object({
				...transformShape,
				text: z.string(),
				fontSize: z.number().positive().optional(),
				fontFamily: z.string().optional(),
				fontWeight: z.union([z.string(), z.number()]).optional(),
				color: z.string().optional(),
				align: z.enum(['left', 'center', 'right']).optional(),
				baseline: z
					.enum(['top', 'hanging', 'middle', 'alphabetic', 'ideographic', 'bottom'])
					.optional(),
				maxWidth: z.number().positive().optional()
			})
			.strict()
	})
	.strict();
const rectangleLayerSchema = z
	.object({
		type: z.literal('rectangle'),
		...layerShape,
		props: z
			.object({
				...transformShape,
				...paintShape,
				width: z.number().nonnegative(),
				height: z.number().nonnegative(),
				cornerRadius: z.number().nonnegative().optional()
			})
			.strict()
	})
	.strict();
const circleLayerSchema = z
	.object({
		type: z.literal('circle'),
		...layerShape,
		props: z.object({ ...transformShape, ...paintShape, radius: z.number().nonnegative() }).strict()
	})
	.strict();
const ellipseLayerSchema = z
	.object({
		type: z.literal('ellipse'),
		...layerShape,
		props: z
			.object({
				...transformShape,
				...paintShape,
				radiusX: z.number().nonnegative(),
				radiusY: z.number().nonnegative()
			})
			.strict()
	})
	.strict();
const lineLayerSchema = z
	.object({
		type: z.literal('line'),
		...layerShape,
		props: z
			.object({
				...transformShape,
				x1: z.number(),
				y1: z.number(),
				x2: z.number(),
				y2: z.number(),
				stroke: z.string().optional(),
				lineWidth: z.number().nonnegative().optional(),
				lineCap: z.enum(['butt', 'round', 'square']).optional()
			})
			.strict()
	})
	.strict();
const polygonLayerSchema = z
	.object({
		type: z.literal('polygon'),
		...layerShape,
		props: z
			.object({
				...transformShape,
				...paintShape,
				points: z.array(z.tuple([z.number(), z.number()])).min(3)
			})
			.strict()
	})
	.strict();
const svgLayerSchema = z
	.object({
		type: z.literal('svg'),
		...layerShape,
		props: z
			.object({
				...transformShape,
				width: z.number().nonnegative(),
				height: z.number().nonnegative(),
				viewBox: z.tuple([z.number(), z.number(), z.number().positive(), z.number().positive()]),
				paths: z
					.array(
						z
							.object({
								d: z.string().min(1),
								fill: z.string().optional(),
								stroke: z.string().optional(),
								lineWidth: z.number().nonnegative().optional(),
								fillRule: z.enum(['nonzero', 'evenodd']).optional()
							})
							.strict()
					)
					.min(1)
			})
			.strict()
	})
	.strict();

export const webMotionConfigSchema = z
	.object({
		version: z.literal(1),
		composition: z
			.object({
				viewBoxWidth: z.number().int().positive(),
				viewBoxHeight: z.number().int().positive(),
				fps: z.number().positive(),
				durationInFrames: z.number().int().positive(),
				background: z.string().default('transparent')
			})
			.strict(),
		playback: z
			.object({ autoplay: z.boolean().default(false), loop: z.boolean().default(false) })
			.strict()
			.default({ autoplay: false, loop: false }),
		motions: z.record(z.string(), motionSchema).default({}),
		layers: z.array(
			z.discriminatedUnion('type', [
				textLayerSchema,
				rectangleLayerSchema,
				circleLayerSchema,
				ellipseLayerSchema,
				lineLayerSchema,
				polygonLayerSchema,
				svgLayerSchema
			])
		)
	})
	.strict();

export const animationSchema = z.object({
	name: z.string(),
	configuration: webMotionConfigSchema,
	texts: z.record(z.string(), translatableValidator).nullable()
});
export type WebMotionConfig = z.input<typeof webMotionConfigSchema>;
export type AnimationTexts = z.output<typeof animationSchema>['texts'];
export type ParsedWebMotionConfig = z.output<typeof webMotionConfigSchema>;
export type ParsedLayer = ParsedWebMotionConfig['layers'][number];
export type ParsedTrack = z.output<typeof trackSchema>;
export type EasingName = z.output<typeof easingSchema>;

export function resolveAnimationConfig(
	animation: { configuration: WebMotionConfig; texts?: AnimationTexts },
	language?: Language | 'default' | null
): WebMotionConfig {
	const { configuration, texts = {} } = animation;
	return {
		...configuration,
		layers: configuration.layers.map((layer) =>
			layer.type === 'text'
				? {
						...layer,
						props: {
							...layer.props,
							text: layer.props.text.replace(/\$\{([^{}]+)\}/g, (placeholder, variable: string) =>
								texts && Object.hasOwn(texts, variable)
									? (translateLocalizedField(texts[variable], language) ?? placeholder)
									: placeholder
							)
						}
					}
				: layer
		)
	};
}
