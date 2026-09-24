import { findPolicyState } from '$lib/db/repositories/1-client-user-module';
import type { LayoutServerLoad } from './$types';

export const load = (async ({ locals, depends }) => {
	const { client, authusr, language } = locals;
	depends('app:policy-state');
	const policyState = await findPolicyState(client.id, authusr?.id, language);

	return {
		client,
		authusr,
		language,
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
