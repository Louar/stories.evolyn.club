import { db } from '$lib/db/database';
import { selectLocalizedField } from '$lib/db/schemas/0-utils';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { fail, message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import YAML from 'yaml';
import type { PageServerLoad } from './$types';
import { schemaOfAttachments } from './schemas';


export const load: PageServerLoad = (async ({ locals, url }) => {
  const clientId = locals.client.id;
  const userId = locals.authusr!.id;
  const language = locals.authusr!.language;

  const showAll = url.searchParams.get('show') === 'all';
  const isAdmin = locals.authusr?.roles?.includes(UserRole.admin) ?? false;

  let query = db
    .selectFrom('story')
    .distinctOn('story.id')
    .where('story.clientId', '=', clientId);

  if (!isAdmin || !showAll) {
    query = query
      .innerJoin('storyPermission', 'storyPermission.storyId', 'story.id')
      .where('storyPermission.userId', '=', userId)
  }

  const stories = await query
    .select((eb) => [
      'story.id',
      'story.reference',
      selectLocalizedField(eb, 'story.name', language).as('name'),
      'story.isPublic',
      'story.isPublished',
      'story.createdAt',
      'story.updatedAt',
      eb.selectFrom('storyPermission')
        .whereRef('storyPermission.storyId', '=', 'story.id')
        .select(eb.fn.countAll<number>().as('editors'))
        .as('editors'),
      jsonObjectFrom(
        eb.selectFrom('user')
          .whereRef('user.id', '=', 'story.createdBy')
          .select((eb) => [
            'user.id',
            eb.fn<string | null>('nullif', [eb.fn<string>('btrim', [eb.fn<string>('concat', ['user.firstName', eb.cast<string>(eb.val(' '), 'text'), 'user.lastName'])]), eb.val('')]).as('label'),
            'user.picture as image',
          ])
      ).as('createdBy'),
      jsonObjectFrom(
        eb.selectFrom('user')
          .whereRef('user.id', '=', 'story.updatedBy')
          .select((eb) => [
            'user.id',
            eb.fn<string | null>('nullif', [eb.fn<string>('btrim', [eb.fn<string>('concat', ['user.firstName', eb.cast<string>(eb.val(' '), 'text'), 'user.lastName'])]), eb.val('')]).as('label'),
            'user.picture as image',
          ])
      ).as('updatedBy'),
    ])
    .execute();

  const form = await superValidate(zod4(schemaOfAttachments), { errors: false });

  return { form, stories };
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
      const res = await fetch(`/api/stories/io`, { method: 'POST', body: JSON.stringify(yaml) });
      if (!res.ok) {
        console.error(await res.json());
        return fail(400, { form });
      }
    }

    return message(form, 'Form posted successfully!');
  }
};
