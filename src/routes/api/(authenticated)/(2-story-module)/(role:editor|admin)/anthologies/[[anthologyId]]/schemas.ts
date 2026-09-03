import { formObjectPreprocessor, translatableValidator } from '$lib/db/schemas/0-utils';
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
	configuration: z.object({ showPerformanceOverview: z.boolean() }).nullable(),
	isPublished: z.boolean(),
	isPublic: z.boolean(),
	positions: z.array(anthologyPositionSchema)
});

export const anthologyCreateSchema = anthologyFieldsSchema.extend({
	configuration: anthologyFieldsSchema.shape.configuration.default(null),
	isPublished: anthologyFieldsSchema.shape.isPublished.default(false),
	isPublic: anthologyFieldsSchema.shape.isPublic.default(true),
	positions: anthologyFieldsSchema.shape.positions.default([])
});

export const anthologyPatchSchema = anthologyFieldsSchema.partial();
