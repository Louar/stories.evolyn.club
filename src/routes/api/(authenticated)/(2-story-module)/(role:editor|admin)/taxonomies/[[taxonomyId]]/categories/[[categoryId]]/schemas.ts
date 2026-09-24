import {
	formObjectPreprocessor,
	mediaValidator,
	translatableValidator
} from '$lib/db/schemas/0-utils';
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

const categorySchema = z.object({
	name: requiredTranslatableField,
	image: mediaField,
	description: nullableTranslatableField,
	map: nullableJsonField
});

export const categoryCreateSchema = categorySchema.extend({
	name: categorySchema.shape.name.optional(),
	image: categorySchema.shape.image.optional(),
	description: categorySchema.shape.description.optional(),
	map: categorySchema.shape.map.optional()
});

export const categoryPatchSchema = categorySchema.partial();
