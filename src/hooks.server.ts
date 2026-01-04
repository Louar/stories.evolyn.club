import { type Handle } from '@sveltejs/kit';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { db } from '$lib/db/database';

export const handle: Handle = async ({ event, resolve }) => {
	return resolve(event);
}
