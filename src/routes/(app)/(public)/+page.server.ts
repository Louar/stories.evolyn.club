import { findOneClient } from '$lib/db/repositories/1-client-user-module';
import { findManyPublicAnthologies } from '$lib/db/repositories/2-story-module';
import { ClientAuthenticationMethod } from '$lib/db/schemas/1-client-user-module';
import type { PageServerLoad } from './$types';

export const load = (async ({ locals }) => {
	const { authusr, client: localClient, language } = locals;

	const [client, anthologies] = await Promise.all([
		findOneClient(localClient.slug, language),
		findManyPublicAnthologies(localClient.id, language)
	]);

	return {
		client,
		anthologies,
		authusr,
		canAuthenticateWithPassword: localClient.authenticationMethods.includes(
			ClientAuthenticationMethod.password
		)
	};
}) satisfies PageServerLoad;
