import type { LayoutServerLoad } from './$types';

export const load = (async ({ locals }) => {
	const { client, authusr } = locals;

	return { client, authusr };
}) satisfies LayoutServerLoad;
