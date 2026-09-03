import { formObjectPreprocessor, translatableValidator } from '$lib/db/schemas/0-utils';
import { z } from 'zod/v4';

const anthologyPositionSchema = z.object({
	id: z.string().min(1),
	order: z.number(),
	storyId: z.string().min(1),
	configuration: z.record(z.string(), z.unknown()).nullish(),
	isRemoved: z.boolean().optional().default(false)
});

export const anthologyCreateSchema = z.object({
	slug: z.string().min(1),
	nameRaw: z.preprocess(formObjectPreprocessor, translatableValidator),
	isPublished: z.boolean().default(false),
	isPublic: z.boolean().default(true),
	positions: z.array(anthologyPositionSchema).min(1, 'At least one story is required')
});

export const anthologyPatchSchema = anthologyCreateSchema;
