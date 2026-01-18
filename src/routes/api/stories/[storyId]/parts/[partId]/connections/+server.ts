import { db } from '$lib/db/database';
import { json } from '@sveltejs/kit';
import z from 'zod/v4';
import type { RequestHandler } from './$types';

const schema = z.object({
  handle: z.string().min(1),
  target: z.string().min(1),
});

export const POST = (async ({ request, params }) => {

  const body = schema.safeParse(await request.json());
  if (!body.success) return json(body.error.issues, { status: 422 });

  const source = params.partId
  const { handle, target } = body.data;

  await db.transaction().execute(async (trx) => {
    if (handle === 'default') {
      await trx
        .updateTable('part')
        .where('id', '=', source)
        .set({ defaultNextPartId: target })
        .executeTakeFirstOrThrow();
    } else if (handle === 'default-after-quiz') {
      console.log('default-after-quiz', source, target);
      await trx
        .updateTable('quizLogicForPart')
        .set({ defaultNextPartId: target })
        .from('part')
        .whereRef('part.quizLogicForPartId', '=', 'quizLogicForPart.id')
        .where('part.id', '=', source)
        .executeTakeFirstOrThrow();
    } else {
      await trx
        .updateTable('quizLogicRule')
        .where('id', '=', handle)
        .set({ nextPartId: target })
        .executeTakeFirstOrThrow();
    }
  });

  return json({ success: true });
}) satisfies RequestHandler;

export const DELETE = (async ({ request, params }) => {

  const body = schema.safeParse(await request.json());
  if (!body.success) return json(body.error.issues, { status: 422 });

  const source = params.partId
  const { handle } = body.data;

  await db.transaction().execute(async (trx) => {
    if (handle === 'default') {
      await trx
        .updateTable('part')
        .where('id', '=', source)
        .set({ defaultNextPartId: null })
        .executeTakeFirstOrThrow();
    } else if (handle === 'default-after-quiz') {
      await trx
        .updateTable('quizLogicForPart')
        .leftJoin('part', 'part.quizLogicForPartId', 'quizLogicForPart.id')
        .where('part.id', '=', source)
        .set({ defaultNextPartId: null })
        .executeTakeFirstOrThrow();
    } else {
      await trx
        .updateTable('quizLogicRule')
        .where('id', '=', handle)
        .set({ nextPartId: null })
        .executeTakeFirstOrThrow();
    }
  });

  return json({ success: true });
}) satisfies RequestHandler;
