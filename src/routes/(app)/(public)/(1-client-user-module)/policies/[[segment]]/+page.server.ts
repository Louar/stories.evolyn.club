import { marked } from '$lib/client/marked';
import { findPolicyState } from '$lib/db/repositories/1-client-user-module';

export const load = async ({ locals }) => {
	const clientId = locals.client.id;
	const language = locals.authusr?.language ?? undefined;
	const policyState = await findPolicyState(clientId, locals.authusr?.id, language);
	const license = policyState.latestLicense;

	if (license?.termsOfUse?.length) license.termsOfUse = await marked.parse(license.termsOfUse);
	if (license?.privacyPolicy?.length)
		license.privacyPolicy = await marked.parse(license.privacyPolicy);

	return { license, policyState };
};
