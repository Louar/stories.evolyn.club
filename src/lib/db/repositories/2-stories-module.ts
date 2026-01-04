import { marked } from '$lib/client/marked';
import { db } from '$lib/db/database';
import type { Schema } from '$lib/db/schema';
import { MENU_ITEM_WIDGETS, MenuItemWidgetReference } from '$lib/states/menu.svelte';
import { error } from '@sveltejs/kit';
import { Transaction, type Insertable } from 'kysely';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';
import { z } from 'zod/v4';
import { selectLocalizedField, type Language } from '../schemas/0-utils';
import { GroupType, HoldingAssignment, MembershipRequestStatus, MembershipRoleReference, MenuItemSlot } from '../schemas/2-story-module';
import { findMissionsWithActiveWaveOfMember } from './5-mission-module';
import { findOneChatAssistantByReferenceWithChatsByUser } from './6-chat-module';


export const findActiveCampaignExists = async (clientId: string, campaignReference: string) => {

  if (!clientId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) error(404, 'De client-ID is ongeldig.');

  const now = new Date();

  const campaign = await db
    .selectFrom('campaign')
    .leftJoin('wave', 'wave.campaignId', 'campaign.id')
    .where('campaign.clientId', '=', clientId)
    .where('campaign.reference', '=', campaignReference)
    .where('campaign.isPublished', '=', true)
    .where((eb) =>
      eb.or([
        eb.and([
          eb('wave.start', 'is', null),
          eb('wave.end', 'is', null)
        ]),
        eb.and([
          eb('wave.start', '<', now),
          eb.or([
            eb('wave.end', '>', now),
            eb('wave.end', 'is', null)
          ])
        ]),
        eb.and([
          eb('wave.end', '>', now),
          eb.or([
            eb('wave.start', '<', now),
            eb('wave.start', 'is', null)
          ])
        ])
      ])
    )
    .select('campaign.id')
    .executeTakeFirst();

  return campaign;
}

export const findOneActiveCampaign = async (clientId: string, campaignReference: string, language?: Language) => {

  if (!clientId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) error(404, 'De client-ID is ongeldig.');

  const now = new Date();

  const campaign = await db
    .selectFrom('campaign')
    .leftJoin('wave', 'wave.campaignId', 'campaign.id')
    .where('campaign.clientId', '=', clientId)
    .where('campaign.reference', '=', campaignReference)
    .where('campaign.isPublished', '=', true)
    .where((eb) =>
      eb.or([
        eb.and([
          eb('wave.start', 'is', null),
          eb('wave.end', 'is', null)
        ]),
        eb.and([
          eb('wave.start', '<', now),
          eb.or([
            eb('wave.end', '>', now),
            eb('wave.end', 'is', null)
          ])
        ]),
        eb.and([
          eb('wave.end', '>', now),
          eb.or([
            eb('wave.start', '<', now),
            eb('wave.start', 'is', null)
          ])
        ])
      ])
    )
    .select((eb) => [
      'campaign.id',
      'campaign.reference',
      selectLocalizedField(eb, 'campaign.name', language).as('name'),
      'campaign.image',
      'campaign.hero',
      selectLocalizedField(eb, 'campaign.summary', language).as('summary'),
      selectLocalizedField(eb, 'campaign.description', language).as('description'),
      'campaign.isPublished',
      'campaign.isPublic',
      'campaign.registration',
    ])
    .executeTakeFirst();

  if (!campaign) error(404, 'Campagne onbekend.');

  if (campaign?.summary?.length) campaign.summary = await marked.parse(campaign.summary);
  if (campaign?.description?.length) campaign.description = await marked.parse(campaign.description);

  return campaign;
}

