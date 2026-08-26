import { formObjectPreprocessor } from '$lib/db/schemas/0-utils';
import { z } from 'zod/v4';

const nullableJsonField = z
	.unknown()
	.transform((val) => formObjectPreprocessor(val) ?? null)
	.transform((val): string => JSON.stringify(val));

const attributeOfItemSchema = z.object({
	attributeId: z.string().trim().min(1),
	value: nullableJsonField,
	referencedItemId: z.string().trim().min(1).nullable(),
	difficulty: z.coerce.number().int().nullable()
});

export const attributeOfItemCreateSchema = attributeOfItemSchema.extend({
	attributeId: attributeOfItemSchema.shape.attributeId.optional(),
	value: attributeOfItemSchema.shape.value.optional(),
	referencedItemId: attributeOfItemSchema.shape.referencedItemId.optional(),
	difficulty: attributeOfItemSchema.shape.difficulty.optional()
});

export const attributeOfItemPatchSchema = attributeOfItemSchema.partial();
