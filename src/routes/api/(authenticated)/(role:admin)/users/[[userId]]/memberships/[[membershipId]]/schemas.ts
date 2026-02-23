import { MembershipRole } from '$lib/db/schemas/3-mission-module';
import { z } from 'zod/v4';

const membershipRoleOrder = Object.values(MembershipRole).reduce(
	(acc, role, index) => {
		acc[role] = index;
		return acc;
	},
	{} as Record<MembershipRole, number>,
);

const membershipSchema = z
	.object({
		groupId: z.uuid(),
		roles: z
			.enum(MembershipRole)
			.array()
			.min(1)
			.transform((roles) =>
				[...roles].sort(
					(a, b) => membershipRoleOrder[b] - membershipRoleOrder[a],
				),
			),
	});

export const membershipCreateSchema = membershipSchema.extend({});

export const membershipPatchSchema = membershipSchema.partial();
