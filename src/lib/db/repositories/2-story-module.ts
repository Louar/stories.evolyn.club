import type { Rule } from '$lib/components/app/player/types';
import { db } from '$lib/db/database';
import { formObjectPreprocessor, translatableValidator } from '$lib/db/schemas/0-utils';
import { LogicHitpolicy } from '$lib/db/schemas/2-story-module';
import { loadTaxonomyGame } from '$lib/server/taxonomy-game';
import { error } from '@sveltejs/kit';
import type { NotNull } from 'kysely';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';
import z from 'zod/v4';
import { Language, selectLocalizedField, selectLocalizedMediaField } from '../schemas/0-utils';

export const storySchema = z.object({
	slug: z.string().min(1),
	name: z.preprocess(formObjectPreprocessor, translatableValidator),
	defaultBackgroundColor: z.string().nullable().default(null),
	isPublished: z.boolean().default(false),
	isPublic: z.boolean().default(true)
});

export const findOneAnthologyBySlug = async (
	clientId: string,
	anthologySlug: string,
	language?: Language
) => {
	if (!clientId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))
		error(404, 'De client-ID is ongeldig.');

	const anthology = await db
		.selectFrom('anthology')
		.where('anthology.slug', '=', anthologySlug)
		.where('anthology.clientId', '=', clientId)
		.where('anthology.isPublished', '=', true)
		.where('anthology.isPublic', '=', true)
		.select((eb) => [
			'anthology.id',
			'anthology.slug',
			selectLocalizedField(eb, 'anthology.name', language).as('name'),
			jsonArrayFrom(
				eb
					.selectFrom('anthologyPosition')
					.whereRef('anthologyPosition.anthologyId', '=', 'anthology.id')
					.leftJoin('story', 'story.id', 'anthologyPosition.storyId')
					.select((eb) => [
						'anthologyPosition.order',
						'story.id',
						'story.slug',
						selectLocalizedField(eb, 'story.name', language).as('name')
					])
					.$narrowType<{ order: NotNull; id: NotNull; slug: NotNull }>()
					.orderBy('anthologyPosition.order', 'asc')
			).as('stories')
		])
		.executeTakeFirst();

	return anthology;
};

