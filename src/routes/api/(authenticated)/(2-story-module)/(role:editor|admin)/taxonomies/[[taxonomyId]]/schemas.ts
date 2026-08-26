import { z } from 'zod/v4';

const taxonomySchema = z.object({
	name: z.string().trim().min(1),
	description: z.string().trim().nullable()
});

export const taxonomyCreateSchema = taxonomySchema.extend({
	name: taxonomySchema.shape.name.optional(),
	description: taxonomySchema.shape.description.optional()
});

export const taxonomyPatchSchema = taxonomySchema.partial();