export const evaluateCampaignConsent = async (clientId: string, campaignReference: string, uid: string, language?: Language) => {

  if (!clientId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) error(404, 'De client-ID is ongeldig.');

  const consentItems = await db
    .selectFrom('consentItem')
    .leftJoin('consentItemOption', 'consentItemOption.id', 'consentItem.consentItemOptionId')
    .leftJoin('campaign', 'campaign.id', 'consentItem.campaignId')
    .where('campaign.reference', '=', campaignReference)
    .where('campaign.clientId', '=', clientId)
    .select((eb) => [
      'consentItem.id',
      'consentItem.order',
      // selectLocalizedField(eb, 'consentItem.name', language).as('name'),
      eb.fn.coalesce(selectLocalizedField(eb, 'consentItem.name', language), selectLocalizedField(eb, 'consentItemOption.name', language)).as('name'),
      eb.fn.coalesce(selectLocalizedField(eb, 'consentItem.description', language), selectLocalizedField(eb, 'consentItemOption.description', language)).as('description'),
      'consentItem.isRequired',
    ])
    .select(({ selectFrom }) => [
      selectFrom('consentItemApproval')
        .whereRef('consentItemApproval.consentItemId', '=', 'consentItem.id')
        .where('consentItemApproval.userId', '=', uid ?? null)
        .select('consentItemApproval.isApproved').as('isApproved')
    ])
    .orderBy('consentItem.order', 'asc')
    .execute();

  return consentItems;
}

export const evaluateCampaignGroupParticipations = async (clientId: string, campaignReference: string, uid: string) => {

  if (!clientId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) error(404, 'De client-ID is ongeldig.');

  const holdings = await db
    .selectFrom('holding')
    .leftJoin('group as g', 'g.childOfHoldingId', 'holding.id')
    .leftJoin('campaign', 'campaign.id', 'g.campaignId')
    .where('campaign.reference', '=', campaignReference)
    .where('campaign.clientId', '=', clientId)
    .select([
      'holding.id',
      'holding.name',
      'holding.description',
      'holding.allowEnrollmentInMultipleGroups',
      'holding.requiresEnrollment',
    ])
    .select((eb) =>
      jsonObjectFrom(
        eb.selectFrom('holding as parent')
          .whereRef('parent.id', '=', 'g.parentOfHoldingId')
          .select([
            'parent.id',
            'parent.name',
          ])
      ).as('parent')
    )
    .select((eb) => jsonArrayFrom(
      eb.selectFrom('group')
        .whereRef('group.childOfHoldingId', '=', 'holding.id')
        .select([
          'group.id',
          'group.reference',
          'group.name',
          'group.image',
          'group.description',
          'group.type',
          'group.image',
        ])
        .select(({ selectFrom, eb }) => {
          const isMember = eb.exists(
            selectFrom('membership')
              .whereRef('membership.groupId', '=', 'group.id')
              .where('membership.userId', '=', uid ?? null)
          );
          return [
            eb.cast<boolean>(isMember, 'boolean').as('isMember'),
          ];
        })
        .select(({ selectFrom, eb }) => {
          const hasMembershipRequested = eb.exists(
            selectFrom('membershipRequest')
              .whereRef('membershipRequest.groupId', '=', 'group.id')
              .where('membershipRequest.userId', '=', uid ?? null)
              .where('membershipRequest.status', '=', MembershipRequestStatus.pending)
          );
          return [
            eb.cast<boolean>(hasMembershipRequested, 'boolean').as('hasMembershipRequested'),
          ];
        })
    ).as('groups'))
    .distinctOn('holding.id')
    .execute();

  return holdings;
}

export const findActivePublicCampaignsByClient = async (clientId: string, language?: Language) => {

  if (!clientId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) error(404, 'De client-ID is ongeldig.');

  const now = new Date();
  const activeCampaigns = await db
    .selectFrom('campaign')
    .leftJoin('wave', 'wave.campaignId', 'campaign.id')
    .select((eb) => [
      'campaign.id',
      'campaign.reference',
      selectLocalizedField(eb, 'campaign.name', language).as('name'),
      'campaign.image',
      selectLocalizedField(eb, 'campaign.summary', language).as('summary'),
    ])
    .where((eb) =>
      eb.or([
        eb.and([
          eb('wave.start', 'is', null),
          eb('wave.end', 'is', null)
        ]),
        eb.and([
          eb('wave.start', '<', now),
          eb.or([
            eb('wave.end', '>', now),
            eb('wave.end', 'is', null)
          ])
        ]),
        eb.and([
          eb('wave.end', '>', now),
          eb.or([
            eb('wave.start', '<', now),
            eb('wave.start', 'is', null)
          ])
        ])
      ])
    )
    .where('campaign.clientId', '=', clientId)
    .where('campaign.isPublished', '=', true)
    .where('campaign.isPublic', '=', true)
    .orderBy('campaign.createdAt', 'desc')
    .execute();

  return activeCampaigns;
}

