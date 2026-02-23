import { db } from '$lib/db/database';
import { error, redirect } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import type { RequestHandler } from './$types';


export const GET = (async ({ url, params, cookies, locals }) => {
  const clientId = locals.client.id;

  const code = params.code || null;
  if (!code) error(404, 'De code bestaat niet (meer).');

  const user = await db.selectFrom('user')
    .leftJoin('authCode', 'authCode.userId', 'user.id')
    .select([
      'user.id',
      'user.isActive',
    ])
    .select((eb) => [
      jsonObjectFrom(
        eb.selectFrom('authCode as code')
          .select('code.id')
          .whereRef('code.id', '=', 'authCode.id')
      ).as('authCode')
    ])
    .where('user.clientId', '=', clientId)
    .where('authCode.clientId', '=', clientId)
    .where('authCode.value', '=', code)
    .executeTakeFirst();

  if (!user?.authCode?.id) error(404, 'De code is ongeldig.');
  if (!user.isActive) error(403, 'Dit account is geblokkeerd.');

  await db.updateTable('authCode').set({ usedAt: new Date() }).where('authCode.id', '=', user.authCode.id).returningAll().executeTakeFirst();

  const payload = { id: user.id };
  const token = jwt.sign(payload, locals.client.accessTokenKey, { expiresIn: '365d' });

  if (!token) error(422, 'Het token is ongeldig. Probeer opnieuw in te loggen.');
  const options = {
    expires: new Date(new Date().getTime() + (365 * 24 * 60 * 60 * 1000)),
    // sameSite: 'none' as "none",
    domain: url.hostname,
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  };
  cookies.set(process.env.NODE_ENV === 'production' ? '__session' : '__session_stories', token, options);

  throw redirect(302, '/edit/stories');
}) satisfies RequestHandler;
