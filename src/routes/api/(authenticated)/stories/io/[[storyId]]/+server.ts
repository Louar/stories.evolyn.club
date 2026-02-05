import { db } from '$lib/db/database';
import { findOneStoryById } from '$lib/db/repositories/2-stories-module';
import { error, json } from '@sveltejs/kit';
import YAML from 'yaml';
import type { RequestHandler } from './$types';
import { schema } from './schemas';

export const GET = (async ({ locals, params }) => {
  const clientId = locals.client.id;
  const storyId = params.storyId;
  if (!storyId?.length) error(422, 'Story ID is missing on path')

  const story = await findOneStoryById(clientId, storyId);

  const yaml = YAML.stringify(story);

  return new Response(yaml, {
    headers: {
      'content-type': 'application/yaml',
      'content-disposition': `attachment; filename="story-${story.reference}.yaml"`
    }
  });
}) satisfies RequestHandler;

export const POST = (async ({ locals, request }) => {
  const clientId = locals.client.id;
  const userId = locals.authusr!.id;

  const body = schema.safeParse(await request.json());
  if (!body.success) return json(body.error.issues, { status: 422 });
  const story_raw = body.data;

  const storyId = await db.transaction().execute(async (trx) => {
    // 1. Story
    const story = await trx
      .insertInto('story')
      .values({
        clientId,
        reference: `${story_raw.reference}-${crypto.randomUUID().toString().slice(0, 8)}`,
        name: JSON.stringify(story_raw.name),
        configuration: JSON.stringify(story_raw.configuration),
        isPublished: story_raw.isPublished,
        isPublic: story_raw.isPublic,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await trx
      .insertInto('storyPermission')
      .values({
        storyId: story.id,
        userId: userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // 2. Videos
    const mapOfVideos: Map<string, string> = new Map();
    for (const video_raw of story_raw.videos) {
      const video = await trx
        .insertInto('video')
        .values({
          name: video_raw.name,
          source: JSON.stringify(video_raw.source),
          thumbnail: JSON.stringify(video_raw.thumbnail),
          captions: JSON.stringify(video_raw.captions),
          duration: video_raw.duration,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await trx.insertInto('videoAvailableToStory').values({ storyId: story.id, videoId: video.id }).executeTakeFirstOrThrow();
      if (video_raw.id?.length) mapOfVideos.set(video_raw.id, video.id);
    }

    // 3. Announcement templates
    const mapOfAnnouncements: Map<string, string> = new Map();
    for (const announcement_raw of story_raw.announcements) {
      const announcement = await trx
        .insertInto('announcementTemplate')
        .values({
          name: announcement_raw.name,
          title: JSON.stringify(announcement_raw.title),
          message: JSON.stringify(announcement_raw.message),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await trx.insertInto('announcementTemplateAvailableToStory').values({ storyId: story.id, announcementTemplateId: announcement.id }).executeTakeFirstOrThrow();
      if (announcement_raw.id?.length) mapOfAnnouncements.set(announcement_raw.id, announcement.id);
    }

    // 4. Quiz templates
    const mapOfQuizzes: Map<string, string> = new Map();
    const mapOfQuestions: Map<string, string> = new Map();
    const mapOfAnswerItems: Map<string, string> = new Map();
    for (const quiz_raw of story_raw.quizzes) {
      const quiz = await trx
        .insertInto('quizTemplate')
        .values({ name: quiz_raw.name, doRandomize: quiz_raw.doRandomize })
        .returning('id')
        .executeTakeFirstOrThrow();
      await trx.insertInto('quizTemplateAvailableToStory').values({ storyId: story.id, quizTemplateId: quiz.id }).executeTakeFirstOrThrow();
      if (quiz_raw.id?.length) mapOfQuizzes.set(quiz_raw.id, quiz.id);

      for (const question_raw of quiz_raw.questions) {
        let ag: { id: string } | undefined;
        if (question_raw.answerGroup && question_raw.answerOptions?.length) {
          ag = await trx
            .insertInto('quizQuestionTemplateAnswerGroup')
            .values({ reference: 'play-pause-q1', name: 'Yes / No 1', doRandomize: true })
            .returning('id')
            .executeTakeFirstOrThrow();

          for (const ao of question_raw.answerOptions) {
            const ai = await trx
              .insertInto('quizQuestionTemplateAnswerItem')
              .values({
                quizQuestionTemplateAnswerGroupId: ag.id,
                order: ao.order,
                value: JSON.stringify(ao.value),
                label: JSON.stringify(ao.label),
              })
              .returning('id')
              .executeTakeFirstOrThrow();
            if (ao.id?.length) mapOfAnswerItems.set(ao.id, ai.id);
          }
        }

        const question = await trx
          .insertInto('quizQuestionTemplate')
          .values({
            quizTemplateId: quiz.id,
            order: question_raw.order,
            answerTemplateReference: question_raw.answerTemplateReference,
            title: JSON.stringify(question_raw.title),
            instruction: JSON.stringify(question_raw.instruction),
            placeholder: JSON.stringify(question_raw.placeholder),
            configuration: JSON.stringify(question_raw.configuration),
            isRequired: question_raw.isRequired,
            ...(ag?.id?.length ? { quizQuestionTemplateAnswerGroupId: ag.id } : {}),
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        if (question_raw.id?.length) mapOfQuestions.set(question_raw.id, question.id);
      }
    }

    // 5. Parts
    const mapOfParts: Map<string, string> = new Map();
    for (const part_raw of story_raw.parts) {
      let videoId: string | undefined = undefined;
      if (part_raw.videoId) videoId = mapOfVideos.get(part_raw.videoId);

      let announcementTemplateId: string | undefined = undefined;
      if (part_raw.announcementTemplateId) announcementTemplateId = mapOfAnnouncements.get(part_raw.announcementTemplateId);

      const part = await trx
        .insertInto('part')
        .values({
          storyId: story.id,
          backgroundType: part_raw.backgroundType,
          backgroundConfiguration: JSON.stringify(part_raw.backgroundConfiguration),
          foregroundType: part_raw.foregroundType,
          foregroundConfiguration: JSON.stringify(part_raw.foregroundConfiguration),
          isInitial: part_raw.isInitial,
          videoId,
          announcementTemplateId,
          position: JSON.stringify(part_raw.position),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      if (part_raw.id?.length) mapOfParts.set(part_raw.id, part.id);
    }

    // 6. Quiz logic for part
    const partsWithLogic = story_raw.parts?.filter((p) => p.quizLogicForPartId && p.quizLogicForPart);
    const mapOfPartsWithLogic: Map<string, string> = new Map();
    for (const part_raw of partsWithLogic) {
      const logic_raw = part_raw.quizLogicForPart!;

      const logic = await trx
        .insertInto('quizLogicForPart')
        .values({
          hitpolicy: logic_raw.hitpolicy,
          quizTemplateId: mapOfQuizzes.get(logic_raw.quizTemplateId)!,
          ...(logic_raw.defaultNextPartId?.length && mapOfParts.get(logic_raw.defaultNextPartId)?.length ? { defaultNextPartId: mapOfParts.get(logic_raw.defaultNextPartId) } : {}),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      if (part_raw.id?.length) mapOfPartsWithLogic.set(part_raw.id, logic.id);

      for (const rule_raw of logic_raw.rules) {
        const rule = await trx
          .insertInto('quizLogicRule')
          .values({
            order: rule_raw.order,
            name: rule_raw.name,
            quizLogicForPartId: logic.id,
            ...(rule_raw.nextPartId?.length && mapOfParts.get(rule_raw.nextPartId)?.length ? { nextPartId: mapOfParts.get(rule_raw.nextPartId) } : {}),
          })
          .returning('id')
          .executeTakeFirstOrThrow();

        for (const input_raw of rule_raw.inputs) {
          await trx
            .insertInto('quizLogicRuleInput')
            .values({
              quizLogicRuleId: rule.id,
              quizQuestionTemplateId: mapOfQuestions.get(input_raw.quizQuestionTemplateId)!,
              ...(input_raw.quizQuestionTemplateAnswerItemId?.length && mapOfAnswerItems.get(input_raw.quizQuestionTemplateAnswerItemId)?.length ? { quizQuestionTemplateAnswerItemId: mapOfAnswerItems.get(input_raw.quizQuestionTemplateAnswerItemId) } : {}),
              ...(input_raw.value ? { value: JSON.stringify(input_raw.value) } : {}),
            })
            .executeTakeFirstOrThrow();
        }
      }
    }

    // 7. Patch parts (ie, defaultNextPartId and quizLogicForPartId)
    for (const part_raw of story_raw.parts) {
      if (!part_raw.id?.length) continue;
      const currentPartId = mapOfParts.get(part_raw.id);
      console.log(currentPartId);
      if (!currentPartId?.length) continue;

      let defaultNextPartId: string | undefined = undefined;
      if (part_raw.defaultNextPartId?.length) defaultNextPartId = mapOfParts.get(part_raw.defaultNextPartId);

      let quizLogicForPartId: string | undefined = undefined;
      if (part_raw.quizLogicForPartId) quizLogicForPartId = mapOfPartsWithLogic.get(part_raw.id);

      await trx
        .updateTable('part')
        .set({
          defaultNextPartId,
          quizLogicForPartId,
        })
        .where('id', '=', currentPartId)
        .executeTakeFirstOrThrow();
    }

    return story.id;
  });

  const story = await findOneStoryById(clientId, storyId);

  return json(story);
}) satisfies RequestHandler;

// export const PUT = (async ({ locals, params, request }) => {
//   const clientId = locals.client.id;
//   const userId = locals.authusr!.id;
//   const storyId = params.storyId;

//     return json(story);
// }) satisfies RequestHandler;