import { marked } from '$lib/client/marked';
import { db } from '$lib/db/database';
import { selectLocalizedField, type Language } from '$lib/db/schemas/0-utils';
import { error, type RequestEvent } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { sql } from 'kysely';
import { DEMO_CLIENTS } from '../migrations/1-dummy-data/2-demo-clients';


export const findOneClientByOrigin = async (origin: string) => {

  const client = await db.transaction().execute(async (trx) => {
    let client = await trx.selectFrom('client')
      .where((eb) => sql<boolean>`${eb.ref('client.domains')} @> ${JSON.stringify([origin])}`)
      .select([
        'client.id',
        'client.reference',
        'client.name',
        'client.logo',
        'client.favicon',
        'client.css',
        'client.manifest',
        'client.isFindableBySearchEngines',
        'client.plausibleDomain',
        'client.authenticationMethods',
        'client.accessTokenKey',
        'client.redirectAuthorized',
        'client.redirectUnauthorized',
        'client.accessTokenKey',
        'client.onboardingSchema'
      ])
      .executeTakeFirst();
    if (client) return client;

    const democlient = DEMO_CLIENTS.find(c => c.domains.includes(origin));

    if (democlient) {
      const existing = await trx.selectFrom('client').where('reference', '=', democlient.reference).select('id').executeTakeFirst();
      if (!existing) {
        try { client = await democlient.create(trx); }
        catch { console.warn(`Client already existed.`); }
      }
    }

    return client;
  });

  if (!client) error(404, 'Client not found');

  return client;
}

export const findOneClient = async (clientReference: string, language?: Language) => {

  const clientRaw = await db.selectFrom('client')
    .where('client.reference', '=', clientReference)
    .select((eb) => [
      'client.id',
      'client.reference',
      'client.name',
      'client.logo',
      selectLocalizedField(eb, 'client.description', language).as('description'),
    ])
    .executeTakeFirst();

  if (!clientRaw) error(404, 'Client not found');

  const client = { ...clientRaw, description: clientRaw.description ? await marked.parse(clientRaw.description) : null };
  return client;
}

export const findOneAuthenticatedUser = async (event: RequestEvent) => {
  const { url, locals, cookies } = event;

  const token = cookies.get('__session');
  if (!token) return undefined;

  try {
    const jwtu = jwt.verify(token, locals.client.accessTokenKey);
    if (typeof jwtu === 'string') throw new Error('Something went wrong');

    const user = await db
      .selectFrom('user')
      .where('id', '=', jwtu.id)
      .select((eb) => [
        'user.id',
        'user.email',
        'user.firstName',
        'user.lastName',
        eb.fn<string | null>('nullif', [eb.fn<string>('btrim', [eb.fn<string>('concat', ['user.firstName', eb.cast<string>(eb.val(' '), 'text'), 'user.lastName'])]), eb.val('')]).as('name'),
        eb.fn<string | null>('nullif', [eb.fn.coalesce(eb.fn<string | null>('left', ['user.firstName', eb.val(1)]), eb.fn<string>('left', ['user.lastName', eb.val(1)])), eb.val('')]).as('abbreviation'),
        'user.language',
        'user.picture',
        'user.roles',
        'user.isActive',
        eb.val(false).as('hasCompletedOnboarding'),
      ])
      .executeTakeFirst();

    if (!user) throw new Error('User not found');
    if (!user.isActive) throw new Error('User blocked');

    return user;
  } catch {
    cookies.delete('__session', { domain: url.hostname, path: '/' });
    return undefined;
  }
}
