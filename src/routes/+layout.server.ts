import { findPolicyState } from '$lib/db/repositories/1-client-user-module';
import type { LayoutServerLoad } from './$types';

export const load = (async ({ locals, depends }) => {
	const { client, authusr } = locals;
	depends('app:policy-state');
	const policyState = await findPolicyState(client.id, authusr?.id, authusr?.language ?? undefined);

	return {
		client,
		authusr,
		policyState: {
			latestLicense: policyState.latestLicense
				? {
					id: policyState.latestLicense.id,
					name: policyState.latestLicense.name,
					version: policyState.latestLicense.version,
					updatedAt: policyState.latestLicense.updatedAt
				}
				: undefined,
			latestAgreement: policyState.latestAgreement
		}
	};
}) satisfies LayoutServerLoad;
