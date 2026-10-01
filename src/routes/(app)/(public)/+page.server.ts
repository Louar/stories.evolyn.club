import { findOneClient } from '$lib/db/repositories/1-client-user-module';
import { findManyPublicAnthologies } from '$lib/db/repositories/2-story-module';
import type { PageServerLoad } from './$types';

export const load = (async ({ locals }) => {
	const { authusr, client: authclient, language } = locals;

	const [client, anthologies] = await Promise.all([
		findOneClient(authclient.slug, language),
		findManyPublicAnthologies(authclient.id, language)
	]);

	return {
		authclient,
		client,
		anthologies,
		authusr,
	};
}) satisfies PageServerLoad;