export const findOneStoryById = async (clientId: string, storyId: string) => {
	if (!clientId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))
		error(404, 'De client-ID is ongeldig.');

	const rawstory = await db
		.selectFrom('story')
		.where('story.id', '=', storyId)
		.where('story.clientId', '=', clientId)
		.select((eb) => [
			'story.id',
			'story.slug',
			'story.name',
			'story.defaultBackgroundColor',
			'story.isPublished',
			'story.isPublic',

			jsonArrayFrom(
				eb
					.selectFrom('still')
					.leftJoin('stillAvailableToStory', 'stillAvailableToStory.stillId', 'still.id')
					.whereRef('stillAvailableToStory.storyId', '=', 'story.id')
					.select(['still.id', 'still.color', 'still.image', 'still.style'])
			).as('stills'),

			jsonArrayFrom(
				eb
					.selectFrom('video')
					.leftJoin('videoAvailableToStory', 'videoAvailableToStory.videoId', 'video.id')
					.whereRef('videoAvailableToStory.storyId', '=', 'story.id')
					.select([
						'video.id',
						'video.name',
						'video.source',
						'video.thumbnail',
						'video.captions',
						'video.duration'
					])
			).as('videos'),

			jsonArrayFrom(
				eb
					.selectFrom('announcementTemplate')
					.leftJoin(
						'announcementTemplateAvailableToStory',
						'announcementTemplateAvailableToStory.announcementTemplateId',
						'announcementTemplate.id'
					)
					.whereRef('announcementTemplateAvailableToStory.storyId', '=', 'story.id')
					.select([
						'announcementTemplate.id',
						'announcementTemplate.name',
						'announcementTemplate.title',
						'announcementTemplate.message'
					])
			).as('announcements'),

			jsonArrayFrom(
				eb
					.selectFrom('quizTemplate')
					.leftJoin(
						'quizTemplateAvailableToStory',
						'quizTemplateAvailableToStory.quizTemplateId',
						'quizTemplate.id'
					)
					.whereRef('quizTemplateAvailableToStory.storyId', '=', 'story.id')
					.select((eb) => [
						'quizTemplate.id',
						'quizTemplate.name',
						'quizTemplate.doRandomize',
						jsonArrayFrom(
							eb
								.selectFrom('quizQuestionTemplate')
								.whereRef('quizQuestionTemplate.quizTemplateId', '=', 'quizTemplate.id')
								.orderBy('quizQuestionTemplate.order', 'asc')
								.select((eb) => [
									'quizQuestionTemplate.id',
									'quizQuestionTemplate.order',
									'quizQuestionTemplate.answerTemplateSlug',
									'quizQuestionTemplate.title',
									'quizQuestionTemplate.instruction',
									'quizQuestionTemplate.configuration',
									'quizQuestionTemplate.isRequired',
									jsonArrayFrom(
										eb
											.selectFrom('quizQuestionTemplateAnswerGroup')
											.whereRef(
												'quizQuestionTemplateAnswerGroup.id',
												'=',
												'quizQuestionTemplate.quizQuestionTemplateAnswerGroupId'
											)
											.leftJoin(
												'quizQuestionTemplateAnswerItem',
												'quizQuestionTemplateAnswerItem.quizQuestionTemplateAnswerGroupId',
												'quizQuestionTemplateAnswerGroup.id'
											)
											.orderBy('quizQuestionTemplateAnswerItem.order', 'asc')
											.select((eb) => [
												'quizQuestionTemplateAnswerItem.id',
												'quizQuestionTemplateAnswerItem.order',
												// 'quizQuestionTemplateAnswerItem.value',
												eb.cast<string>('quizQuestionTemplateAnswerItem.value', 'text').as('value'),
												'quizQuestionTemplateAnswerItem.label',
												eb.lit<boolean>(false).as('isRemoved')
											])
											.$narrowType<{
												id: NotNull;
												order: NotNull;
												value: NotNull;
												label: NotNull;
												isRemoved: NotNull;
											}>()
									).as('answerOptions'),
									jsonObjectFrom(
										eb
											.selectFrom('quizQuestionTemplateAnswerGroup')
											.whereRef(
												'quizQuestionTemplateAnswerGroup.id',
												'=',
												'quizQuestionTemplate.quizQuestionTemplateAnswerGroupId'
											)
											.select([
												'quizQuestionTemplateAnswerGroup.id',
												'quizQuestionTemplateAnswerGroup.slug',
												'quizQuestionTemplateAnswerGroup.doRandomize'
											])
											.$narrowType<{ id: NotNull; doRandomize: NotNull }>()
									).as('answerGroup'),
									eb.lit<boolean>(false).as('isRemoved')
								])
						).as('questions')
					])
			).as('quizzes'),

			jsonArrayFrom(
				eb
					.selectFrom('taxonomy')
					.whereRef('taxonomy.clientId', '=', 'story.clientId')
					.select(['taxonomy.id', 'taxonomy.name'])
					.orderBy('taxonomy.name', 'asc')
			).as('taxonomies'),

			jsonArrayFrom(
				eb
					.selectFrom('part')
					.whereRef('part.storyId', '=', 'story.id')
					.leftJoin('quizLogicForPart as qlfp', 'qlfp.id', 'part.quizLogicForPartId')
					.leftJoin('quizTemplate', 'quizTemplate.id', 'qlfp.quizTemplateId')
					.leftJoin('taxonomyDraftForPart as tdfp', 'tdfp.id', 'part.taxonomyDraftForPartId')
					.select((eb) => [
						'part.id',
						'part.isInitial',
						'part.position',

						// Background
						'part.backgroundType',
						'part.backgroundConfiguration',
						'part.stillId',
						'part.videoId',
						'part.defaultNextPartId',

						// Foreground
						'part.foregroundType',
						'part.foregroundConfiguration',
						'part.announcementTemplateId',
						'quizTemplate.id as quizTemplateId',
						'part.quizLogicForPartId',
						'part.taxonomyDraftForPartId',
						'tdfp.taxonomyId as taxonomyId',

						jsonObjectFrom(
							eb
								.selectFrom('quizLogicForPart')
								.whereRef('quizLogicForPart.id', '=', 'part.quizLogicForPartId')
								.select((eb) => [
									'quizLogicForPart.hitpolicy',
									'quizLogicForPart.quizTemplateId',
									'quizLogicForPart.defaultNextPartId',
									jsonArrayFrom(
										eb
											.selectFrom('quizLogicRule')
											.whereRef('quizLogicRule.quizLogicForPartId', '=', 'quizLogicForPart.id')
											.orderBy('quizLogicRule.order', 'asc')
											.select((eb) => [
												'quizLogicRule.id',
												'quizLogicRule.order',
												'quizLogicRule.name',
												'quizLogicRule.nextPartId',
												jsonArrayFrom(
													eb
														.selectFrom('quizLogicRuleInput')
														.whereRef('quizLogicRuleInput.quizLogicRuleId', '=', 'quizLogicRule.id')
														.select([
															'quizLogicRuleInput.id',
															'quizLogicRuleInput.quizQuestionTemplateId',
															'quizLogicRuleInput.value',
															'quizLogicRuleInput.quizQuestionTemplateAnswerItemId',
															eb.lit<boolean>(false).as('isRemoved')
														])
														.$narrowType<{ id: NotNull; quizQuestionTemplateId: NotNull }>()
												).as('inputs'),
												eb.lit<boolean>(false).as('isRemoved')
											])
											.$narrowType<{ id: NotNull; inputs: NotNull; isRemoved: NotNull }>()
									).as('rules')
								])
						).as('quizLogicForPart'),

						jsonObjectFrom(
							eb
								.selectFrom('taxonomyDraftForPart')
								.whereRef('taxonomyDraftForPart.id', '=', 'part.taxonomyDraftForPartId')
								.innerJoin('taxonomy', 'taxonomy.id', 'taxonomyDraftForPart.taxonomyId')
								.select((eb) => [
									'taxonomyDraftForPart.id',
									'taxonomyDraftForPart.taxonomyId',
									'taxonomy.name as taxonomyName',
									'taxonomyDraftForPart.nrOfRounds',
									'taxonomyDraftForPart.nrOfItemsPerRound',
									'taxonomyDraftForPart.goal',
									'taxonomyDraftForPart.maxMistakes',
									'taxonomyDraftForPart.difficulty',
									'taxonomyDraftForPart.defaultNextPartId',
									eb
										.selectFrom('draftedAttribute')
										.whereRef(
											'draftedAttribute.taxonomyDraftForPartId',
											'=',
											'taxonomyDraftForPart.id'
										)
										.select((eb) =>
											eb.fn
												.agg<string[]>('array_agg', ['draftedAttribute.attributeId'])
												.as('draftedAttributeIds')
										)
										.as('draftedAttributeIds'),
									eb
										.selectFrom('draftedCategory')
										.whereRef(
											'draftedCategory.taxonomyDraftForPartId',
											'=',
											'taxonomyDraftForPart.id'
										)
										.select((eb) =>
											eb.fn
												.agg<string[]>('array_agg', ['draftedCategory.categoryId'])
												.as('draftedCategoryIds')
										)
										.as('draftedCategoryIds'),
									eb
										.selectFrom('draftedItem')
										.whereRef('draftedItem.taxonomyDraftForPartId', '=', 'taxonomyDraftForPart.id')
										.select((eb) =>
											eb.fn.agg<string[]>('array_agg', ['draftedItem.itemId']).as('draftedItemIds')
										)
										.as('draftedItemIds'),
									jsonArrayFrom(
										eb
											.selectFrom('attribute')
											.whereRef('attribute.taxonomyId', '=', 'taxonomyDraftForPart.taxonomyId')
											.orderBy('attribute.slug')
											.select(['attribute.id', 'attribute.slug', 'attribute.name'])
									).as('attributeOptions'),
									jsonArrayFrom(
										eb
											.selectFrom('category')
											.whereRef('category.taxonomyId', '=', 'taxonomyDraftForPart.taxonomyId')
											.orderBy('category.id')
											.select(['category.id', 'category.name'])
									).as('categoryOptions'),
									jsonArrayFrom(
										eb
											.selectFrom('item')
											.whereRef('item.taxonomyId', '=', 'taxonomyDraftForPart.taxonomyId')
											.orderBy('item.id')
											.select('item.id')
									).as('itemOptions'),
									jsonArrayFrom(
										eb
											.selectFrom('taxonomyDraftLogicRule')
											.whereRef(
												'taxonomyDraftLogicRule.taxonomyDraftForPartId',
												'=',
												'taxonomyDraftForPart.id'
											)
											.orderBy('taxonomyDraftLogicRule.order', 'asc')
											.select([
												'taxonomyDraftLogicRule.id',
												'taxonomyDraftLogicRule.order',
												'taxonomyDraftLogicRule.name',
												'taxonomyDraftLogicRule.nextPartId',
												'taxonomyDraftLogicRule.nrOfRounds',
												'taxonomyDraftLogicRule.score',
												'taxonomyDraftLogicRule.mistakes',
												'taxonomyDraftLogicRule.duration',
												eb.lit<boolean>(false).as('isRemoved')
											])
									).as('rules')
								])
						).as('taxonomyDraftForPart')
					])
					.orderBy('part.isInitial', 'desc')
			).as('parts')
		])
		.executeTakeFirstOrThrow();

	return rawstory;
};

