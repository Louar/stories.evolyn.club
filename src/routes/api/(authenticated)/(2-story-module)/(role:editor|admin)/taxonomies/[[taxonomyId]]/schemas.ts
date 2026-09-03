import { translatableValidator } from '$lib/db/schemas/0-utils';
import { z } from 'zod/v4';

const taxonomySchema = z.object({
	slug: z.string().trim().min(1),
	name: translatableValidator.nullable(),
	description: translatableValidator.nullable()
});

export const taxonomyCreateSchema = taxonomySchema.extend({
	slug: taxonomySchema.shape.slug.optional(),
	name: taxonomySchema.shape.name.optional(),
	description: taxonomySchema.shape.description.optional()
});

export const taxonomyPatchSchema = taxonomySchema.partial();
