import { db } from '$lib/db/database';
import { error } from '@sveltejs/kit';
import type { NotNull } from 'kysely';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';
import type { Rule } from '../../../routes/video/types';
import { Language, selectByOrientation, selectLocalizedField, StoryOrientation } from '../schemas/0-utils';
import { LogicHitpolicy } from '../schemas/2-story-module';

// TODO: remove reliance on language parameter
export const findOneStoryById = async (clientId: string, storyId: string, orientation?: StoryOrientation, language?: Language) => {

  if (!clientId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) error(404, 'De client-ID is ongeldig.');

  const rawstory = await db
    .selectFrom('story')
    .where('story.id', '=', storyId)
    .where('story.clientId', '=', clientId)
    .select((eb) => [
      'story.id',
      'story.reference',

      jsonArrayFrom(
        eb.selectFrom('video')
          .leftJoin('videoAvailableToStory', 'videoAvailableToStory.videoId', 'video.id')
          .whereRef('videoAvailableToStory.storyId', '=', 'story.id')
          .select((eb) => [
            'video.id',
            'video.name',
            selectByOrientation(eb, 'video.source', orientation).as('source'),
            selectByOrientation(eb, 'video.thumbnail', orientation).as('thumbnail'),
            selectLocalizedField(eb, 'video.captions', language).as('captions'),
            'video.duration',
          ])
      ).as('videos'),

      jsonArrayFrom(
        eb.selectFrom('announcementTemplate')
          .leftJoin('announcementTemplateAvailableToStory', 'announcementTemplateAvailableToStory.announcementTemplateId', 'announcementTemplate.id')
          .whereRef('announcementTemplateAvailableToStory.storyId', '=', 'story.id')
          .select((eb) => [
            'announcementTemplate.id',
            'announcementTemplate.name',
            selectLocalizedField(eb, 'announcementTemplate.title', language).as('title'),
            selectLocalizedField(eb, 'announcementTemplate.message', language).as('message'),
          ])
      ).as('announcements'),

      jsonArrayFrom(
        eb.selectFrom('quizTemplate')
          .leftJoin('quizTemplateAvailableToStory', 'quizTemplateAvailableToStory.quizTemplateId', 'quizTemplate.id')
          .whereRef('quizTemplateAvailableToStory.storyId', '=', 'story.id')
          .select((eb) => [
            'quizTemplate.id',
            'quizTemplate.name',
            'quizTemplate.doRandomize',
            jsonArrayFrom(
              eb.selectFrom('quizQuestionTemplate')
                .whereRef('quizQuestionTemplate.quizTemplateId', '=', 'quizTemplate.id')
                .orderBy('quizQuestionTemplate.order', 'asc')
                .select((eb) => [
                  'quizQuestionTemplate.id',
                  'quizQuestionTemplate.order',
                  'quizQuestionTemplate.answerTemplateReference',
                  selectLocalizedField(eb, 'quizQuestionTemplate.title', language).as('title'),
                  selectLocalizedField(eb, 'quizQuestionTemplate.instruction', language).as('instruction'),
                  'quizQuestionTemplate.configuration',
                  'quizQuestionTemplate.isRequired',
                  jsonArrayFrom(
                    eb.selectFrom('quizQuestionTemplateAnswerGroup')
                      .whereRef('quizQuestionTemplateAnswerGroup.id', '=', 'quizQuestionTemplate.quizQuestionTemplateAnswerGroupId')
                      .leftJoin('quizQuestionTemplateAnswerItem', 'quizQuestionTemplateAnswerItem.quizQuestionTemplateAnswerGroupId', 'quizQuestionTemplateAnswerGroup.id')
                      .orderBy('quizQuestionTemplateAnswerItem.order', 'asc')
                      .select((eb) => [
                        'quizQuestionTemplateAnswerItem.id',
                        'quizQuestionTemplateAnswerItem.order',
                        // 'quizQuestionTemplateAnswerItem.value',
                        eb.cast<string>('quizQuestionTemplateAnswerItem.value', 'text').as('value'),
                        selectLocalizedField(eb, 'quizQuestionTemplateAnswerItem.label', language).as('label'),
                        eb.lit<boolean>(false).as('isRemoved'),
                      ])
                      .$narrowType<{ id: NotNull, order: NotNull, value: NotNull, label: NotNull, isRemoved: NotNull }>()
                  ).as('answerOptions'),
                  jsonObjectFrom(
                    eb.selectFrom('quizQuestionTemplateAnswerGroup')
                      .whereRef('quizQuestionTemplateAnswerGroup.id', '=', 'quizQuestionTemplate.quizQuestionTemplateAnswerGroupId')
                      .select(['quizQuestionTemplateAnswerGroup.id', 'quizQuestionTemplateAnswerGroup.doRandomize'])
                      .$narrowType<{ id: NotNull, doRandomize: NotNull }>()
                  ).as('answerGroup'),
                  eb.lit<boolean>(false).as('isRemoved'),
                ])
            ).as('questions'),
          ])
      ).as('quizzes'),

      jsonArrayFrom(
        eb.selectFrom('part')
          .whereRef('part.storyId', '=', 'story.id')
          .leftJoin('quizLogicForPart as qlfp', 'qlfp.id', 'part.quizLogicForPartId')
          .leftJoin('quizTemplate', 'quizTemplate.id', 'qlfp.quizTemplateId')
          .select((eb) => [
            'part.id',
            'part.isInitial',
            'part.position',

            // Background
            'part.backgroundType',
            'part.backgroundConfiguration',
            'part.videoId',
            'part.defaultNextPartId',

            // Foreground
            'part.foregroundType',
            'part.foregroundConfiguration',
            'part.announcementTemplateId',
            'quizTemplate.id as quizTemplateId',
            'part.quizLogicForPartId',

            jsonObjectFrom(
              eb.selectFrom('quizLogicForPart')
                .whereRef('quizLogicForPart.id', '=', 'part.quizLogicForPartId')
                .select((eb) => [
                  'quizLogicForPart.hitpolicy',
                  'quizLogicForPart.defaultNextPartId',
                  jsonArrayFrom(
                    eb.selectFrom('quizLogicRule')
                      .whereRef('quizLogicRule.quizLogicForPartId', '=', 'quizLogicForPart.id')
                      .orderBy('quizLogicRule.order', 'asc')
                      .select((eb) => [
                        'quizLogicRule.id',
                        'quizLogicRule.order',
                        'quizLogicRule.name',
                        'quizLogicRule.nextPartId',
                        jsonArrayFrom(
                          eb.selectFrom('quizLogicRuleInput')
                            .whereRef('quizLogicRuleInput.quizLogicRuleId', '=', 'quizLogicRule.id')
                            .select([
                              'quizLogicRuleInput.id',
                              'quizLogicRuleInput.quizQuestionTemplateId',
                              'quizLogicRuleInput.value',
                              'quizLogicRuleInput.quizQuestionTemplateAnswerItemId',
                              eb.lit<boolean>(false).as('isRemoved'),
                            ])
                            .$narrowType<{ id: NotNull, quizQuestionTemplateId: NotNull }>()
                        ).as('inputs'),
                        eb.lit<boolean>(false).as('isRemoved'),
                      ])
                      .$narrowType<{ id: NotNull, inputs: NotNull, isRemoved: NotNull }>()
                  ).as('rules'),
                ])
            ).as('quizLogicForPart')
          ])
          .orderBy('part.isInitial', 'desc')
      ).as('parts'),
    ])
    .executeTakeFirstOrThrow();

  return rawstory;
}

