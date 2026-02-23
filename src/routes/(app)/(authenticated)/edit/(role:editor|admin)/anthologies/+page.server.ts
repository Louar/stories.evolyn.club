import { db } from '$lib/db/database';
import { selectLocalizedField } from '$lib/db/schemas/0-utils';
import type { NotNull } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { fail, message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import YAML from 'yaml';
import type { PageServerLoad } from './$types';
import { anthologySchema, schemaOfAttachments } from './schemas';


export const load: PageServerLoad = (async ({ locals }) => {

  const clientId = locals.client.id;
  const userId = locals.authusr!.id;
  const language = locals.authusr!.language;

  const anthologies = await db
    .selectFrom('anthology')
    .leftJoin('anthologyPermission', 'anthologyPermission.anthologyId', 'anthology.id')
    .where('anthology.clientId', '=', clientId)
    .where('anthologyPermission.userId', '=', userId)
    .select((eb) => [
      'anthology.id',
      'anthology.reference',
      selectLocalizedField(eb, 'anthology.name', language).as('name'),
      'anthology.name as nameRaw',
      'anthology.isPublic',
      'anthology.isPublished',
      jsonArrayFrom(
        eb.selectFrom('anthologyPosition')
          .whereRef('anthologyPosition.anthologyId', '=', 'anthology.id')
          .leftJoin('story', 'story.id', 'anthologyPosition.storyId')
          .select([
            'anthologyPosition.id',
            'anthologyPosition.order',
            'story.id as storyId',
          ])
          .orderBy('anthologyPosition.order', 'asc')
          .$narrowType<{ id: NotNull, order: NotNull, storyId: NotNull }>()
      ).as('positions'),
    ])
    .execute();

  const stories = await db
    .selectFrom('story')
    .leftJoin('storyPermission', 'storyPermission.storyId', 'story.id')
    .where('story.clientId', '=', clientId)
    .where('storyPermission.userId', '=', userId)
    .select((eb) => [
      'story.id',
      selectLocalizedField(eb, 'story.name', language).as('name'),

      'story.isPublic',
      'story.isPublished',
    ])
    .execute();


  const form = await superValidate(zod4(schemaOfAttachments), { errors: false });

  return { form, anthologies, stories };
});


export const actions = {
  upload: async ({ request, fetch }) => {
    const form = await superValidate(request, zod4(schemaOfAttachments));
    if (!form.valid) return fail(400, { form });

    const { attachments } = form.data;

    for (const attachment of attachments) {

      let yaml;
      try {
        yaml = YAML.parse(await attachment.text());
      } catch {
        // return setError(form, 'attachments', 'Invalid YAML');
      }
      const res = await fetch(`/api/anthologies/io`, { method: 'POST', body: JSON.stringify(yaml) });
      if (!res.ok) {
        console.error(await res.json());
        return fail(400, { form });
      }
    }

    return message(form, 'Form posted successfully!');
  },
  upsert: async ({ request, locals }) => {
    const clientId = locals.client.id;
    const userId = locals.authusr!.id;

    const form = await superValidate(request, zod4(anthologySchema));
    if (!form.valid) return fail(400, { form });

    const { id: anthologyId, reference, nameRaw, positions, ...rest } = form.data;

    const isNotUnique = await db
      .selectFrom('anthology')
      .where('clientId', '=', clientId)
      .$if(anthologyId != null, (qb) => qb.where('id', '!=', anthologyId!))
      .where('reference', '=', reference)
      .select('id')
      .executeTakeFirst();
    if (isNotUnique) return setError(form, 'reference', `Reference already exists`);

    await db.transaction().execute(async (trx) => {
      const anthology = await trx
        .insertInto('anthology')
        .values({
          id: anthologyId ?? undefined,
          clientId,
          reference,
          name: JSON.stringify(nameRaw),
          createdBy: userId,
          updatedBy: userId,
          ...rest
        })
        .onConflict((oc) =>
          oc.columns(['id']).doUpdateSet({
            reference,
            name: JSON.stringify(nameRaw),
            updatedBy: userId,
            updatedAt: new Date(),
            ...rest
          })
        )
        .returning('id')
        .executeTakeFirstOrThrow();

      if (!anthologyId) {
        await trx
          .insertInto('anthologyPermission')
          .values({
            userId,
            anthologyId: anthology.id,
          })
          .executeTakeFirstOrThrow();
      }

      // Delete removed anthology positions
      await trx
        .deleteFrom('anthologyPosition')
        .where('anthologyId', '=', anthology.id)
        .where('id', 'in', positions?.filter(p => p.isRemoved).map(p => p.id)?.filter<string>((p): p is string => typeof p === 'string' && !p?.startsWith('new')) ?? null)
        .execute();

      // Create / update the remaining anthology positions
      for (const rawposition of positions.filter(p => !p.isRemoved)) {
        const { id: positionId, configuration, storyId, order } = rawposition;
        await trx
          .insertInto('anthologyPosition')
          .values({
            id: positionId?.startsWith('new') ? undefined : positionId,
            anthologyId: anthology.id,
            configuration: configuration ? JSON.stringify(configuration) : null,
            storyId,
            order,
          })
          .onConflict((oc) =>
            oc.columns(['id']).doUpdateSet({
              anthologyId: anthology.id,
              configuration: configuration ? JSON.stringify(configuration) : null,
              storyId,
              order,
            })
          )
          .returning('id')
          .executeTakeFirstOrThrow();
      }

    });

    return message(form, 'Form posted successfully!');
  },
  delete: async ({ request }) => {
    const data = await request.formData();
    const anthologyId = data.get('anthologyId') as string;

    await db
      .deleteFrom('anthology')
      .where('id', '=', anthologyId)
      .execute();
  }
};

