import { z } from 'zod/v4';

const isoDateTimeString = z.iso.datetime({
  message: 'Must be a valid ISO datetime'
});

const transitionEventSchema = z.object({
  type: z.literal('transition'),
  createdAt: isoDateTimeString,
  fromPartId: z.uuid(),
  toPartId: z.uuid()
});

const interactionEventSchema = z.object({
  type: z.literal('interaction'),
  createdAt: isoDateTimeString,
  partId: z.uuid(),
  quizQuestionTemplateId: z.uuid(),
  quizQuestionTemplateAnswerItemId: z.uuid().nullable(),
  value: z.record(z.string(), z.unknown()).nullable()
});

export const storyEventSchema = z.object({
  url: z.string().trim().min(1),
  session: z.uuid(),
  event: z.discriminatedUnion('type', [transitionEventSchema, interactionEventSchema])
});

export type StoryEvent = z.infer<typeof storyEventSchema>;