export const findOneStoryBySlug = async (
	clientId: string,
	storySlug: string,
	language?: Language
) => {
	if (!clientId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))
		error(404, 'De client-ID is ongeldig.');

	const rawstory = await db
		.selectFrom('story')
		.where('story.slug', '=', storySlug)
		.where('story.clientId', '=', clientId)
		.where('story.isPublished', '=', true)
		.where('story.isPublic', '=', true)
		.select((eb) => [
			'story.id',
			'story.slug',
			'story.defaultBackgroundColor',
			selectLocalizedField(eb, 'story.name', language).as('name'),
			jsonArrayFrom(
				eb
					.selectFrom('part')
					.whereRef('part.storyId', '=', 'story.id')
					.select((eb) => [
						'part.id',

						// Background
						'part.backgroundType',
						'part.backgroundConfiguration',
						eb
							.case()
							.when('part.backgroundType', '=', 'video')
							.then(
								jsonObjectFrom(
									eb
										.selectFrom('video')
										.whereRef('video.id', '=', 'part.videoId')
										.select((eb) => [
											selectLocalizedMediaField(eb, 'video.source', language).as('source'),
											selectLocalizedMediaField(eb, 'video.thumbnail', language).as('thumbnail'),
											selectLocalizedField(eb, 'video.captions', language).as('captions'),
											'video.duration'
										])
										.$narrowType<{ source: NotNull; duration: NotNull }>()
								)
							)
							.when('part.backgroundType', '=', 'still')
							.then(
								jsonObjectFrom(
									eb
										.selectFrom('still')
										.whereRef('still.id', '=', 'part.stillId')
										.select(['still.color', 'still.image', 'still.style'])
								)
							)
							.else(null)
							.end()
							.as('background'),
						'part.defaultNextPartId',

						// Foreground
						'part.foregroundType',
						'part.foregroundConfiguration',
						'part.taxonomyDraftForPartId',
						eb
							.case()
							.when(eb('part.announcementTemplateId', 'is not', null))
							.then(
								jsonObjectFrom(
									eb
										.selectFrom('announcementTemplate')
										.whereRef('announcementTemplate.id', '=', 'part.announcementTemplateId')
										.select((eb) => [
											selectLocalizedField(eb, 'announcementTemplate.title', language).as('title'),
											selectLocalizedField(eb, 'announcementTemplate.message', language).as(
												'message'
											)
										])
								)
							)
							.when(eb('part.quizLogicForPartId', 'is not', null))
							.then(
								jsonObjectFrom(
									eb
										.selectFrom('quizLogicForPart as qlfp')
										.whereRef('qlfp.id', '=', 'part.quizLogicForPartId')
										.leftJoin('quizTemplate', 'quizTemplate.id', 'qlfp.quizTemplateId')
										.select((eb) => [
											'quizTemplate.doRandomize',
											jsonArrayFrom(
												eb
													.selectFrom('quizQuestionTemplate')
													.whereRef('quizQuestionTemplate.quizTemplateId', '=', 'quizTemplate.id')
													.orderBy('quizQuestionTemplate.order', 'asc')
													.select((eb) => [
														'quizQuestionTemplate.id',
														'quizQuestionTemplate.order',
														'quizQuestionTemplate.answerTemplateSlug',
														selectLocalizedField(eb, 'quizQuestionTemplate.title', language).as(
															'title'
														),
														selectLocalizedField(
															eb,
															'quizQuestionTemplate.instruction',
															language
														).as('instruction'),
														'quizQuestionTemplate.configuration',
														'quizQuestionTemplate.isRequired',
														jsonArrayFrom(
															eb
																.selectFrom('quizQuestionTemplateAnswerGroup')
																.whereRef(
																	'quizQuestionTemplateAnswerGroup.id',
																	'=',
																	'quizQuestionTemplate.quizQuestionTemplateAnswerGroupId'
																)
																.leftJoin(
																	'quizQuestionTemplateAnswerItem',
																	'quizQuestionTemplateAnswerItem.quizQuestionTemplateAnswerGroupId',
																	'quizQuestionTemplateAnswerGroup.id'
																)
																.orderBy('quizQuestionTemplateAnswerItem.order', 'asc')
																.select((eb) => [
																	'quizQuestionTemplateAnswerItem.id',
																	'quizQuestionTemplateAnswerItem.order',
																	// 'quizQuestionTemplateAnswerItem.value',
																	eb
																		.cast<string>('quizQuestionTemplateAnswerItem.value', 'text')
																		.as('value'),
																	selectLocalizedField(
																		eb,
																		'quizQuestionTemplateAnswerItem.label',
																		language
																	).as('label')
																])
																.$narrowType<{ order: NotNull; value: NotNull; label: NotNull }>()
														).as('answerOptions'),
														jsonObjectFrom(
															eb
																.selectFrom('quizQuestionTemplateAnswerGroup')
																.whereRef(
																	'quizQuestionTemplateAnswerGroup.id',
																	'=',
																	'quizQuestionTemplate.quizQuestionTemplateAnswerGroupId'
																)
																.select(['quizQuestionTemplateAnswerGroup.doRandomize'])
																.$narrowType<{ doRandomize: NotNull }>()
														).as('answerGroup')
													])
											).as('questions'),
											jsonObjectFrom(
												eb
													.selectFrom('quizLogicForPart')
													.whereRef('quizLogicForPart.id', '=', 'qlfp.id')
													.select((eb) => [
														'quizLogicForPart.hitpolicy',
														'quizLogicForPart.defaultNextPartId',
														jsonArrayFrom(
															eb
																.selectFrom('quizLogicRule')
																.whereRef(
																	'quizLogicRule.quizLogicForPartId',
																	'=',
																	'quizLogicForPart.id'
																)
																.orderBy('quizLogicRule.order', 'asc')
																.select((eb) => [
																	'quizLogicRule.order',
																	'quizLogicRule.name',
																	'quizLogicRule.nextPartId',
																	jsonArrayFrom(
																		eb
																			.selectFrom('quizLogicRuleInput')
																			.whereRef(
																				'quizLogicRuleInput.quizLogicRuleId',
																				'=',
																				'quizLogicRule.id'
																			)
																			.leftJoin(
																				'quizQuestionTemplateAnswerItem as qqtai',
																				'qqtai.id',
																				'quizLogicRuleInput.quizQuestionTemplateAnswerItemId'
																			)
																			.select((eb) => [
																				'quizLogicRuleInput.quizQuestionTemplateId',
																				eb
																					.case()
																					.when(eb('quizLogicRuleInput.value', 'is not', null))
																					.then(eb.ref('quizLogicRuleInput.value'))
																					.when(
																						eb(
																							'quizLogicRuleInput.quizQuestionTemplateAnswerItemId',
																							'is not',
																							null
																						)
																					)
																					.then(eb.ref('qqtai.value'))
																					.else(eb.val(null))
																					.end()
																					.as('value')
																				// 'quizLogicRuleInput.value',
																				// 'quizLogicRuleInput.quizQuestionTemplateAnswerItemId',
																			])
																			.$narrowType<{ quizQuestionTemplateId: NotNull }>()
																	).as('inputs')
																])
																.$narrowType<{ nextPartId: NotNull; inputs: NotNull }>()
														).as('rules')
													])
											).as('rawlogic')
										])
								)
							)
							.else(null)
							.end()
							.as('foreground')
					])
					.orderBy('part.isInitial', 'desc')
			).as('parts')
		])
		.executeTakeFirst();
	if (!rawstory) return;

	const taxonomyGames = new Map(
		await Promise.all(
			rawstory.parts
				.filter(
					(part) => part.foregroundType === 'taxonomy' && part.taxonomyDraftForPartId !== null
				)
				.map(
					async (part) =>
						[
							part.id,
							await loadTaxonomyGame(clientId, part.taxonomyDraftForPartId!, language)
						] as const
				)
		)
	);

	const story = {
		id: rawstory.id,
		slug: rawstory.slug,
		name: rawstory.name,
		defaultBackgroundColor: rawstory.defaultBackgroundColor,
		parts: rawstory.parts.map((part) => {
			const {
				background,
				backgroundConfiguration,
				foreground,
				foregroundConfiguration,
				...restPart
			} = part;
			const taxonomyGame = taxonomyGames.get(part.id);
			if (part.foregroundType === 'taxonomy' && taxonomyGame) {
				return {
					...restPart,
					background: { ...background, ...backgroundConfiguration },
					foreground: { ...taxonomyGame, ...foregroundConfiguration }
				};
			} else if (
				part.foregroundType === 'quiz' &&
				foreground &&
				typeof foreground === 'object' &&
				'questions' in foreground &&
				Array.isArray(foreground.questions) &&
				foreground.rawlogic &&
				typeof foreground.rawlogic === 'object'
			) {
				const { questions, rawlogic, ...restForeground } = foreground;

				// Outputs are fixed
				const outputs = [
					{
						field: 'next',
						id: 'next',
						name: 'Next part'
					}
				];

				// Inputs derived from questions array
				const inputs = questions.map((q) => ({
					id: q.id,
					field: q.id,
					name: q.title ?? q.id
				}));

				// Rules derived from rawlogic.rules
				const rawRules = Array.isArray(rawlogic.rules) ? rawlogic.rules : [];

				const rules = rawRules.map((r) => {
					const rule: Rule = {
						_id: String(r.order ?? ''),
						_description: r.name ?? '',
						next: r.nextPartId ?? null
					};

					const ruleInputs = Array.isArray(r.inputs) ? r.inputs : [];
					for (const ri of ruleInputs) {
						const qid = ri.quizQuestionTemplateId;
						if (!qid) continue;
						if (!new Map(inputs.map((i) => [i.id, i])).has(qid)) continue; // only add keys that correspond to actual questions
						rule[qid] = JSON.stringify(ri.value);
					}

					return rule;
				});

				if (rawlogic.defaultNextPartId) {
					rules.push({
						_id: 'default-after-quiz',
						_description: 'Default after quiz',
						next: rawlogic.defaultNextPartId
					});
				}

				return {
					...restPart,
					background: { ...background, ...backgroundConfiguration },
					foreground: {
						...restForeground,
						...foregroundConfiguration,
						questions,
						logic: {
							hitPolicy: rawlogic.hitpolicy ?? LogicHitpolicy.first,
							inputs,
							outputs,
							rules
						}
					}
				};
			} else {
				return {
					...restPart,
					background: { ...background, ...backgroundConfiguration },
					foreground: { ...foreground, ...foregroundConfiguration }
				};
			}
		})
	};

	return story;
};

