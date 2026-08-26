import { z } from 'zod/v4';

const attributeOfCategorySchema = z.object({
	attributeId: z.string().trim().min(1),
	order: z.coerce.number().int().nullable(),
	isRequired: z.boolean(),
	isDefault: z.boolean()
});

export const attributeOfCategoryCreateSchema = attributeOfCategorySchema.extend({
	attributeId: attributeOfCategorySchema.shape.attributeId.optional(),
	order: attributeOfCategorySchema.shape.order.optional(),
	isRequired: attributeOfCategorySchema.shape.isRequired.optional(),
	isDefault: attributeOfCategorySchema.shape.isDefault.optional()
});

export const attributeOfCategoryPatchSchema = attributeOfCategorySchema.partial();
