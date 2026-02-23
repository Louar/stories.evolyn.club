import { db } from '$lib/db/database';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (async ({ locals }) => {
  const clientId = locals.client.id;

  const users = await db
    .selectFrom('user')
    .where('user.clientId', '=', clientId)
    .select((eb) => [
      'user.id',
      'user.clientId',
      'user.email',
      'user.firstName',
      'user.lastName',
      'user.picture',
      eb
        .case()
        .when('user.password', 'is not', null)
        .then(eb.val('••••••••'))
        .else(null)
        .end()
        .as('password'),
      'user.roles',
      'user.language',
      'user.pronouns',
      'user.address',
      'user.dateOfBirth',
      'user.emailConfirmed',
      'user.emailConfirmCode',
      'user.passwordResetCode',
      'user.passwordResetExpiresAt',
      'user.isActive',
      'user.reasonForDeactivation',
      'user.createdAt',
      'user.updatedAt',
      jsonObjectFrom(
        eb.selectFrom('user as usr')
          .whereRef('usr.id', '=', 'user.createdBy')
          .select((eb) => [
            'usr.id',
            eb.fn<string | null>('nullif', [eb.fn<string>('btrim', [eb.fn<string>('concat', ['usr.firstName', eb.cast<string>(eb.val(' '), 'text'), 'usr.lastName'])]), eb.val('')]).as('label'),
            'usr.picture as image',
          ])
      ).as('createdBy'),
      jsonObjectFrom(
        eb.selectFrom('user as usr')
          .whereRef('usr.id', '=', 'user.updatedBy')
          .select((eb) => [
            'usr.id',
            eb.fn<string | null>('nullif', [eb.fn<string>('btrim', [eb.fn<string>('concat', ['usr.firstName', eb.cast<string>(eb.val(' '), 'text'), 'usr.lastName'])]), eb.val('')]).as('label'),
            'usr.picture as image',
          ])
      ).as('updatedBy'),
    ])
    .orderBy('user.id')
    .execute();

  return { users };
});
