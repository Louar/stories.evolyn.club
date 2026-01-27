
import type { LayoutServerLoad } from './$types';

export const load = (async ({ locals }) => {

	return {
		client: locals.client,
		authusr: locals.authusr,
	};
}) satisfies LayoutServerLoad;
