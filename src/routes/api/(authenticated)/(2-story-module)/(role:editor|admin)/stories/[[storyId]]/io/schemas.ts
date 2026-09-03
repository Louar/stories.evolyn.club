import {
	mediaValidator,
	translatableMediaValidator,
	translatableValidator
} from '$lib/db/schemas/0-utils';
import z from 'zod/v4';

const videoSchema = z.object({
	id: z.string().min(1).optional(),
	name: z.string().min(1),
	source: translatableMediaValidator,
	thumbnail: translatableMediaValidator.nullable(),
	captions: z.unknown().nullable(),
	duration: z.number()
});

const stillSchema = z.object({
	id: z.string().min(1).optional(),
	color: z.string().nullable(),
	image: mediaValidator.nullable(),
	style: z.string().nullable()
});

const announcementSchema = z.object({
	id: z.string().min(1).optional(),
	name: z.string().min(1),
	title: translatableValidator.nullish().default(null),
	message: translatableValidator.nullish().default(null)
});

const answerOptionSchema = z.object({
	id: z.string().min(1).optional(),
	order: z.number(),
	value: z.string(),
	label: translatableValidator
});

const answerGroupSchema = z.object({
	id: z.string().min(1).optional(),
	// slug: z.string().min(1).optional(),
	doRandomize: z.boolean()
});

const quizQuestionSchema = z.object({
	id: z.string().min(1).optional(),
	order: z.number(),
	answerTemplateSlug: z.string().min(1),
	title: translatableValidator,
	instruction: translatableValidator.nullish().default(null),
	placeholder: translatableValidator.nullish().default(null),
	configuration: z.unknown().nullish().default(null),
	isRequired: z.boolean(),
	answerOptions: z.array(answerOptionSchema),
	answerGroup: answerGroupSchema
});

const quizSchema = z.object({
	id: z.string().min(1).optional(),
	name: z.string().min(1),
	doRandomize: z.boolean(),
	questions: z.array(quizQuestionSchema)
});

const quizLogicRuleInputSchema = z.object({
	id: z.string().min(1).optional(),
	quizQuestionTemplateId: z.string().min(1),
	quizQuestionTemplateAnswerItemId: z.string().min(1).nullable(),
	value: z.unknown().nullish().default(null)
});

const quizLogicRuleSchema = z.object({
	id: z.string().min(1).optional(),
	order: z.number(),
	name: z.string().min(1),
	nextPartId: z.string().min(1).nullable(),
	inputs: z.array(quizLogicRuleInputSchema)
});

const quizLogicForPartSchema = z.object({
	hitpolicy: z.literal('first'),
	quizTemplateId: z.string().min(1),
	defaultNextPartId: z.string().min(1).nullable(),
	rules: z.array(quizLogicRuleSchema)
});

const rangeSchema = z.tuple([z.number().int().nullable(), z.number().int().nullable()]).nullable();

const taxonomyDraftLogicRuleSchema = z.object({
	id: z.string().min(1).optional(),
	order: z.number().int(),
	name: z.string().min(1),
	nextPartId: z.string().min(1).nullable(),
	nrOfRounds: rangeSchema,
	score: rangeSchema,
	mistakes: rangeSchema,
	duration: rangeSchema
});

const taxonomyDraftAttributeOptionSchema = z.object({
	id: z.string().min(1),
	slug: z.string().min(1)
});

const taxonomyDraftForPartSchema = z.object({
	taxonomySlug: z.string().min(1),
	nrOfRounds: z.number().int().nullable(),
	nrOfItemsPerRound: z.number().int().nullable(),
	goal: z.number().int().nullable(),
	maxMistakes: z.number().int().nullable(),
	difficulty: z.number().int().nullable(),
	defaultNextPartId: z.string().min(1).nullable(),
	draftedAttributeIds: z.array(z.string().min(1)).nullish().default([]),
	attributeOptions: z.array(taxonomyDraftAttributeOptionSchema).nullish().default([]),
	draftedCategoryIds: z.array(z.string().min(1)).nullish().default([]),
	draftedItemIds: z.array(z.string().min(1)).nullish().default([]),
	rules: z.array(taxonomyDraftLogicRuleSchema)
});

const partSchema = z.object({
	id: z.string().min(1).optional(),
	isInitial: z.boolean(),
	position: z.object({
		x: z.number(),
		y: z.number()
	}),
	backgroundType: z.string().min(1).nullable(),
	backgroundConfiguration: z.record(z.string(), z.unknown()).nullish().default(null),
	videoId: z.string().min(1).nullable(),
	stillId: z.string().min(1).nullish().default(null),
	defaultNextPartId: z.string().min(1).nullable(),
	foregroundType: z.string().min(1).nullable(),
	foregroundConfiguration: z.record(z.string(), z.unknown()).nullish().default(null),
	announcementTemplateId: z.string().min(1).nullable(),
	quizTemplateId: z.string().min(1).nullable(),
	quizLogicForPartId: z.string().min(1).nullable(),
	quizLogicForPart: quizLogicForPartSchema.nullable(),
	taxonomyDraftForPartId: z.string().min(1).nullable(),
	taxonomyDraftForPart: taxonomyDraftForPartSchema.nullable().optional()
});

export const schema = z.object({
	id: z.string().min(1).optional(),
	slug: z.string().min(1),
	name: translatableValidator,
	defaultBackgroundColor: z.string().nullable().default(null),
	thumbnail: translatableMediaValidator.nullable().default(null),
	isPublished: z.boolean(),
	isPublic: z.boolean(),
	videos: z.array(videoSchema),
	stills: z.array(stillSchema).default([]),
	announcements: z.array(announcementSchema),
	quizzes: z.array(quizSchema),
	parts: z.array(partSchema),
	configuration: z.unknown().nullish().default(null)
});