export const findOneStoryByReference = async (clientId: string, storyReference: string, orientation?: StoryOrientation, language?: Language) => {

  if (!clientId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) error(404, 'De client-ID is ongeldig.');

  const rawstory = await db
    .selectFrom('story')
    .where('story.reference', '=', storyReference)
    .where('story.clientId', '=', clientId)
    .where('story.isPublic', '=', true)
    .select((eb) => [
      'story.reference',
      jsonArrayFrom(
        eb.selectFrom('part')
          .whereRef('part.storyId', '=', 'story.id')
          .select((eb) => [
            'part.id',

            // Background
            'part.backgroundType',
            'part.backgroundConfiguration',
            jsonObjectFrom(
              eb.selectFrom('video')
                .whereRef('video.id', '=', 'part.videoId')
                .select((eb) => [
                  selectByOrientation(eb, 'video.source', orientation).as('source'),
                  selectByOrientation(eb, 'video.thumbnail', orientation).as('thumbnail'),
                  selectLocalizedField(eb, 'video.captions', language).as('captions'),
                  'video.duration',
                ])
                .$narrowType<{ source: NotNull, duration: NotNull }>()
            ).$notNull().as('background'),
            'part.defaultNextPartId',

            // Foreground
            'part.foregroundType',
            'part.foregroundConfiguration',
            eb.case()
              .when(eb('part.announcementTemplateId', 'is not', null))
              .then(
                jsonObjectFrom(
                  eb
                    .selectFrom('announcementTemplate')
                    .whereRef('announcementTemplate.id', '=', 'part.announcementTemplateId')
                    .select((eb) => [
                      selectLocalizedField(eb, 'announcementTemplate.title', language).as('title'),
                      selectLocalizedField(eb, 'announcementTemplate.message', language).as('message'),
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
                        eb.selectFrom('quizQuestionTemplate')
                          .whereRef('quizQuestionTemplate.quizTemplateId', '=', 'quizTemplate.id')
                          .orderBy('quizQuestionTemplate.order', 'asc')
                          .select((eb) => [
                            'quizQuestionTemplate.id',
                            'quizQuestionTemplate.order',
                            'quizQuestionTemplate.answerTemplateReference',
                            selectLocalizedField(eb, 'quizQuestionTemplate.title', language).as('title'),
                            selectLocalizedField(eb, 'quizQuestionTemplate.instruction', language).as('instruction'),
                            'quizQuestionTemplate.configuration',
                            'quizQuestionTemplate.isRequired',
                            jsonArrayFrom(
                              eb.selectFrom('quizQuestionTemplateAnswerGroup')
                                .whereRef('quizQuestionTemplateAnswerGroup.id', '=', 'quizQuestionTemplate.quizQuestionTemplateAnswerGroupId')
                                .leftJoin('quizQuestionTemplateAnswerItem', 'quizQuestionTemplateAnswerItem.quizQuestionTemplateAnswerGroupId', 'quizQuestionTemplateAnswerGroup.id')
                                .orderBy('quizQuestionTemplateAnswerItem.order', 'asc')
                                .select((eb) => [
                                  'quizQuestionTemplateAnswerItem.order',
                                  // 'quizQuestionTemplateAnswerItem.value',
                                  eb.cast<string>('quizQuestionTemplateAnswerItem.value', 'text').as('value'),
                                  selectLocalizedField(eb, 'quizQuestionTemplateAnswerItem.label', language).as('label'),
                                ])
                                .$narrowType<{ order: NotNull, value: NotNull, label: NotNull }>()
                            ).as('answerOptions'),
                            jsonObjectFrom(
                              eb.selectFrom('quizQuestionTemplateAnswerGroup')
                                .whereRef('quizQuestionTemplateAnswerGroup.id', '=', 'quizQuestionTemplate.quizQuestionTemplateAnswerGroupId')
                                .select(['quizQuestionTemplateAnswerGroup.doRandomize'])
                                .$narrowType<{ doRandomize: NotNull }>()
                            ).as('answerGroup')
                          ])
                      ).as('questions'),
                      jsonObjectFrom(
                        eb.selectFrom('quizLogicForPart')
                          .whereRef('quizLogicForPart.id', '=', 'qlfp.id')
                          .select((eb) => [
                            'quizLogicForPart.hitpolicy',
                            'quizLogicForPart.defaultNextPartId',
                            jsonArrayFrom(
                              eb.selectFrom('quizLogicRule')
                                .whereRef('quizLogicRule.quizLogicForPartId', '=', 'quizLogicForPart.id')
                                .orderBy('quizLogicRule.order', 'asc')
                                .select((eb) => [
                                  'quizLogicRule.order',
                                  'quizLogicRule.name',
                                  'quizLogicRule.nextPartId',
                                  jsonArrayFrom(
                                    eb.selectFrom('quizLogicRuleInput')
                                      .whereRef('quizLogicRuleInput.quizLogicRuleId', '=', 'quizLogicRule.id')
                                      .select([
                                        'quizLogicRuleInput.quizQuestionTemplateId',
                                        'quizLogicRuleInput.value',
                                        'quizLogicRuleInput.quizQuestionTemplateAnswerItemId',
                                      ])
                                      .$narrowType<{ quizQuestionTemplateId: NotNull }>()
                                  ).as('inputs'),
                                ])
                                .$narrowType<{ nextPartId: NotNull, inputs: NotNull }>()
                            ).as('rules'),
                          ])
                      ).as('rawlogic')
                    ])
                )
              )
              .else(null)
              .end()
              .as('foreground'),
          ])
          .orderBy('part.isInitial', 'desc')
      ).as('parts'),
    ])
    .executeTakeFirstOrThrow();

  const story = {
    reference: rawstory.reference,
    parts: rawstory.parts.map(
      (part) => {
        const { background, backgroundConfiguration, foreground, foregroundConfiguration, ...restPart } = part;
        if (part.foregroundType === 'quiz' && foreground && typeof foreground === 'object' && 'questions' in foreground && Array.isArray(foreground.questions) && foreground.rawlogic && typeof foreground.rawlogic === 'object') {
          const { questions, rawlogic, ...restForeground } = foreground;

          // Outputs are fixed
          const outputs = [{
            field: 'next',
            id: 'next',
            name: 'Next part',
          }];

          // Inputs derived from questions array
          const inputs = questions.map((q) => ({
            id: q.id,
            field: q.id,
            name: q.title ?? q.id,
          }));

          // Rules derived from rawlogic.rules
          const rawRules = Array.isArray(rawlogic.rules) ? rawlogic.rules : [];

          const rules = rawRules.map((r) => {
            const rule: Rule = {
              _id: String(r.order ?? ''),
              _description: r.name ?? '',
              next: r.nextPartId ?? rawlogic.defaultNextPartId ?? null,
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
                rules,
              }
            }
          };
        } else {
          return {
            ...restPart,
            background: { ...background, ...backgroundConfiguration },
            foreground: { ...foreground, ...foregroundConfiguration },
          };
        }
      }
    ),
  }

  return story;
}

