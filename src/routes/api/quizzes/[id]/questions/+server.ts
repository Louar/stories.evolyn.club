import { db } from '$lib/db/database';
import type { Translatable } from '$lib/db/schemas/0-utils';
import { json } from '@sveltejs/kit';
import { z } from 'zod/v4';
import type { RequestHandler } from './$types';

const answerOptionSchema = z.object({
  id: z.string().optional(),
  order: z.number(),
  value: z.string(),
  label: z.string(),
});

const questionSchema = z.object({
  id: z.string().optional(),
  answerTemplateReference: z.literal('select-single'),
  order: z.number(),
  title: z.string().min(1, 'Description is required'),
  isRequired: z.boolean().default(true),
  answerOptions: z.array(answerOptionSchema).min(1, 'At least one answer option is required'),
  answerGroup: z.object({ id: z.string(), doRandomize: z.boolean() }).optional(),
});

const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  doRandomize: z.boolean().default(false),
  questions: z.array(questionSchema).min(1, 'At least one question is required'),
});

export const POST = (async ({ request, params }) => {

  const body = schema.parse(await request.json());
  const quizTemplateId = params.id;

  const { questions, ...rest } = body;

  console.log('body', body);

  await db.transaction().execute(async (trx) => {
    const quiz = await trx
      .insertInto('quizTemplate')
      .values({
        id: quizTemplateId,
        ...rest
      })
      .onConflict((oc) =>
        oc.columns(['id']).doUpdateSet({
          ...rest
        })
      )
      .returning('id')
      .executeTakeFirstOrThrow();

    for (const rawquestion of questions) {
      const { title, answerOptions, answerGroup, ...rest } = rawquestion;

      // Find answerOptionGroup by ID, or create it if it does not exist.
      let quizQuestionTemplateAnswerGroupId: string | null = null;
      if (answerGroup) {
        const answerGroupResult = await trx
          .insertInto('quizQuestionTemplateAnswerGroup')
          .values({
            id: answerGroup.id,
            reference: `answer-group-${answerGroup.id}`,
            name: `Answer Group ${answerGroup.id}`,
            doRandomize: answerGroup.doRandomize
          })
          .onConflict((oc) =>
            oc.columns(['id']).doUpdateSet({
              reference: `answer-group-${answerGroup.id}`,
              name: `Answer Group ${answerGroup.id}`,
              doRandomize: answerGroup.doRandomize
            })
          )
          .returning('id')
          .executeTakeFirstOrThrow();
        quizQuestionTemplateAnswerGroupId = answerGroupResult.id;
      }

      // Create the question first
      await trx
        .insertInto('quizQuestionTemplate')
        .values({
          quizTemplateId: quiz.id,
          quizQuestionTemplateAnswerGroupId,
          title: JSON.stringify({ default: title } as Translatable),
          ...rest
        })
        .onConflict((oc) =>
          oc.columns(['id']).doUpdateSet({
            quizQuestionTemplateAnswerGroupId,
            ...rest
          })
        )
        .returning('id')
        .executeTakeFirstOrThrow();

      // Assign answerOptions to the answer group
      for (const answerOption of answerOptions) {
        await trx
          .insertInto('quizQuestionTemplateAnswerItem')
          .values({
            quizQuestionTemplateAnswerGroupId: quizQuestionTemplateAnswerGroupId!,
            order: answerOption.order,
            value: JSON.stringify(answerOption.value),
            label: JSON.stringify({ default: answerOption.label } as Translatable),
          })
          .onConflict((oc) =>
            oc.columns(['id']).doUpdateSet({
              value: JSON.stringify(answerOption.value),
              label: JSON.stringify({ default: answerOption.label } as Translatable),
            })
          )
          .executeTakeFirstOrThrow();
      }
    }
  });

  return json(body);
}) satisfies RequestHandler;
