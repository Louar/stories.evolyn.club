import { db } from '$lib/db/database';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const DELETE = (async ({ params }) => {

  await db.deleteFrom('part')
    .where('id', '=', params.partId)
    .executeTakeFirstOrThrow();

  return json({ success: true });
}) satisfies RequestHandler;