export const findActiveCampaignsOfUserByClient = async (clientId: string, uid: string, language?: Language) => {

  if (!clientId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) error(404, 'De client-ID is ongeldig.');

  const now = new Date();
  const activeCampaigns = await db
    .selectFrom('campaign')
    .leftJoin('wave', 'wave.campaignId', 'campaign.id')
    .leftJoin('group', 'group.campaignId', 'campaign.id')
    .leftJoin('membership', 'membership.groupId', 'group.id')
    .select((eb) => [
      'campaign.id',
      'campaign.reference',
      selectLocalizedField(eb, 'campaign.name', language).as('name'),
      'campaign.image',
      selectLocalizedField(eb, 'campaign.summary', language).as('summary'),
    ])
    .where((eb) =>
      eb.or([
        eb.and([
          eb('wave.start', 'is', null),
          eb('wave.end', 'is', null)
        ]),
        eb.and([
          eb('wave.start', '<', now),
          eb.or([
            eb('wave.end', '>', now),
            eb('wave.end', 'is', null)
          ])
        ]),
        eb.and([
          eb('wave.end', '>', now),
          eb.or([
            eb('wave.start', '<', now),
            eb('wave.start', 'is', null)
          ])
        ])
      ])
    )
    .where('campaign.clientId', '=', clientId)
    .where('campaign.isPublished', '=', true)
    .where('membership.userId', '=', uid)
    .groupBy('campaign.id')
    .orderBy('campaign.createdAt', 'desc')
    .execute();

  return activeCampaigns;
}

export const findOneActiveCampaignUserLastEnrolledInByClient = async (clientId: string, uid: string | null, language?: Language) => {

  if (!clientId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) error(404, 'De client-ID is ongeldig.');
  if (!uid) error(404, 'Dit account bestaat niet (meer). Probeer opnieuw in te loggen.');

  const now = new Date();
  const activeCampaignLastEnrolledIn = await db
    .selectFrom('campaign')
    .leftJoin('wave', 'wave.campaignId', 'campaign.id')
    .leftJoin('group', 'group.campaignId', 'campaign.id')
    .leftJoin('membership', 'membership.groupId', 'group.id')
    .select((eb) => [
      'campaign.id',
      'campaign.reference',
      selectLocalizedField(eb, 'campaign.name', language).as('name'),
      'campaign.image',
      db.fn.min('membership.createdAt').as('earliestEnrollment'),
    ])
    .where((eb) =>
      eb.or([
        eb.and([
          eb('wave.start', 'is', null),
          eb('wave.end', 'is', null)
        ]),
        eb.and([
          eb('wave.start', '<', now),
          eb.or([
            eb('wave.end', '>', now),
            eb('wave.end', 'is', null)
          ])
        ]),
        eb.and([
          eb('wave.end', '>', now),
          eb.or([
            eb('wave.start', '<', now),
            eb('wave.start', 'is', null)
          ])
        ])
      ])
    )
    .where('campaign.clientId', '=', clientId)
    .where('membership.userId', '=', uid)
    .groupBy('campaign.id')
    .orderBy('earliestEnrollment', 'desc') // Sort by latest earliestEnrollment
    .limit(1)
    .executeTakeFirst();

  return activeCampaignLastEnrolledIn;
}

