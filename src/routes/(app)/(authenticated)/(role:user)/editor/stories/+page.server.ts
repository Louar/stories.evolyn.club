import { db } from '$lib/db/database';
import { selectLocalizedField } from '$lib/db/schemas/0-utils';
import { fail, message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import YAML from 'yaml';
import type { PageServerLoad } from './$types';
import { schemaOfAttachments } from './schemas';


export const load: PageServerLoad = (async ({ locals }) => {

  const clientId = locals.client.id;
  const userId = locals.authusr!.id;
  const language = locals.authusr!.language;

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

