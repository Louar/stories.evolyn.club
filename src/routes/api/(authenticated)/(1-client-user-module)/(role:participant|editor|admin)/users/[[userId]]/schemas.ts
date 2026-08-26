import { formObjectPreprocessor, Language, mediaValidator } from '$lib/db/schemas/0-utils';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { z } from 'zod/v4';

const userRoleOrder = Object.values(UserRole).reduce(
	(acc, role, index) => {
		acc[role] = index;
		return acc;
	},
	{} as Record<UserRole, number>,
);

const userSchema = z.object({
	email: z.email().nullable(),
	phone: z.e164().nullable(),
	firstName: z.string().trim().min(1).nullable(),
	lastName: z.string().trim().min(1).nullable(),
	picture: z
		.union([mediaValidator, z.array(mediaValidator).min(1)])
		.nullable()
		.transform((val) => {
			if (val === null) return val;
			return Array.isArray(val) ? val[0] : val;
		})
		.transform((val) => JSON.stringify(val)),
	password: z.string().trim().min(1).nullable(),
	roles: z
		.enum(UserRole)
		.array()
		.min(1)
		.transform((roles) =>
			[...roles].sort(
				(a, b) => userRoleOrder[b] - userRoleOrder[a],
			),
		),
	language: z.enum(Language).nullable(),
	pronouns: z.string().nullable(),
	address: z.unknown().transform((val) => formObjectPreprocessor(val) ?? null).transform((val) => JSON.stringify(val ?? null)),
	dateOfBirth: z.coerce.date().nullable(),
	emailConfirmed: z.boolean(),
	emailConfirmCode: z.string().nullable(),
	phoneConfirmed: z.boolean(),
	passwordResetCode: z.string().nullable(),
	passwordResetExpiresAt: z.coerce.date().nullable(),
	isActive: z.boolean(),
	reasonForDeactivation: z.string().nullable()
});

export const userCreateSchema = userSchema.extend({
	email: userSchema.shape.email.optional(),
	phone: userSchema.shape.phone.optional(),
	firstName: userSchema.shape.firstName.optional(),
	lastName: userSchema.shape.lastName.optional(),
	picture: userSchema.shape.picture.optional(),
	password: userSchema.shape.password.optional(),
	roles: userSchema.shape.roles.optional().default([UserRole.participant]),
	language: userSchema.shape.language.optional(),
	pronouns: userSchema.shape.pronouns.optional(),
	address: userSchema.shape.address.optional(),
	dateOfBirth: userSchema.shape.dateOfBirth.optional(),
	emailConfirmed: userSchema.shape.emailConfirmed.optional(),
	emailConfirmCode: userSchema.shape.emailConfirmCode.optional(),
	phoneConfirmed: userSchema.shape.phoneConfirmed.optional(),
	passwordResetCode: userSchema.shape.passwordResetCode.optional(),
	passwordResetExpiresAt: userSchema.shape.passwordResetExpiresAt.optional(),
	isActive: userSchema.shape.isActive.optional(),
	reasonForDeactivation: userSchema.shape.reasonForDeactivation.optional()
});

export const userPatchSchema = userSchema.partial();
