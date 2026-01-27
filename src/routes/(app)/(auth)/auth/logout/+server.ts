import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';


export const GET = (async ({ cookies, url, locals }) => {
	delete locals.authusr;
	cookies.delete('__session', { domain: url.hostname, path: '/' });
	throw redirect(302, '/');

}) satisfies RequestHandler;