export const findOnePartById = async (partId: string) => {
  const part = await db.selectFrom('part')
    .where('part.id', '=', partId)
    .leftJoin('quizLogicForPart as qlfp', 'qlfp.id', 'part.quizLogicForPartId')
    .leftJoin('quizTemplate', 'quizTemplate.id', 'qlfp.quizTemplateId')
    .select((eb) => [
      'part.id',
      'part.isInitial',
      'part.position',

      // Background
      'part.backgroundType',
      'part.backgroundConfiguration',
      'part.videoId',
      'part.defaultNextPartId',

      // Foreground
      'part.foregroundType',
      'part.foregroundConfiguration',
      'part.announcementTemplateId',
      'quizTemplate.id as quizTemplateId',
      'part.quizLogicForPartId',

      jsonObjectFrom(
        eb.selectFrom('quizLogicForPart')
          .whereRef('quizLogicForPart.id', '=', 'part.quizLogicForPartId')
          .select((eb) => [
            'quizLogicForPart.hitpolicy',
            'quizLogicForPart.defaultNextPartId',
            jsonArrayFrom(
              eb.selectFrom('quizLogicRule')
                .whereRef('quizLogicRule.quizLogicForPartId', '=', 'quizLogicForPart.id')
                .orderBy('quizLogicRule.order', 'asc')
                .select((eb) => [
                  'quizLogicRule.id',
                  'quizLogicRule.order',
                  'quizLogicRule.name',
                  'quizLogicRule.nextPartId',
                  jsonArrayFrom(
                    eb.selectFrom('quizLogicRuleInput')
                      .whereRef('quizLogicRuleInput.quizLogicRuleId', '=', 'quizLogicRule.id')
                      .select([
                        'quizLogicRuleInput.id',
                        'quizLogicRuleInput.quizQuestionTemplateId',
                        'quizLogicRuleInput.value',
                        'quizLogicRuleInput.quizQuestionTemplateAnswerItemId',
                        eb.lit<boolean>(false).as('isRemoved'),
                      ])
                      .$narrowType<{ id: NotNull, quizQuestionTemplateId: NotNull }>()
                  ).as('inputs'),
                  eb.lit<boolean>(false).as('isRemoved'),
                ])
                .$narrowType<{ id: NotNull, inputs: NotNull, isRemoved: NotNull }>()
            ).as('rules'),
          ])
      ).as('quizLogicForPart')
    ])
    .executeTakeFirstOrThrow();

  return part;
}