const enrollInCampaign = async (campaignId: string, uid: string) => {
  const groups = await db.selectFrom('group')
    .leftJoin('holding', 'holding.id', 'group.childOfHoldingId')
    .select('group.id')
    .where('group.type', '=', GroupType.campaign)
    .where('holding.assignment', '=', HoldingAssignment.everyone)
    .where('group.campaignId', '=', campaignId)
    .execute();

  for (const group of groups) {
    await db.insertInto('membership')
      .values({
        groupId: group.id,
        userId: uid,
        membershipRoleReference: MembershipRoleReference.member,
        createdBy: uid,
        updatedBy: uid,
      })
      .executeTakeFirst()
  }
}

export const enrollInCampaignOfClient = async (clientId: string, campaignReference: string, uid: string | null, language?: Language) => {

  if (!clientId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) error(404, 'De client-ID is ongeldig.');
  if (!uid) error(404, 'Dit account bestaat niet (meer). Probeer opnieuw in te loggen.');

  const now = new Date();

  const campaignToEnrollIn = await db.selectFrom('campaign')
    .leftJoin('wave', 'wave.campaignId', 'campaign.id')
    .leftJoin('group', 'group.campaignId', 'campaign.id')
    .leftJoin('membership', (join) =>
      join
        .onRef('membership.groupId', '=', 'group.id')
        .on('membership.userId', '=', uid)
    )
    .select((eb) => [
      'campaign.id',
      'campaign.reference',
      selectLocalizedField(eb, 'campaign.name', language).as('name'),
      'campaign.createdAt',
      eb.fn.count<number>('membership.groupId').as('membershipCount'),
    ])
    .where('campaign.clientId', '=', clientId)
    .where('campaign.reference', '=', campaignReference)
    .where('campaign.isPublished', '=', true)
    .where((eb) =>
      eb.or([
        eb.and([
          eb('wave.start', 'is', null),
          eb('wave.end', 'is', null)
        ]),
        eb.and([
          eb('wave.start', '<', now),
          eb.or([
            eb('wave.end', '>', now),
            eb('wave.end', 'is', null)
          ])
        ]),
        eb.and([
          eb('wave.end', '>', now),
          eb.or([
            eb('wave.start', '<', now),
            eb('wave.start', 'is', null)
          ])
        ])
      ])
    )
    .orderBy('campaign.createdAt', 'asc')
    .groupBy('campaign.id')
    .executeTakeFirst();

  if (!campaignToEnrollIn?.id) error(404, 'Deze campagne bestaat niet (meer).');

  if (!campaignToEnrollIn.membershipCount) await enrollInCampaign(campaignToEnrollIn.id, uid);

  return campaignToEnrollIn;
}

export const enrollInDefaultCampaignOfClient = async (clientId: string, uid: string | null, language?: Language) => {

  if (!clientId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) error(404, 'De client-ID is ongeldig.');
  if (!uid) error(404, 'Dit account bestaat niet (meer). Probeer opnieuw in te loggen.');

  const now = new Date();
  const campaignToEnrollIn = await db.selectFrom('client')
    .leftJoin('campaign', 'campaign.id', 'client.defaultCampaignId')
    .leftJoin('wave', 'wave.campaignId', 'campaign.id')
    .leftJoin('group', 'group.campaignId', 'campaign.id')
    .leftJoin('membership', (join) =>
      join
        .onRef('membership.groupId', '=', 'group.id')
        .on('membership.userId', '=', uid)
    )
    .select((eb) => [
      'campaign.id',
      'campaign.reference',
      selectLocalizedField(eb, 'campaign.name', language).as('name'),
      'campaign.createdAt',
    ])
    .where('client.id', '=', clientId)
    .where('campaign.isPublished', '=', true)
    .where((eb) =>
      eb.or([
        eb.and([
          eb('wave.start', 'is', null),
          eb('wave.end', 'is', null)
        ]),
        eb.and([
          eb('wave.start', '<', now),
          eb.or([
            eb('wave.end', '>', now),
            eb('wave.end', 'is', null)
          ])
        ]),
        eb.and([
          eb('wave.end', '>', now),
          eb.or([
            eb('wave.start', '<', now),
            eb('wave.start', 'is', null)
          ])
        ])
      ])
    )
    .orderBy('campaign.createdAt', 'asc')
    .groupBy('campaign.id')
    .having((eb) => eb.fn.count('membership.groupId'), '=', 0)
    .executeTakeFirst();

  if (!campaignToEnrollIn?.id) return null;

  await enrollInCampaign(campaignToEnrollIn.id, uid);

  return campaignToEnrollIn;
}

