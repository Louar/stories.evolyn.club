import { db } from '$lib/db/database';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (async () => {
  const clients = await db
    .selectFrom('client')
    .select((eb) => [
      'client.id',
      'client.reference',
      'client.name',
      'client.description',
      'client.domains',
      'client.logo',
      'client.favicon',
      'client.splash',
      'client.hero',
      'client.css',
      'client.manifest',
      'client.isFindableBySearchEngines',
      'client.plausibleDomain',
      'client.authenticationMethods',
      'client.accessTokenKey',
      'client.redirectAuthorized',
      'client.redirectUnauthorized',
      'client.onboardingSchema',
      'client.createdAt',
      'client.updatedAt',
      jsonObjectFrom(
        eb.selectFrom('user')
          .whereRef('user.id', '=', 'client.createdBy')
          .select((eb) => [
            'user.id',
            eb.fn<string | null>('nullif', [eb.fn<string>('btrim', [eb.fn<string>('concat', ['user.firstName', eb.cast<string>(eb.val(' '), 'text'), 'user.lastName'])]), eb.val('')]).as('label'),
            'user.picture as image',
          ])
      ).as('createdBy'),
      jsonObjectFrom(
        eb.selectFrom('user')
          .whereRef('user.id', '=', 'client.updatedBy')
          .select((eb) => [
            'user.id',
            eb.fn<string | null>('nullif', [eb.fn<string>('btrim', [eb.fn<string>('concat', ['user.firstName', eb.cast<string>(eb.val(' '), 'text'), 'user.lastName'])]), eb.val('')]).as('label'),
            'user.picture as image',
          ])
      ).as('updatedBy'),
    ])
    .orderBy('client.id')
    .execute();

  return { clients };
});