export const findOnePartById = async (partId: string) => {
	const part = await db
		.selectFrom('part')
		.where('part.id', '=', partId)
		.leftJoin('quizLogicForPart as qlfp', 'qlfp.id', 'part.quizLogicForPartId')
		.leftJoin('quizTemplate', 'quizTemplate.id', 'qlfp.quizTemplateId')
		.leftJoin('taxonomyDraftForPart as tdfp', 'tdfp.id', 'part.taxonomyDraftForPartId')
		.select((eb) => [
			'part.id',
			'part.isInitial',
			'part.position',

			// Background
			'part.backgroundType',
			'part.backgroundConfiguration',
			'part.stillId',
			'part.videoId',
			'part.defaultNextPartId',

			// Foreground
			'part.foregroundType',
			'part.foregroundConfiguration',
			'part.announcementTemplateId',
			'quizTemplate.id as quizTemplateId',
			'part.quizLogicForPartId',
			'part.taxonomyDraftForPartId',
			'tdfp.taxonomyId as taxonomyId',

			jsonObjectFrom(
				eb
					.selectFrom('quizLogicForPart')
					.whereRef('quizLogicForPart.id', '=', 'part.quizLogicForPartId')
					.select((eb) => [
						'quizLogicForPart.hitpolicy',
						'quizLogicForPart.defaultNextPartId',
						jsonArrayFrom(
							eb
								.selectFrom('quizLogicRule')
								.whereRef('quizLogicRule.quizLogicForPartId', '=', 'quizLogicForPart.id')
								.orderBy('quizLogicRule.order', 'asc')
								.select((eb) => [
									'quizLogicRule.id',
									'quizLogicRule.order',
									'quizLogicRule.name',
									'quizLogicRule.nextPartId',
									jsonArrayFrom(
										eb
											.selectFrom('quizLogicRuleInput')
											.whereRef('quizLogicRuleInput.quizLogicRuleId', '=', 'quizLogicRule.id')
											.select([
												'quizLogicRuleInput.id',
												'quizLogicRuleInput.quizQuestionTemplateId',
												'quizLogicRuleInput.value',
												'quizLogicRuleInput.quizQuestionTemplateAnswerItemId',
												eb.lit<boolean>(false).as('isRemoved')
											])
											.$narrowType<{ id: NotNull; quizQuestionTemplateId: NotNull }>()
									).as('inputs'),
									eb.lit<boolean>(false).as('isRemoved')
								])
								.$narrowType<{ id: NotNull; inputs: NotNull; isRemoved: NotNull }>()
						).as('rules')
					])
			).as('quizLogicForPart'),

			jsonObjectFrom(
				eb
					.selectFrom('taxonomyDraftForPart')
					.whereRef('taxonomyDraftForPart.id', '=', 'part.taxonomyDraftForPartId')
					.innerJoin('taxonomy', 'taxonomy.id', 'taxonomyDraftForPart.taxonomyId')
					.select((eb) => [
						'taxonomyDraftForPart.id',
						'taxonomyDraftForPart.taxonomyId',
						'taxonomy.name as taxonomyName',
						'taxonomyDraftForPart.nrOfRounds',
						'taxonomyDraftForPart.nrOfItemsPerRound',
						'taxonomyDraftForPart.goal',
						'taxonomyDraftForPart.maxMistakes',
						'taxonomyDraftForPart.difficulty',
						'taxonomyDraftForPart.defaultNextPartId',
						eb
							.selectFrom('draftedAttribute')
							.whereRef('draftedAttribute.taxonomyDraftForPartId', '=', 'taxonomyDraftForPart.id')
							.select((eb) =>
								eb.fn
									.agg<string[]>('array_agg', ['draftedAttribute.attributeId'])
									.as('draftedAttributeIds')
							)
							.as('draftedAttributeIds'),
						eb
							.selectFrom('draftedCategory')
							.whereRef('draftedCategory.taxonomyDraftForPartId', '=', 'taxonomyDraftForPart.id')
							.select((eb) =>
								eb.fn
									.agg<string[]>('array_agg', ['draftedCategory.categoryId'])
									.as('draftedCategoryIds')
							)
							.as('draftedCategoryIds'),
						eb
							.selectFrom('draftedItem')
							.whereRef('draftedItem.taxonomyDraftForPartId', '=', 'taxonomyDraftForPart.id')
							.select((eb) =>
								eb.fn.agg<string[]>('array_agg', ['draftedItem.itemId']).as('draftedItemIds')
							)
							.as('draftedItemIds'),
						jsonArrayFrom(
							eb
								.selectFrom('attribute')
								.whereRef('attribute.taxonomyId', '=', 'taxonomyDraftForPart.taxonomyId')
								.orderBy('attribute.slug')
								.select(['attribute.id', 'attribute.slug', 'attribute.name'])
						).as('attributeOptions'),
						jsonArrayFrom(
							eb
								.selectFrom('category')
								.whereRef('category.taxonomyId', '=', 'taxonomyDraftForPart.taxonomyId')
								.orderBy('category.id')
								.select(['category.id', 'category.name'])
						).as('categoryOptions'),
						jsonArrayFrom(
							eb
								.selectFrom('item')
								.whereRef('item.taxonomyId', '=', 'taxonomyDraftForPart.taxonomyId')
								.orderBy('item.id')
								.select('item.id')
						).as('itemOptions'),
						jsonArrayFrom(
							eb
								.selectFrom('taxonomyDraftLogicRule')
								.whereRef(
									'taxonomyDraftLogicRule.taxonomyDraftForPartId',
									'=',
									'taxonomyDraftForPart.id'
								)
								.orderBy('taxonomyDraftLogicRule.order', 'asc')
								.select([
									'taxonomyDraftLogicRule.id',
									'taxonomyDraftLogicRule.order',
									'taxonomyDraftLogicRule.name',
									'taxonomyDraftLogicRule.nextPartId',
									'taxonomyDraftLogicRule.nrOfRounds',
									'taxonomyDraftLogicRule.score',
									'taxonomyDraftLogicRule.mistakes',
									'taxonomyDraftLogicRule.duration',
									eb.lit<boolean>(false).as('isRemoved')
								])
						).as('rules')
					])
			).as('taxonomyDraftForPart')
		])
		.executeTakeFirstOrThrow();

	return part;
};