export const findOneMenuItem = async (campaignReference: string, menuItemReference: string) => {

  const menuItem = await db
    .selectFrom('menuItem')
    .leftJoin('menuItemPerWave', 'menuItemPerWave.menuItemId', 'menuItem.id')
    .leftJoin('wave', 'wave.id', 'menuItemPerWave.waveId')
    .leftJoin('campaign', 'campaign.id', 'wave.campaignId')
    .where('campaign.reference', '=', campaignReference)
    .where('menuItem.reference', '=', menuItemReference)
    .select([
      'menuItem.id',
      'menuItem.reference',
      'menuItem.name',
      'menuItem.widget',
      'menuItem.configuration',
    ])
    .executeTakeFirst();

  return menuItem;
}

export const findFirstMenuItemOfCampaignForUser = async (clientId: string, campaignReference: string, uid: string) => {

  if (!clientId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) error(404, 'De client-ID is ongeldig.');

  const now = new Date();

  const menuItem = await db
    .selectFrom('menuItem')
    .leftJoin('menuItemPerWave', 'menuItemPerWave.menuItemId', 'menuItem.id')
    .leftJoin('wave', 'wave.id', 'menuItemPerWave.waveId')
    .leftJoin('campaign as campaignOfWave', 'campaignOfWave.id', 'wave.campaignId')
    .leftJoin('client', 'client.id', 'campaignOfWave.clientId')
    .leftJoin('menuItemIncludedPerGroup', 'menuItemIncludedPerGroup.menuItemId', 'menuItem.id')
    .leftJoin('group', 'group.id', 'menuItemIncludedPerGroup.groupId')
    .leftJoin('membership', 'membership.groupId', 'group.id')
    .where('client.id', '=', clientId)
    .where('campaignOfWave.reference', '=', campaignReference)
    .where('membership.userId', '=', uid)
    .where('menuItem.slot', '=', MenuItemSlot.center)
    .where((eb) =>
      eb.not(
        eb.exists(
          eb.selectFrom('menuItemExcludedPerGroup')
            .whereRef('menuItemExcludedPerGroup.menuItemId', '=', 'menuItem.id')
            .leftJoin('group as g', 'g.id', 'menuItemExcludedPerGroup.groupId')
            .leftJoin('membership as m', 'm.groupId', 'g.id')
            .where('m.userId', '=', uid)
            .select('menuItemExcludedPerGroup.id')
        )
      )
    )
    .where((eb) =>
      eb.or([
        eb.and([
          eb('wave.start', 'is', null),
          eb('wave.end', 'is', null)
        ]),
        eb.and([
          eb('wave.start', '<', now),
          eb.or([
            eb('wave.end', '>', now),
            eb('wave.end', 'is', null)
          ])
        ]),
        eb.and([
          eb('wave.end', '>', now),
          eb.or([
            eb('wave.start', '<', now),
            eb('wave.start', 'is', null)
          ])
        ])
      ])
    )
    .select([
      'menuItem.id',
      'menuItem.reference',
      'menuItem.widget',
      'menuItem.slot',
      'menuItem.order',
      'menuItem.configuration',
    ])
    .orderBy('menuItem.slot', 'asc')
    .orderBy('menuItem.order', 'asc')
    .orderBy('menuItem.updatedAt', 'desc')
    .limit(1)
    .executeTakeFirst();

  return menuItem;
}

