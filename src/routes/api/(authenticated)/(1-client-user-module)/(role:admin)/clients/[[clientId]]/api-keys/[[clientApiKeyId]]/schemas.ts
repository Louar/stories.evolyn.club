import { z } from 'zod/v4';

const scopesSchema = z.preprocess(
	(val) => {
		if (Array.isArray(val)) return val;
		if (typeof val === 'string') {
			return val
				.split(/\r?\n|,/)
				.map((item) => item.trim())
				.filter(Boolean);
		}
		return val;
	},
	z.array(z.string().trim().min(1))
);

const clientApiKeySchema = z.object({
	name: z.string().trim().min(1),
	scopes: scopesSchema,
	lastUsedAt: z.coerce.date().nullable().optional()
});

export const clientApiKeyCreateSchema = clientApiKeySchema.extend({
	lastUsedAt: clientApiKeySchema.shape.lastUsedAt.optional()
});

export const clientApiKeyPatchSchema = clientApiKeySchema.partial();