export const findOneVideoById = async (videoId: string) => {
	const announcement = await db
		.selectFrom('video')
		.where('video.id', '=', videoId)
		.select([
			'video.id',
			'video.name',
			'video.source',
			'video.thumbnail',
			'video.captions',
			'video.duration'
		])
		.executeTakeFirstOrThrow();

	return announcement;
};

export const findOneStillById = async (stillId: string) => {
	return db
		.selectFrom('still')
		.where('still.id', '=', stillId)
		.select(['still.id', 'still.color', 'still.image', 'still.style'])
		.executeTakeFirstOrThrow();
};

export const findOneAnnouncementById = async (announcementId: string) => {
	const announcement = await db
		.selectFrom('announcementTemplate')
		.where('announcementTemplate.id', '=', announcementId)
		.select([
			'announcementTemplate.id',
			'announcementTemplate.name',
			'announcementTemplate.title',
			'announcementTemplate.message'
		])
		.executeTakeFirstOrThrow();

	return announcement;
};

export const findOneQuizById = async (quizId: string) => {
	const quiz = await db
		.selectFrom('quizTemplate')
		.where('quizTemplate.id', '=', quizId)
		.select((eb) => [
			'quizTemplate.id',
			'quizTemplate.name',
			'quizTemplate.doRandomize',
			jsonArrayFrom(
				eb
					.selectFrom('quizQuestionTemplate')
					.whereRef('quizQuestionTemplate.quizTemplateId', '=', 'quizTemplate.id')
					.orderBy('quizQuestionTemplate.order', 'asc')
					.select((eb) => [
						'quizQuestionTemplate.id',
						'quizQuestionTemplate.order',
						'quizQuestionTemplate.answerTemplateSlug',
						'quizQuestionTemplate.title',
						'quizQuestionTemplate.instruction',
						'quizQuestionTemplate.configuration',
						'quizQuestionTemplate.isRequired',
						jsonArrayFrom(
							eb
								.selectFrom('quizQuestionTemplateAnswerGroup')
								.whereRef(
									'quizQuestionTemplateAnswerGroup.id',
									'=',
									'quizQuestionTemplate.quizQuestionTemplateAnswerGroupId'
								)
								.leftJoin(
									'quizQuestionTemplateAnswerItem',
									'quizQuestionTemplateAnswerItem.quizQuestionTemplateAnswerGroupId',
									'quizQuestionTemplateAnswerGroup.id'
								)
								.orderBy('quizQuestionTemplateAnswerItem.order', 'asc')
								.select((eb) => [
									'quizQuestionTemplateAnswerItem.id',
									'quizQuestionTemplateAnswerItem.order',
									// 'quizQuestionTemplateAnswerItem.value',
									eb.cast<string>('quizQuestionTemplateAnswerItem.value', 'text').as('value'),
									'quizQuestionTemplateAnswerItem.label',
									eb.lit<boolean>(false).as('isRemoved')
								])
								.$narrowType<{
									id: NotNull;
									order: NotNull;
									value: NotNull;
									label: NotNull;
									isRemoved: NotNull;
								}>()
						).as('answerOptions'),
						jsonObjectFrom(
							eb
								.selectFrom('quizQuestionTemplateAnswerGroup')
								.whereRef(
									'quizQuestionTemplateAnswerGroup.id',
									'=',
									'quizQuestionTemplate.quizQuestionTemplateAnswerGroupId'
								)
								.select([
									'quizQuestionTemplateAnswerGroup.id',
									'quizQuestionTemplateAnswerGroup.slug',
									'quizQuestionTemplateAnswerGroup.doRandomize'
								])
								.$narrowType<{ id: NotNull; doRandomize: NotNull }>()
						).as('answerGroup'),
						eb.lit<boolean>(false).as('isRemoved')
					])
			).as('questions')
		])
		.executeTakeFirstOrThrow();

	return quiz;
};