// TODO: remove reliance on language parameter
export const findOneVideoById = async (videoId: string, language?: Language) => {
  const announcement = await db.selectFrom('video')
    .where('video.id', '=', videoId)
    .select((eb) => [
      'video.id',
      'video.name',
      selectByOrientation(eb, 'video.source', undefined).as('source'),
      selectByOrientation(eb, 'video.thumbnail', undefined).as('thumbnail'),
      selectLocalizedField(eb, 'video.captions', language).as('captions'),
      'video.duration',
    ])
    .executeTakeFirstOrThrow();

  return announcement;
}

// TODO: remove reliance on language parameter
export const findOneAnnouncementById = async (announcementId: string, language?: Language) => {
  const announcement = await db.selectFrom('announcementTemplate')
    .where('announcementTemplate.id', '=', announcementId)
    .select((eb) => [
      'announcementTemplate.id',
      'announcementTemplate.name',
      selectLocalizedField(eb, 'announcementTemplate.title', language).as('title'),
      selectLocalizedField(eb, 'announcementTemplate.message', language).as('message'),
    ])
    .executeTakeFirstOrThrow();

  return announcement;
}

// TODO: remove reliance on language parameter
export const findOneQuizById = async (quizId: string, language?: Language) => {
  const quiz = await db.selectFrom('quizTemplate')
    .where('quizTemplate.id', '=', quizId)
    .select((eb) => [
      'quizTemplate.id',
      'quizTemplate.name',
      'quizTemplate.doRandomize',
      jsonArrayFrom(
        eb.selectFrom('quizQuestionTemplate')
          .whereRef('quizQuestionTemplate.quizTemplateId', '=', 'quizTemplate.id')
          .orderBy('quizQuestionTemplate.order', 'asc')
          .select((eb) => [
            'quizQuestionTemplate.id',
            'quizQuestionTemplate.order',
            'quizQuestionTemplate.answerTemplateReference',
            selectLocalizedField(eb, 'quizQuestionTemplate.title', language).as('title'),
            selectLocalizedField(eb, 'quizQuestionTemplate.instruction', language).as('instruction'),
            'quizQuestionTemplate.configuration',
            'quizQuestionTemplate.isRequired',
            jsonArrayFrom(
              eb.selectFrom('quizQuestionTemplateAnswerGroup')
                .whereRef('quizQuestionTemplateAnswerGroup.id', '=', 'quizQuestionTemplate.quizQuestionTemplateAnswerGroupId')
                .leftJoin('quizQuestionTemplateAnswerItem', 'quizQuestionTemplateAnswerItem.quizQuestionTemplateAnswerGroupId', 'quizQuestionTemplateAnswerGroup.id')
                .orderBy('quizQuestionTemplateAnswerItem.order', 'asc')
                .select((eb) => [
                  'quizQuestionTemplateAnswerItem.id',
                  'quizQuestionTemplateAnswerItem.order',
                  // 'quizQuestionTemplateAnswerItem.value',
                  eb.cast<string>('quizQuestionTemplateAnswerItem.value', 'text').as('value'),
                  selectLocalizedField(eb, 'quizQuestionTemplateAnswerItem.label', language).as('label'),
                  eb.lit<boolean>(false).as('isRemoved'),
                ])
                .$narrowType<{ id: NotNull, order: NotNull, value: NotNull, label: NotNull, isRemoved: NotNull }>()
            ).as('answerOptions'),
            jsonObjectFrom(
              eb.selectFrom('quizQuestionTemplateAnswerGroup')
                .whereRef('quizQuestionTemplateAnswerGroup.id', '=', 'quizQuestionTemplate.quizQuestionTemplateAnswerGroupId')
                .select(['quizQuestionTemplateAnswerGroup.id', 'quizQuestionTemplateAnswerGroup.doRandomize'])
                .$narrowType<{ id: NotNull, doRandomize: NotNull }>()
            ).as('answerGroup'),
            eb.lit<boolean>(false).as('isRemoved'),
          ])
      ).as('questions'),
    ])
    .executeTakeFirstOrThrow();

  return quiz;
}

