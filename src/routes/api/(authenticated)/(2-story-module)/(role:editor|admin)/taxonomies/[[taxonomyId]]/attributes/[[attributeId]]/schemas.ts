import {
	formObjectPreprocessor,
	mediaValidator,
	translatableValidator
} from '$lib/db/schemas/0-utils';
import { AttributeType } from '$lib/db/schemas/2-story-module';
import { z } from 'zod/v4';

const mediaField = z
	.union([mediaValidator, z.array(mediaValidator).min(1)])
	.nullable()
	.transform((val) => {
		if (val === null) return val;
		return Array.isArray(val) ? val[0] : val;
	})
	.transform((val): string => JSON.stringify(val));

const requiredTranslatableField = z
	.preprocess(formObjectPreprocessor, translatableValidator)
	.transform((val): string => JSON.stringify(val));

const nullableTranslatableField = z
	.preprocess(formObjectPreprocessor, translatableValidator.nullable())
	.transform((val): string => JSON.stringify(val));

const nullableJsonField = z
	.unknown()
	.transform((val) => formObjectPreprocessor(val) ?? null)
	.transform((val): string => JSON.stringify(val));

const attributeSchema = z.object({
	slug: z.string().trim().min(1),
	name: requiredTranslatableField,
	image: mediaField,
	description: nullableTranslatableField,
	type: z.enum(AttributeType),
	referencedCategoryId: z.string().trim().min(1).nullable(),
	schema: nullableJsonField
});

export const attributeCreateSchema = attributeSchema.extend({
	slug: attributeSchema.shape.slug.optional(),
	name: attributeSchema.shape.name.optional(),
	image: attributeSchema.shape.image.optional(),
	description: attributeSchema.shape.description.optional(),
	type: attributeSchema.shape.type.optional(),
	referencedCategoryId: attributeSchema.shape.referencedCategoryId.optional(),
	schema: attributeSchema.shape.schema.optional()
});

export const attributePatchSchema = attributeSchema.partial();
