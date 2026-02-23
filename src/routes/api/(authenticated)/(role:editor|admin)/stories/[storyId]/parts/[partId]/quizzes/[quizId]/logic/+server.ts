import { db } from '$lib/db/database';
import { findOneQuizLogicById } from '$lib/db/repositories/2-stories-module';
import { LogicHitpolicy } from '$lib/db/schemas/2-story-module';
import { canModifyStory } from '$lib/server/utils.server';
import { clean } from '$lib/utils';
import { json } from '@sveltejs/kit';
import z from 'zod/v4';
import type { RequestHandler } from './$types';

const ruleInputSchema = z.object({
  id: z.string().optional(),
  quizQuestionTemplateId: z.string().min(1).refine(val => val !== 'none', 'A quiz must be selected'),
  quizQuestionTemplateAnswerItemId: z.string().min(1), // .nullable(),
  value: z.string().nullable().default(null),
});
const ruleSchema = z.object({
  id: z.string().optional(),
  // nextPartId: z.string().nullable(),
  order: z.number(),
  name: z.string().min(1),
  inputs: z.array(ruleInputSchema).min(1, 'At least one input is required'),
});
const logicSchema = z.object({
  // id: z.string().optional(),
  rules: z.array(ruleSchema).min(1, 'At least one rule is required'),
});

export const POST = (async ({ locals, params, request }) => {
  await canModifyStory(locals, params.storyId);

  const body = logicSchema.safeParse(clean(await request.json()));
  if (!body.success) return json(body.error.issues, { status: 422 });

  const { rules } = body.data;

  const logicId = await db.transaction().execute(async (trx) => {

    const part = await trx
      .selectFrom('part')
      .where('id', '=', params.partId)
      .select(['id', 'quizLogicForPartId'])
      .executeTakeFirstOrThrow();

    const logic = await trx
      .insertInto('quizLogicForPart')
      .values({
        id: part.quizLogicForPartId ?? undefined,
        quizTemplateId: params.quizId,
        hitpolicy: LogicHitpolicy.first,
      })
      .onConflict((oc) =>
        oc.columns(['id']).doUpdateSet({
          quizTemplateId: params.quizId,
          hitpolicy: LogicHitpolicy.first,
        })
      )
      .returning('id')
      .executeTakeFirstOrThrow();

    if (!part.quizLogicForPartId) {
      await trx
        .updateTable('part')
        .set({ quizLogicForPartId: logic.id })
        .where('id', '=', params.partId)
        .executeTakeFirstOrThrow();
    }

    // Delete removed rules
    await trx
      .deleteFrom('quizLogicRule')
      .where('quizLogicForPartId', '=', logic.id)
      .where('id', 'not in', rules?.map((r) => r.id)?.filter<string>((r): r is string => typeof r === 'string' && !r?.startsWith('new')) ?? null)
      .execute();

    // Create / update the remaining rules
    for (const rawrule of rules) {
      const { id: ruleId, inputs, ...rest } = rawrule;

      // Create / update the remaining question
      const rule = await trx
        .insertInto('quizLogicRule')
        .values({
          id: ruleId?.startsWith('new') ? undefined : ruleId,
          quizLogicForPartId: logic.id,
          ...rest
        })
        .onConflict((oc) =>
          oc.columns(['id']).doUpdateSet({
            quizLogicForPartId: logic.id,
            ...rest
          })
        )
        .returning('id')
        .executeTakeFirstOrThrow();

      // Delete removed rule inputs
      await trx
        .deleteFrom('quizLogicRuleInput')
        .where('quizLogicRuleId', '=', rule.id)
        .where('id', 'not in', inputs?.map((i) => i.id)?.filter<string>((i): i is string => typeof i === 'string' && !i?.startsWith('new')) ?? [])
        .execute();

      // Create / update the remaining rule inputs
      for (const { quizQuestionTemplateId, quizQuestionTemplateAnswerItemId, value, ...input } of inputs) {
        await trx
          .insertInto('quizLogicRuleInput')
          .values({
            id: input.id?.startsWith('new') ? undefined : input.id,
            quizLogicRuleId: rule.id,
            quizQuestionTemplateId,
            quizQuestionTemplateAnswerItemId,
            value: value ? JSON.stringify(value) : null,
          })
          .onConflict((oc) =>
            oc.columns(['id']).doUpdateSet({
              quizLogicRuleId: rule.id,
              quizQuestionTemplateId,
              quizQuestionTemplateAnswerItemId,
              value: value ? JSON.stringify(value) : null,
            })
          )
          .executeTakeFirstOrThrow();
      }
    }

    return logic.id;
  });

  const logic = await findOneQuizLogicById(logicId);

  return json(logic);
}) satisfies RequestHandler;
