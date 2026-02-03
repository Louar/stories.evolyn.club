import { orientationableUrlValidator, translatableValidator } from '$lib/db/schemas/0-utils';
import z from 'zod/v4';

const videoSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  source: orientationableUrlValidator,
  thumbnail: orientationableUrlValidator.nullable(),
  captions: z.unknown().nullable(),
  duration: z.number(),
});

const announcementSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  title: translatableValidator.nullish().default(null),
  message: translatableValidator.nullish().default(null),
});

const answerOptionSchema = z.object({
  id: z.string().min(1).optional(),
  order: z.number(),
  value: z.string(),
  label: translatableValidator,
});

const answerGroupSchema = z.object({
  id: z.string().min(1).optional(),
  doRandomize: z.boolean(),
});

const quizQuestionSchema = z.object({
  id: z.string().min(1).optional(),
  order: z.number(),
  answerTemplateReference: z.string().min(1),
  title: translatableValidator,
  instruction: translatableValidator.nullish().default(null),
  placeholder: translatableValidator.nullish().default(null),
  configuration: z.unknown().nullish().default(null),
  isRequired: z.boolean(),
  answerOptions: z.array(answerOptionSchema),
  answerGroup: answerGroupSchema,
});

const quizSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  doRandomize: z.boolean(),
  questions: z.array(quizQuestionSchema),
});

const quizLogicRuleInputSchema = z.object({
  id: z.string().min(1).optional(),
  quizQuestionTemplateId: z.string().min(1),
  quizQuestionTemplateAnswerItemId: z.string().min(1).nullable(),
  value: z.unknown().nullish().default(null),
});

const quizLogicRuleSchema = z.object({
  id: z.string().min(1).optional(),
  order: z.number(),
  name: z.string().min(1),
  nextPartId: z.string().min(1).nullable(),
  inputs: z.array(quizLogicRuleInputSchema),
});

const quizLogicForPartSchema = z.object({
  hitpolicy: z.literal('first'),
  quizTemplateId: z.string().min(1),
  defaultNextPartId: z.string().min(1).nullable(),
  rules: z.array(quizLogicRuleSchema),
});

const partSchema = z.object({
  id: z.string().min(1).optional(),
  isInitial: z.boolean(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  backgroundType: z.string().min(1),
  backgroundConfiguration: z.record(z.string(), z.unknown()).nullish().default(null),
  videoId: z.string().min(1).nullable(),
  defaultNextPartId: z.string().min(1).nullable(),
  foregroundType: z.string().min(1).nullable(),
  foregroundConfiguration: z.record(z.string(), z.unknown()).nullish().default(null),
  announcementTemplateId: z.string().min(1).nullable(),
  quizTemplateId: z.string().min(1).nullable(),
  quizLogicForPartId: z.string().min(1).nullable(),
  quizLogicForPart: quizLogicForPartSchema.nullable(),
});

export const schema = z.object({
  id: z.string().min(1).optional(),
  reference: z.string().min(1),
  name: translatableValidator,
  isPublished: z.boolean(),
  isPublic: z.boolean(),
  videos: z.array(videoSchema),
  announcements: z.array(announcementSchema),
  quizzes: z.array(quizSchema),
  parts: z.array(partSchema),
  configuration: z.unknown().nullable(),
});