export const findMenuItemsOfCampaignForUser = async (clientId: string, campaignReference: string, uid: string, language?: Language) => {

  if (!clientId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) error(404, 'De client-ID is ongeldig.');

  const now = new Date();

  const items = await db
    .selectFrom('menuItem')
    .leftJoin('menuItemPerWave', 'menuItemPerWave.menuItemId', 'menuItem.id')
    .leftJoin('wave', 'wave.id', 'menuItemPerWave.waveId')
    .leftJoin('campaign as campaignOfWave', 'campaignOfWave.id', 'wave.campaignId')
    .leftJoin('client', 'client.id', 'campaignOfWave.clientId')
    .leftJoin('menuItemIncludedPerGroup', 'menuItemIncludedPerGroup.menuItemId', 'menuItem.id')
    .leftJoin('group', 'group.id', 'menuItemIncludedPerGroup.groupId')
    .leftJoin('membership', 'membership.groupId', 'group.id')
    .where('client.id', '=', clientId)
    .where('campaignOfWave.reference', '=', campaignReference)
    .where('membership.userId', '=', uid)
    .where((eb) =>
      eb.not(
        eb.exists(
          eb.selectFrom('menuItemExcludedPerGroup')
            .whereRef('menuItemExcludedPerGroup.menuItemId', '=', 'menuItem.id')
            .leftJoin('group as g', 'g.id', 'menuItemExcludedPerGroup.groupId')
            .leftJoin('membership as m', 'm.groupId', 'g.id')
            .where('m.userId', '=', uid)
            .select('menuItemExcludedPerGroup.id')
        )
      )
    )
    .where((eb) =>
      eb.or([
        eb.and([
          eb('wave.start', 'is', null),
          eb('wave.end', 'is', null)
        ]),
        eb.and([
          eb('wave.start', '<', now),
          eb.or([
            eb('wave.end', '>', now),
            eb('wave.end', 'is', null)
          ])
        ]),
        eb.and([
          eb('wave.end', '>', now),
          eb.or([
            eb('wave.start', '<', now),
            eb('wave.start', 'is', null)
          ])
        ])
      ])
    )
    .select([
      'menuItem.id',
      'menuItem.reference',
      'menuItem.widget',
      'menuItem.slot',
      'menuItem.order',
      'menuItem.configuration',
    ])
    .orderBy('menuItem.slot', 'asc')
    .orderBy('menuItem.order', 'asc')
    .orderBy('menuItem.updatedAt', 'desc')
    .execute();

  const itemsWithWidget = items.flatMap((item) => {
    const widget = MENU_ITEM_WIDGETS.find(widget => widget.reference === item.widget) || null;
    return widget ? { ...item, widget } : [];
  }).filter((item) => item.widget);


  // ******************************** //
  // EFFICIENTLY FETCH MENU ITEM DATA //
  // ******************************** //
  // Group items by their data requirements to avoid duplicate fetches
  const datarequests: {
    datakey: string;
    entity: 'campaigns' | 'missions' | 'chats' | null;
    parameters?: {
      excludedMissionReferences?: string[] | null;
      chatAssistantReference?: string | null;
      showHistory?: boolean;
    },
    data?: unknown;
  }[] = [];
  const menuItemsWithoutStates = itemsWithWidget.map(({ id, reference, configuration: rawConfiguration, widget, ...rest }) => {
    const w = widget.reference;

    const settings = widget.settings || z.object({}).nullish();
    const validation = settings.safeParse(rawConfiguration);
    if (!validation.success) error(422, `Menu item ${reference} (${w}) is missing required configuration attributes:\n\n${z.prettifyError(validation.error)}`);
    const configuration = validation.data;

    // Determine data requirements for this widget
    let entity: typeof datarequests[number]['entity'] = null;
    let parameters: typeof datarequests[number]['parameters'] = undefined;
    if (w === MenuItemWidgetReference.campaignSwitcher) {
      entity = 'campaigns';
    }
    else if (w === MenuItemWidgetReference.listOfActiveMissions
      || w === MenuItemWidgetReference.leaderboardsForListOfActiveMissions
      || w === MenuItemWidgetReference.singleLatestActiveMission
      || w === MenuItemWidgetReference.singleLeaderboardOfLatestActiveMission
    ) {
      const excludedMissionReferences = (configuration as z.infer<
        Extract<
          (typeof MENU_ITEM_WIDGETS)[number],
          { reference: typeof MenuItemWidgetReference.listOfActiveMissions | typeof MenuItemWidgetReference.leaderboardsForListOfActiveMissions | typeof MenuItemWidgetReference.singleLatestActiveMission | typeof MenuItemWidgetReference.singleLeaderboardOfLatestActiveMission }
        >['settings']
      >)?.excludedMissionReferences || null;
      entity = 'missions';
      parameters = { excludedMissionReferences };
    }
    else if (w === MenuItemWidgetReference.listOfChats) {
      const { assistant: chatAssistantReference = null, showHistory = true } = (configuration as z.infer<
        Extract<
          (typeof MENU_ITEM_WIDGETS)[number],
          { reference: typeof MenuItemWidgetReference.listOfChats }
        >['settings']
      >);
      entity = 'chats';
      parameters = { chatAssistantReference, showHistory };
    }
    const datakey = JSON.stringify({ entity, parameters });
    datarequests.push({ datakey, entity, parameters });

    return { id, reference, datakey, widget: w, ...rest, configuration };
  });

  // Fetch data for each unique requirement
  const datapromises = [];
  const datakeysofdatapromises: string[] = [];
  for (const datarequest of datarequests) {
    const { datakey, entity, parameters } = datarequest;

    if (datakeysofdatapromises.includes(datakey)) continue;

    if (entity === 'campaigns') {
      const datapromise = findActiveCampaignsOfUserByClient(clientId, uid, language)
        .then(campaigns => ({ datakey, data: { campaigns } }));
      datapromises.push(datapromise);
    }
    else if (entity === 'missions') {
      const excludedMissionReferences = parameters?.excludedMissionReferences || null;
      const datapromise = findMissionsWithActiveWaveOfMember(clientId, uid, campaignReference, excludedMissionReferences, language)
        .then(missions => ({ datakey, data: { missions } }));
      datapromises.push(datapromise);
    }
    else if (entity === 'chats') {
      const chatAssistantReference = parameters!.chatAssistantReference!;
      const showHistory = parameters!.showHistory!;
      const datapromise = findOneChatAssistantByReferenceWithChatsByUser(clientId, chatAssistantReference, uid, showHistory)
        .then(assistant => ({ datakey, data: { assistant } }));
      datapromises.push(datapromise);
    }
    datakeysofdatapromises.push(datakey);
  }
  const dataresponses = await Promise.all(datapromises);

  // Append data to menuItems
  const menuItemsWithStates = menuItemsWithoutStates.map(({ datakey: dkey, ...rest }) => {
    const w = rest.widget;
    const dataresponse = dataresponses.find(({ datakey }) => datakey === dkey);

    if (dataresponse?.data && 'missions' in dataresponse.data
      && (w === MenuItemWidgetReference.singleLatestActiveMission
        || w === MenuItemWidgetReference.singleLeaderboardOfLatestActiveMission)) {
      return { ...rest, data: { mission: dataresponse.data.missions?.[0] ?? null } };
    }
    return { ...rest, data: dataresponse?.data };
  });

  return menuItemsWithStates;
}

