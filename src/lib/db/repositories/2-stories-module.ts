import { db } from '$lib/db/database';
import { error } from '@sveltejs/kit';
import type { NotNull } from 'kysely';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';
import type { Rule } from '../../../routes/video/types';
import { Language, selectByOrientation, selectLocalizedField, StoryOrientation } from '../schemas/0-utils';
import { LogicHitpolicy } from '../schemas/2-story-module';


export const findStory = async (clientId: string, storyReference: string, orientation?: StoryOrientation, language?: Language) => {

  if (!clientId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) error(404, 'De client-ID is ongeldig.');

  const rawstory = await db
    .selectFrom('story')
    .where('story.reference', '=', storyReference)
    .where('story.clientId', '=', clientId)
    // .where('story.isPublic', '=', true)
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
                            // jsonObjectFrom(
                            //   eb.selectFrom('quizQuestionTemplateAnswerGroup')
                            //     .whereRef('quizQuestionTemplateAnswerGroup.id', '=', 'quizQuestionTemplate.quizQuestionTemplateAnswerGroupId')
                            //     .select(['quizQuestionTemplateAnswerGroup.doRandomize'])
                            // ).as('answerGroup')
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
          .orderBy('part.isFinal', 'asc')
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

          // --- inputs derived from QUESTIONS array ---
          const inputs = questions.map((q) => ({
            id: q.id,
            field: q.id,
            name: q.title ?? q.id,
          }));

          // --- outputs are fixed ---
          const outputs = [
            {
              field: 'next',
              id: 'next',
              name: 'Next part',
            },
          ];

          // Helper: stable lookup by question id
          const questionById = new Map(inputs.map((i) => [i.id, i]));

          // --- rules derived from rawlogic.rules ---
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

              // only add keys that correspond to actual questions (as requested)
              if (!questionById.has(qid)) continue;

              // stringify to get "\"Luzern\"" (matches your example)
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
