import { formObjectPreprocessor, translatableValidator } from '$lib/db/schemas/0-utils';
import { AnthologyVisualization } from '$lib/db/schemas/2-story-module';
import { z } from 'zod/v4';

const anthologyPositionSchema = z.object({
	id: z.string().min(1),
	order: z.number(),
	storyId: z.string().min(1),
	configuration: z.record(z.string(), z.unknown()).nullish(),
	isRemoved: z.boolean().optional().default(false)
});

const anthologyFieldsSchema = z.object({
	slug: z.string().min(1),
	nameRaw: z.preprocess(formObjectPreprocessor, translatableValidator),
	visualization: z.enum(Object.values(AnthologyVisualization)),
	configuration: z.object({ showPerformanceOverview: z.boolean() }).nullable(),
	isPublished: z.boolean(),
	isPublic: z.boolean(),
	positions: z.array(anthologyPositionSchema)
});

export const anthologyCreateSchema = anthologyFieldsSchema.extend({
	visualization: anthologyFieldsSchema.shape.visualization.default(AnthologyVisualization.grid),
	configuration: anthologyFieldsSchema.shape.configuration.default(null),
	isPublished: anthologyFieldsSchema.shape.isPublished.default(false),
	isPublic: anthologyFieldsSchema.shape.isPublic.default(true),
	positions: anthologyFieldsSchema.shape.positions.default([])
});

export const anthologyPatchSchema = anthologyFieldsSchema.partial();