// TODO: remove reliance on language parameter
export const findOneQuizLogicById = async (logicId: string) => {
  const logic = await db.selectFrom('quizLogicForPart')
    .where('quizLogicForPart.id', '=', logicId)
    .select((eb) => [
      'quizLogicForPart.hitpolicy',
      'quizLogicForPart.defaultNextPartId',
      jsonArrayFrom(
        eb.selectFrom('quizLogicRule')
          .whereRef('quizLogicRule.quizLogicForPartId', '=', 'quizLogicForPart.id')
          .orderBy('quizLogicRule.order', 'asc')
          .select((eb) => [
            'quizLogicRule.id',
            'quizLogicRule.order',
            'quizLogicRule.name',
            'quizLogicRule.nextPartId',
            jsonArrayFrom(
              eb.selectFrom('quizLogicRuleInput')
                .whereRef('quizLogicRuleInput.quizLogicRuleId', '=', 'quizLogicRule.id')
                .select([
                  'quizLogicRuleInput.id',
                  'quizLogicRuleInput.quizQuestionTemplateId',
                  'quizLogicRuleInput.value',
                  'quizLogicRuleInput.quizQuestionTemplateAnswerItemId',
                  eb.lit<boolean>(false).as('isRemoved'),
                ])
                .$narrowType<{ id: NotNull, quizQuestionTemplateId: NotNull }>()
            ).as('inputs'),
            eb.lit<boolean>(false).as('isRemoved'),
          ])
          .$narrowType<{ id: NotNull, inputs: NotNull, isRemoved: NotNull }>()
      ).as('rules'),
    ])
    .executeTakeFirstOrThrow();

  return logic;
}
