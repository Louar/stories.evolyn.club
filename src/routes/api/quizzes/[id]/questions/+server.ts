import { json } from '@sveltejs/kit';
import { z } from 'zod/v4';
import type { RequestHandler } from './$types';

const answerOptionSchema = z.object({
  order: z.number(),
  value: z.string(),
  label: z.string(),
  isCorrect: z.boolean().default(false)
});

const questionSchema = z.object({
  answerTemplateReference: z.literal('select-single'),
  order: z.number(),
  title: z.string().min(1, 'Description is required'),
  isRequired: z.boolean().default(true),
  answerOptions: z.array(answerOptionSchema).min(1, 'At least one answer option is required'),
  answerGroup: z.object({ doRandomize: z.boolean() }).optional(),
  doRandomize: z.boolean().default(false),
});

const schema = z.object({
  id: z.string().optional(),
  doRandomize: z.boolean().default(false),
  questions: z.array(questionSchema).min(1, 'At least one question is required'),
});

export const POST = (async ({ request }) => {

  const body = schema.parse(await request.json());

  const { questions } = body;

  // Check if survey template already exists

  return json(body);
}) satisfies RequestHandler;