export const createWaves = async (trx: Transaction<Schema>, input: {
  userId: string;
  campaignId: string;
  waves: (Omit<Insertable<Schema['wave']>, 'id' | 'campaignId' | 'createdBy' | 'updatedBy'>)[];
}) => {

  const {
    userId,
    campaignId,
    waves,
  } = input;

  const waveIds = [];
  for (const waveRaw of waves) {
    const wave = await trx.insertInto('wave')
      .values({
        campaignId,
        ...waveRaw,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    waveIds.push(wave.id);
  }
  return { waveIds };
};

export const createGroups = async (trx: Transaction<Schema>, input: {
  userId: string;
  campaignId: string;
  childOfHoldingId?: string;
  holding?: Omit<Insertable<Schema['holding']>, 'assignment'> & { assignment?: HoldingAssignment };
  parentOfHoldingId?: string;
  groups: (Omit<Insertable<Schema['group']>, 'campaignId' | 'childOfHoldingId' | 'type'> & { type?: GroupType })[];
}) => {

  const {
    userId,
    campaignId,
    parentOfHoldingId,
    holding,
    groups,
  } = input;

  let { childOfHoldingId } = input;

  if (!childOfHoldingId && !holding) throw Error(`No 'childOfHoldingId' or 'holding'.`);

  if (!childOfHoldingId && holding) {
    const { name, assignment = HoldingAssignment.selfSelected, ...rest } = holding;
    ({ id: childOfHoldingId } = await trx.insertInto('holding')
      .values({
        name,
        assignment,
        ...rest
      })
      .returning('id')
      .executeTakeFirstOrThrow());
  }
  if (!childOfHoldingId) throw Error(`No 'childOfHoldingId'.`);

  const groupIds = [];
  for (const { reference, name, type = GroupType.group, ...rest } of groups) {
    const group = await trx.insertInto('group')
      .values({
        campaignId,
        childOfHoldingId,
        parentOfHoldingId,
        reference,
        name,
        type,
        ...rest,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    groupIds.push(group.id);
  }
  return { childOfHoldingId, groupIds };
};

export const createMenuItems = async (trx: Transaction<Schema>, input: {
  userId: string,
  waveId: string,
  campaignId?: string,
  includedGroupIds?: string[],
  itemsPerSlot: [
    (Omit<Insertable<Schema['menuItem']>, 'slot'> & { includedGroupReferences?: string[]; excludedGroupReferences?: string[] })[],
    (Omit<Insertable<Schema['menuItem']>, 'slot'> & { includedGroupReferences?: string[]; excludedGroupReferences?: string[] })[],
    (Omit<Insertable<Schema['menuItem']>, 'slot'> & { includedGroupReferences?: string[]; excludedGroupReferences?: string[] })[],
  ]
}) => {

  const {
    userId,
    waveId,
    campaignId,
    itemsPerSlot,
  } = input;

  if (!input.includedGroupIds?.length && !campaignId?.length) throw Error(`Either groupIds or campaignId must be set.`);

  const menuItems: { id: string }[] = [];
  const slots = [MenuItemSlot.top, MenuItemSlot.center, MenuItemSlot.bottom];
  for (const [i, items] of itemsPerSlot.entries()) {
    const slot = slots[i];
    for (const { includedGroupReferences, excludedGroupReferences, ...rest } of items) {
      let includedGroupIds = input.includedGroupIds ?? [];

      const menuItem = await trx.insertInto('menuItem')
        .values({
          slot,
          ...rest,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await trx.insertInto('menuItemPerWave')
        .values({
          waveId: waveId,
          menuItemId: menuItem.id,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      if (includedGroupReferences?.length && campaignId?.length) {
        const groups = await trx.selectFrom('group').where('reference', 'in', includedGroupReferences).where('campaignId', '=', campaignId).select('id').execute();
        includedGroupIds = groups?.map(group => group.id);
      }
      if (includedGroupIds?.length) {
        await trx.insertInto('menuItemIncludedPerGroup')
          .values(
            includedGroupIds.map(groupId => (
              {
                groupId,
                menuItemId: menuItem.id,
              }
            ))
          )
          .returning('id')
          .executeTakeFirstOrThrow();
      }
      let excludedGroupIds: string[] = [];
      if (excludedGroupReferences?.length && campaignId?.length) {
        const groups = await trx.selectFrom('group').where('reference', 'in', excludedGroupReferences).where('campaignId', '=', campaignId).select('id').execute();
        excludedGroupIds = groups?.map(group => group.id);
      }
      if (excludedGroupIds?.length) {
        await trx.insertInto('menuItemExcludedPerGroup')
          .values(
            excludedGroupIds.map(groupId => (
              {
                groupId,
                menuItemId: menuItem.id,
              }
            ))
          )
          .returning('id')
          .executeTakeFirstOrThrow();
      }

      menuItems.push(menuItem);
    }
  }
  return { menuItems };
};
