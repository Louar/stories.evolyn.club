import { db } from '$lib/db/database';
import { storySchema } from '$lib/db/repositories/2-stories-module';
import { clean } from '$lib/utils';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PUT = (async ({ request, locals, params }) => {
  const clientId = locals.client.id;

  const body = storySchema.safeParse(clean(await request.json()));
  if (!body.success) return json(body.error.issues, { status: 422 });

  const story = db.selectFrom('story').where('clientId', '=', clientId).where('id', '=', params.storyId).select('id').executeTakeFirst();
  if (!story) error(404, `Story not found`);

  const { reference, name, ...rest } = body.data;
  const isUnique = db.selectFrom('story').where('clientId', '=', clientId).where('id', '!=', params.storyId).where('reference', '=', reference);
  if (!isUnique) error(422, `Reference already exists`);

  await db
    .insertInto('story')
    .values({
      clientId,
      id: params.storyId,
      reference,
      name: JSON.stringify(name),
      ...rest
    })
    .onConflict((oc) =>
      oc.columns(['id']).doUpdateSet({
        reference,
        name: JSON.stringify(name),
        ...rest
      })
    )
    .returning('id')
    .executeTakeFirstOrThrow();

  return json({ success: true });
}) satisfies RequestHandler;

export const DELETE = (async ({ locals, params }) => {
  const clientId = locals.client.id;

  await db.deleteFrom('story')
    .where('clientId', '=', clientId)
    .where('id', '=', params.storyId)
    .executeTakeFirstOrThrow();

  return json({ success: true });
}) satisfies RequestHandler;
