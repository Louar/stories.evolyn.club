import { db } from '$lib/db/database';
import * as m from '$lib/paraglide/messages';
import { error, redirect } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import type { RequestHandler } from './$types';


export const GET = (async ({ url, params, cookies, locals }) => {
  const clientId = locals.client.id;

  const code = params.code || null;
  if (!code) error(404, m.auth_code_missing());

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

  if (!user?.authCode?.id) error(404, m.auth_code_invalid());
  if (!user.isActive) error(403, m.auth_account_blocked());

  await db.updateTable('authCode').set({ usedAt: new Date() }).where('authCode.id', '=', user.authCode.id).returningAll().executeTakeFirst();

  const payload = { id: user.id };
  const token = jwt.sign(payload, locals.client.accessTokenKey, { expiresIn: '365d' });

  if (!token) error(422, m.auth_login_token_invalid());
  const options = {
    expires: new Date(new Date().getTime() + (365 * 24 * 60 * 60 * 1000)),
    // sameSite: 'none' as "none",
    domain: url.hostname,
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  };
  cookies.set(process.env.NODE_ENV === 'production' ? '__session' : '__session_core', token, options);

  let r = '/';
  if (url.searchParams.get('r')?.length) r = url.searchParams.get('r')!;
  if (locals.client.redirectAuthorized?.length) r = locals.client.redirectAuthorized;
  throw redirect(302, r);
}) satisfies RequestHandler;
