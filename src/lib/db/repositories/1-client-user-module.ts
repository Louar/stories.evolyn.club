import { marked } from '$lib/client/marked';
import { db } from '$lib/db/database';
import type { Schema } from '$lib/db/schema';
import { selectLocalizedField, type Language, type Media, type Translatable } from '$lib/db/schemas/0-utils';
import { error, type RequestEvent } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { Transaction, sql } from 'kysely';
import { DEMO_CLIENTS } from '../migrations/1-dummy-data/2-demo-clients';
import { CampaignRegistration, GroupType, HoldingAssignment } from '../schemas/2-story-module';


export const findOneClientByOrigin = async (origin: string) => {

  const client = await db.transaction().execute(async (trx) => {
    let client = await trx.selectFrom('client')
      .leftJoin('campaign as defaultCampaign', 'defaultCampaign.id', 'client.defaultCampaignId')
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
        'client.onboardingSchema',
        'defaultCampaign.reference as defaultCampaignReference'
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
    .leftJoin('campaign as defaultCampaign', 'defaultCampaign.id', 'client.defaultCampaignId')
    .where('client.reference', '=', clientReference)
    .select((eb) => [
      'client.id',
      'client.reference',
      'client.name',
      'client.logo',
      selectLocalizedField(eb, 'client.description', language).as('description'),
      'defaultCampaign.reference as defaultCampaignReference'
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

export const createCampaign = async (trx: Transaction<Schema>, input: {
  clientId: string,
  userId: string,
  reference: string;
  name: string;
  description: string;
  image?: Media;
  registration?: CampaignRegistration;
  consentItems?: (string | string[])[];
}) => {

  const {
    clientId,
    userId,
    reference,
    name,
    description,
    image,
    registration = CampaignRegistration.allowed,
    consentItems,
  } = input;

  const campaign = await trx.insertInto('campaign')
    .values({
      clientId,
      reference,
      name: JSON.stringify({ default: name } as Translatable),
      description: JSON.stringify({ default: description } as Translatable),
      image: JSON.stringify(image),
      isPublished: true,
      registration,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  // Set editors of default Campaign
  await trx.insertInto('campaignEditor')
    .values({
      campaignId: campaign.id,
      userId,
    })
    .executeTakeFirstOrThrow();

  // Set Consent Items
  if (consentItems?.length) {
    for (const [i, item] of consentItems.entries()) {
      let consentItemOptionId: string | null = null;
      let name: string | null = null;
      let description: string | null = null;

      if (Array.isArray(item)) {
        name = item[0];
        description = item[1];
      } else {
        if (item.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) consentItemOptionId = item;
        else name = item;
      }

      await trx.insertInto('consentItem')
        .values({
          campaignId: campaign.id,
          order: i + 1,
          name: JSON.stringify({ default: name } as Translatable),
          description: JSON.stringify({ default: description } as Translatable),
          consentItemOptionId,
        })
        .executeTakeFirstOrThrow();
    }
  }

  // Set a default Wave for the default Campaign
  const wave = await trx.insertInto('wave')
    .values({
      campaignId: campaign.id,
      order: 0,
      name: 'Forever',
      participantsAreAllowedToEnrollInMissions: true,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  // Create a default Holding for the default Group of the default Campaign
  const holding = await trx.insertInto('holding')
    .values({
      name: `${name}`,
      assignment: HoldingAssignment.everyone,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  // Set a default Group for the default Campaign
  const group = await trx.insertInto('group')
    .values({
      campaignId: campaign.id,
      childOfHoldingId: holding.id,
      reference: `${reference}`,
      name: `${name}`,
      type: GroupType.campaign,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  return { campaignId: campaign.id, waveId: wave.id, holdingId: holding.id, groupId: group.id };
};
