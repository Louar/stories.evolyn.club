import { db } from '$lib/db/database';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { redirect, type Cookies } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sql } from 'kysely';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { PageServerLoad } from './$types';
import { schemaToAuthenticate, schemaToRegister } from './schemas';


export const load: PageServerLoad = async () => {

  const formToRegister = await superValidate({}, zod4(schemaToRegister), { errors: false });
  const formToAuthenticate = await superValidate({}, zod4(schemaToAuthenticate), { errors: false });

  return { formToRegister, formToAuthenticate };
};

export const actions = {
  authenticate: async ({ request, cookies, locals, url }) => {
    const form = await superValidate(request, zod4(schemaToAuthenticate));
    if (!form.valid) return message(form, { error: true, reason: 'Oeps, inloggen mislukt. Probeer het nog eens.' });

    const { email, password } = form.data;

    try {
      delete locals.authusr;
      cookies.delete('__session', { domain: url.hostname, path: '/' });
      await authenticate(email, password, url.hostname, locals, cookies);
    } catch (e) {
      if (e instanceof Error) return message(form, { error: true, reason: e.message });
      else return message(form, { error: true, reason: 'Oeps, inloggen mislukt. Probeer het nog eens.' });
    }

    throw redirect(302, '/editor/stories');
  },
  register: async ({ request, cookies, url, locals }) => {
    const clientId = locals.client.id;
    const form = await superValidate(request, zod4(schemaToRegister));
    if (!form.valid) return message(form, { error: true, reason: 'Registration failed.' });

    const { email, password, firstName, lastName } = form.data;

    const user = await db.selectFrom('user')
      .select('id')
      .where('clientId', '=', clientId)
      .where('email', '=', email)
      .executeTakeFirst();
    if (user) return message(form, { error: true, reason: 'An account already exists for this email address.' });

    const roles: UserRole[] = [UserRole.user];
    if (((await db.selectFrom('user').where('clientId', '=', clientId).select(sql`COUNT(*)`.as('count')).executeTakeFirst())?.count || 0) === 0) roles.push(UserRole.admin);

    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(password, salt);

    try {
      await db.insertInto('user')
        .values({
          clientId,
          email,
          password: `{bcrypt}${hash}`,
          firstName,
          lastName,
          roles: JSON.stringify(roles),
        })
        .executeTakeFirstOrThrow();
    } catch (e) {
      if (e instanceof Error) return message(form, { error: true, reason: e.message });
      else return message(form, { error: true, reason: 'Oeps, registreren mislukt. Probeer het nog eens.' });
    }

    // Authenticate
    try {
      await authenticate(email, password, url.hostname, locals, cookies);
    } catch (e) {
      if (e instanceof Error) return message(form, { error: true, reason: e.message });
      else return message(form, { error: true, reason: 'Oeps, registreren mislukt. Probeer het nog eens.' });
    }

    throw redirect(302, '/editor/stories');
  }
};

const authenticate = async (email: string, password: string, hostname: string, locals: App.Locals, cookies: Cookies) => {

  const clientId = locals.client.id;
  const accessTokenKey = locals.client.accessTokenKey;

  const user = await db.selectFrom('user')
    .select([
      'user.id',
      'user.password',
      'user.isActive',
    ])
    .where('user.clientId', '=', clientId)
    .where('user.email', '=', email)
    .executeTakeFirst();
  if (!user?.password || !(await bcrypt.compare(password, user.password?.replace('{bcrypt}', '')))) throw Error('Deze inloggegevens zijn onjuist. Probeer het nog eens.');
  if (!user?.isActive) throw Error('Jammer, je account is geblokkeerd.');

  const payload = { id: user.id };
  const token = jwt.sign(payload, accessTokenKey, { expiresIn: '365d' });

  if (!token) throw Error('Invalid token.');
  const options = {
    expires: new Date(new Date().getTime() + (365 * 24 * 60 * 60 * 1000)),
    // sameSite: 'none' as "none",
    domain: hostname,
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  };
  if (cookies) cookies.set('__session', token, options);

  return { id: user.id };
};
