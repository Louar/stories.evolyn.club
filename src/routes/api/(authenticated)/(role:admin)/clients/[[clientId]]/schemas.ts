import { formObjectPreprocessor, mediaValidator, translatableValidator } from '$lib/db/schemas/0-utils';
import { ClientAuthenticationMethod } from '$lib/db/schemas/1-client-user-module';
import { z } from 'zod/v4';

const clientSchema = z
	.object({
		reference: z.string().min(1),
		name: z.string().min(1),
		description: z
			.preprocess(formObjectPreprocessor, translatableValidator.nullable())
			.transform((val): string => JSON.stringify(val)),
		domains: z
			.preprocess((val) => {
				if (Array.isArray(val)) return val;
				if (typeof val === 'string') {
					const items = val
						.split(/\r?\n|,/)
						.map((item) => item.trim())
						.filter(Boolean);
					return items.length ? items : [val];
				}
				return val;
			}, z.array(z.string().min(1))),
		logo: z.union([
			mediaValidator,
			z.array(mediaValidator).min(1),
		])
			.nullable()
			.transform((val) => {
				if (val === null) return val;
				return Array.isArray(val) ? val[0] : val;
			})
			.transform((val): string => JSON.stringify(val)),
		favicon: z.union([
			mediaValidator,
			z.array(mediaValidator).min(1),
		])
			.nullable()
			.transform((val) => {
				if (val === null) return val;
				return Array.isArray(val) ? val[0] : val;
			})
			.transform((val): string => JSON.stringify(val)),
		splash: z.union([
			mediaValidator,
			z.array(mediaValidator).min(1),
		])
			.nullable()
			.transform((val) => {
				if (val === null) return val;
				return Array.isArray(val) ? val[0] : val;
			})
			.transform((val): string => JSON.stringify(val)),
		hero: z.union([
			mediaValidator,
			z.array(mediaValidator).min(1),
		])
			.nullable()
			.transform((val) => {
				if (val === null) return val;
				return Array.isArray(val) ? val[0] : val;
			})
			.transform((val): string => JSON.stringify(val)),
		css: z
			.unknown()
			.nullable()
			.transform((val): string => JSON.stringify(val)),
		manifest: z
			.unknown()
			.nullable()
			.transform((val): string => JSON.stringify(val)),
		isFindableBySearchEngines: z.boolean().optional(),
		plausibleDomain: z.string().min(1).nullable(),
		authenticationMethods: z
			.enum(ClientAuthenticationMethod)
			.array().min(1),
		accessTokenKey: z.string().min(1),
		redirectAuthorized: z
			.union([
				z.unknown(),
				z.string().min(1)
			])
			.nullable()
			.transform((val): string => JSON.stringify(val)),
		redirectUnauthorized: z.string().min(1).nullable(),
		onboardingSchema: z
			.unknown()
			.nullable()
			.transform((val): string => JSON.stringify(val)),
	});

export const clientCreateSchema = clientSchema.extend({
	description: clientSchema.shape.description.optional(),
	logo: clientSchema.shape.logo.optional(),
	favicon: clientSchema.shape.favicon.optional(),
	splash: clientSchema.shape.splash.optional(),
	hero: clientSchema.shape.hero.optional(),
	css: clientSchema.shape.css.optional(),
	manifest: clientSchema.shape.manifest.optional(),
	isFindableBySearchEngines: clientSchema.shape.isFindableBySearchEngines.optional(),
	plausibleDomain: clientSchema.shape.plausibleDomain.optional(),
	redirectAuthorized: clientSchema.shape.redirectAuthorized.optional(),
	redirectUnauthorized: clientSchema.shape.redirectUnauthorized.optional(),
	onboardingSchema: clientSchema.shape.onboardingSchema.optional(),
});

export const clientPatchSchema = clientSchema.partial();
