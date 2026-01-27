import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';


export const GET = (async ({ cookies, url, locals }) => {
	delete locals.authusr;
	cookies.delete(process.env.NODE_ENV === 'production' ? '__session' : '__session_stories', { domain: url.hostname, path: '/' });
	throw redirect(302, '/');

}) satisfies RequestHandler;
