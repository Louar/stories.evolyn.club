import { mediaValidator, translatableValidator } from '$lib/db/schemas/0-utils';
import { AttributeType } from '$lib/db/schemas/2-story-module';
import z from 'zod/v4';

const parseJsonString = (value: unknown) => {
	if (typeof value !== 'string') return value;
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
};

const nullableJsonSchema = z.preprocess(
	parseJsonString,
	z.record(z.string(), z.unknown()).nullish().default(null)
);

const nullableJsonValueSchema = z.preprocess(parseJsonString, z.unknown().nullish().default(null));

const nullableTranslatableSchema = z.preprocess(parseJsonString, translatableValidator.nullable());

const requiredTranslatableSchema = z.preprocess(parseJsonString, translatableValidator);

const mediaSchema = z.preprocess(parseJsonString, mediaValidator.nullable());

const categorySchema = z.object({
	id: z.string().min(1),
	name: requiredTranslatableSchema,
	image: mediaSchema,
	description: nullableTranslatableSchema,
	map: nullableJsonSchema
});

const attributeSchema = z.object({
	id: z.string().min(1),
	slug: z.string().trim().min(1),
	name: requiredTranslatableSchema,
	image: mediaSchema,
	description: nullableTranslatableSchema,
	type: z.enum(AttributeType),
	referencedCategoryId: z.string().min(1).nullable(),
	schema: nullableJsonSchema
});

const attributeOfCategorySchema = z.object({
	categoryId: z.string().min(1),
	attributeId: z.string().min(1),
	order: z.number().int().nullable(),
	isRequired: z.boolean(),
	isDefault: z.boolean()
});

const itemSchema = z.object({
	id: z.string().min(1)
});

const itemOfCategorySchema = z.object({
	itemId: z.string().min(1),
	categoryId: z.string().min(1)
});

const attributeOfItemSchema = z.object({
	itemId: z.string().min(1),
	attributeId: z.string().min(1),
	value: nullableJsonValueSchema,
	referencedItemId: z.string().min(1).nullable(),
	difficulty: z.number().int().nullable()
});

export const schema = z.object({
	id: z.string().min(1).optional(),
	slug: z.string().trim().min(1),
	name: nullableTranslatableSchema,
	description: nullableTranslatableSchema,
	categories: z.array(categorySchema),
	attributes: z.array(attributeSchema),
	attributeOfCategories: z.array(attributeOfCategorySchema),
	items: z.array(itemSchema),
	itemOfCategories: z.array(itemOfCategorySchema),
	attributeOfItems: z.array(attributeOfItemSchema)
});
