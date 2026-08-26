import {
	addCaddyDomain,
	CaddyDomainError,
	listCaddyDomains
} from '$lib/server/caddy-domains.server';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	try {
		return {
			domains: await listCaddyDomains(),
			loadError: null
		};
	} catch (error) {
		return {
			domains: [],
			loadError: error instanceof Error ? error.message : 'Unable to load Caddy domains'
		};
	}
};

export const actions: Actions = {
	add: async ({ request }) => {
		const formData = await request.formData();
		const domain = formData.get('domain');

		try {
			return { success: true, domain: await addCaddyDomain(domain) };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unable to add domain';
			const status = error instanceof CaddyDomainError ? error.status : 500;
			return fail(status >= 400 && status < 500 ? status : 502, {
				message,
				domain: typeof domain === 'string' ? domain : ''
			});
		}
	}
};
