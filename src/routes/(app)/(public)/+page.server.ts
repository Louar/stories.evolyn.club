import { findOneClient } from '$lib/db/repositories/1-client-user-module';
import { ClientAuthenticationMethod } from '$lib/db/schemas/1-client-user-module';
import type { PageServerLoad } from './$types';

export const load = (async ({ locals }) => {
	const { authusr, client: localClient, language } = locals;

	const client = await findOneClient(localClient.slug, language);

	return {
		client,
		authusr,
		canAuthenticateWithPassword: localClient.authenticationMethods.includes(ClientAuthenticationMethod.password)
	};
}) satisfies PageServerLoad;
