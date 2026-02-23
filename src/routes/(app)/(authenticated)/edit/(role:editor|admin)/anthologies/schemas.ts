import { BYTE, MEGABYTE } from '$lib/components/ui/file-drop-zone';
import { formObjectPreprocessor, translatableValidator } from '$lib/db/schemas/0-utils';
import { z } from 'zod/v4';

export const schemaOfAttachments = z.object({
	attachments: z.file()
		.refine(
			file => /\.(ya?ml)$/i.test(file.name),
			'Only .yml or .yaml files are allowed'
		)
		.min(5 * BYTE)
		.max(50 * MEGABYTE)
		.array()
});

const anthologyPositionSchema = z.object({
	id: z.string().min(1),
	order: z.number(),
	storyId: z.string().min(1),
	configuration: z.record(z.string(), z.unknown()).nullish(),
	isRemoved: z.boolean().optional().default(false),
});
export const anthologySchema = z.object({
	id: z.string().min(1).nullish(),
	reference: z.string().min(1),
	nameRaw: z.preprocess(
		formObjectPreprocessor,
		translatableValidator
	),
	isPublished: z.boolean().default(false),
	isPublic: z.boolean().default(true),
	positions: z.array(anthologyPositionSchema).min(1, 'At least one question is required'),
});