export const findOneQuizLogicById = async (logicId: string) => {
	const logic = await db
		.selectFrom('quizLogicForPart')
		.where('quizLogicForPart.id', '=', logicId)
		.select((eb) => [
			'quizLogicForPart.hitpolicy',
			'quizLogicForPart.quizTemplateId',
			'quizLogicForPart.defaultNextPartId',
			jsonArrayFrom(
				eb
					.selectFrom('quizLogicRule')
					.whereRef('quizLogicRule.quizLogicForPartId', '=', 'quizLogicForPart.id')
					.orderBy('quizLogicRule.order', 'asc')
					.select((eb) => [
						'quizLogicRule.id',
						'quizLogicRule.order',
						'quizLogicRule.name',
						'quizLogicRule.nextPartId',
						jsonArrayFrom(
							eb
								.selectFrom('quizLogicRuleInput')
								.whereRef('quizLogicRuleInput.quizLogicRuleId', '=', 'quizLogicRule.id')
								.select([
									'quizLogicRuleInput.id',
									'quizLogicRuleInput.quizQuestionTemplateId',
									'quizLogicRuleInput.value',
									'quizLogicRuleInput.quizQuestionTemplateAnswerItemId',
									eb.lit<boolean>(false).as('isRemoved')
								])
								.$narrowType<{ id: NotNull; quizQuestionTemplateId: NotNull }>()
						).as('inputs'),
						eb.lit<boolean>(false).as('isRemoved')
					])
					.$narrowType<{ id: NotNull; inputs: NotNull; isRemoved: NotNull }>()
			).as('rules')
		])
		.executeTakeFirstOrThrow();

	return logic;
};
