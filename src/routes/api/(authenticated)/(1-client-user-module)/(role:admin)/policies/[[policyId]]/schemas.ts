import { formObjectPreprocessor, translatableValidator } from '$lib/db/schemas/0-utils';
import { z } from 'zod/v4';

const policySchema = z.object({
	name: z
		.preprocess(formObjectPreprocessor, translatableValidator)
		.transform((val): string => JSON.stringify(val)),
	version: z.string().trim().min(1),
	termsOfUse: z
		.preprocess(formObjectPreprocessor, translatableValidator.nullable())
		.transform((val): string => JSON.stringify(val)),
	privacyPolicy: z
		.preprocess(formObjectPreprocessor, translatableValidator.nullable())
		.transform((val): string => JSON.stringify(val))
});

export const policyCreateSchema = policySchema.extend({
	termsOfUse: policySchema.shape.termsOfUse.optional(),
	privacyPolicy: policySchema.shape.privacyPolicy.optional()
});

export const policyPatchSchema = policySchema.partial();
