import { db } from '$lib/db/database';
import { findOneQuizById } from '$lib/db/repositories/2-stories-module';
import { translatableValidator } from '$lib/db/schemas/0-utils';
import { clean } from '$lib/utils';
import { json } from '@sveltejs/kit';
import z from 'zod/v4';
import type { RequestHandler } from './$types';

const answerOptionSchema = z.object({
  id: z.string().optional(),
  order: z.number(),
  value: z.string().nullable(),
  label: translatableValidator,
});
const questionSchema = z.object({
  id: z.string().optional(),
  answerTemplateReference: z.literal('select-single'),
  order: z.number(),
  title: translatableValidator,
  instruction: translatableValidator.nullable(),
  isRequired: z.boolean().default(true),
  answerOptions: z.array(answerOptionSchema).min(1, 'At least one answer option is required'),
  answerGroup: z.object({ id: z.string().optional(), doRandomize: z.boolean() }).optional(),
});
const quizSchema = z.object({
  // id: z.string().optional(),
  name: z.string().min(1),
  doRandomize: z.boolean().default(false),
  questions: z.array(questionSchema).min(1, 'At least one question is required'),
});

export const POST = (async ({ request, params }) => {

  const body = quizSchema.safeParse(clean(await request.json()));
  if (!body.success) return json(body.error.issues, { status: 422 });

  const { questions, ...rest } = body.data;

  const quizId = await db.transaction().execute(async (trx) => {

    const quiz = await trx
      .insertInto('quizTemplate')
      .values({
        id: params.quizId === 'new' ? undefined : params.quizId,
        ...rest
      })
      .onConflict((oc) =>
        oc.columns(['id']).doUpdateSet({
          ...rest
        })
      )
      .returning('id')
      .executeTakeFirstOrThrow();
    await trx
      .insertInto('quizTemplateAvailableToStory')
      .values({
        storyId: params.storyId,
        quizTemplateId: quiz.id,
      })
      .onConflict((oc) => oc.columns(['storyId', 'quizTemplateId']).doNothing())
      .executeTakeFirstOrThrow();

    // Delete removed questions
    await trx
      .deleteFrom('quizQuestionTemplate')
      .where('quizTemplateId', '=', quiz.id)
      .where('id', 'not in', questions?.map((q) => q.id)?.filter<string>((q): q is string => typeof q === 'string' && !q?.startsWith('new')) ?? null)
      .execute();

    // Create / update the remaining questions
    for (const rawquestion of questions) {
      const { id: questionId, title, instruction, answerOptions, answerGroup, ...rest } = rawquestion;

      // Find answerOptionGroup by ID, or create it if it does not exist.
      let quizQuestionTemplateAnswerGroupId: string | null = null;
      if (answerGroup) {
        const answerGroupResult = await trx
          .insertInto('quizQuestionTemplateAnswerGroup')
          .values({
            id: answerGroup.id?.startsWith('new') ? undefined : answerGroup.id,
            // reference: `answer-group-${crypto.randomUUID().toString().slice(0, 8)}`,
            // name: `Answer Group ${answerGroup.id}`,
            doRandomize: answerGroup.doRandomize
          })
          .onConflict((oc) =>
            oc.columns(['id']).doUpdateSet({
              // reference: `answer-group-${answerGroup.id}`,
              // name: `Answer Group ${answerGroup.id}`,
              doRandomize: answerGroup.doRandomize
            })
          )
          .returning('id')
          .executeTakeFirstOrThrow();
        quizQuestionTemplateAnswerGroupId = answerGroupResult.id;

        // Delete removed answer options
        await trx
          .deleteFrom('quizQuestionTemplateAnswerItem')
          .where('quizQuestionTemplateAnswerGroupId', '=', quizQuestionTemplateAnswerGroupId)
          .where('id', 'not in', answerOptions?.map((o) => o.id)?.filter<string>((o): o is string => typeof o === 'string' && !o?.startsWith('new')) ?? [])
          .execute();

        // Create / update the remaining answer options
        for (const answerOption of answerOptions) {
          await trx
            .insertInto('quizQuestionTemplateAnswerItem')
            .values({
              id: answerOption.id?.startsWith('new') ? undefined : answerOption.id,
              quizQuestionTemplateAnswerGroupId,
              order: answerOption.order,
              value: JSON.stringify(answerOption.value),
              label: JSON.stringify(answerOption.label),
            })
            .onConflict((oc) =>
              oc.columns(['id']).doUpdateSet({
                order: answerOption.order,
                value: JSON.stringify(answerOption.value ?? answerOption.label),
                label: JSON.stringify(answerOption.label),
              })
            )
            .executeTakeFirstOrThrow();
        }
      }

      // Create / update the remaining question
      await trx
        .insertInto('quizQuestionTemplate')
        .values({
          id: questionId?.startsWith('new') ? undefined : questionId,
          quizTemplateId: quiz.id,
          quizQuestionTemplateAnswerGroupId,
          title: JSON.stringify(title),
          instruction: JSON.stringify(instruction),
          ...rest
        })
        .onConflict((oc) =>
          oc.columns(['id']).doUpdateSet({
            quizQuestionTemplateAnswerGroupId,
            title: JSON.stringify(title),
            instruction: JSON.stringify(instruction),
            ...rest
          })
        )
        .returning('id')
        .executeTakeFirstOrThrow();
    }

    return quiz.id;
  });

  const quiz = await findOneQuizById(quizId);

  return json(quiz);
}) satisfies RequestHandler;

export const DELETE = (async ({ params }) => {

  await db.deleteFrom('quizTemplate')
    .where('id', '=', params.quizId)
    .executeTakeFirstOrThrow();

  return json({ success: true });
}) satisfies RequestHandler;