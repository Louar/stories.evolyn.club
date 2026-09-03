import { translatableValidator } from '$lib/db/schemas/0-utils';
import z from 'zod/v4';
import { schema as storySchema } from '../../../stories/[[storyId]]/io/schemas';

const parseJsonString = (value: unknown) => {
	if (typeof value !== 'string') return value;
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
};

const configurationSchema = z.preprocess(
	parseJsonString,
	z.record(z.string(), z.unknown()).nullish().default(null)
);

const anthologyPositionSchema = z.object({
	id: z.string().min(1).optional(),
	order: z.number(),
	storySlug: z.string().min(1),
	configuration: configurationSchema
});

export const schema = z.object({
	id: z.string().min(1).optional(),
	slug: z.string().min(1),
	name: z.preprocess(parseJsonString, translatableValidator),
	configuration: configurationSchema,
	isPublished: z.boolean(),
	isPublic: z.boolean(),
	positions: z.array(anthologyPositionSchema).default([]),
	stories: z.array(storySchema).optional()
});
