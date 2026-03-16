import { db } from '$lib/db/database';
import { parseBody, requireParam } from '$lib/server/utils.server';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { StoryEvent } from './schemas.js';
import { storyEventSchema } from './schemas.js';

const notFound = () =>
  json(
    { errors: { storyId: ['Story is not available for public event ingestion'] } },
    { status: 404 }
  );

const unprocessable = (message: string) =>
  json({ errors: { event: [message] } }, { status: 422 });

const storyIsPublicForClient = async (storyId: string, clientId: string) => {
  const story = await db
    .selectFrom('story')
    .select('story.id')
    .where('story.id', '=', storyId)
    .where('story.clientId', '=', clientId)
    .where('story.isPublished', '=', true)
    .where('story.isPublic', '=', true)
    .executeTakeFirst();

  return Boolean(story);
}

const partBelongsToStory = async (partId: string, storyId: string) => {
  const part = await db
    .selectFrom('part')
    .select('part.id')
    .where('part.id', '=', partId)
    .where('part.storyId', '=', storyId)
    .executeTakeFirst();

  return Boolean(part);
}

const allPartsBelongToStory = async (partIds: string[], storyId: string) => {
  const uniquePartIds = [...new Set(partIds)];

  const rows = await db
    .selectFrom('part')
    .select('part.id')
    .where('part.storyId', '=', storyId)
    .where('part.id', 'in', uniquePartIds)
    .execute();

  return rows.length === uniquePartIds.length;
}

const questionBelongsToStory = async (quizQuestionTemplateId: string, storyId: string) => {
  const question = await db
    .selectFrom('quizQuestionTemplate')
    .innerJoin('quizTemplate', 'quizTemplate.id', 'quizQuestionTemplate.quizTemplateId')
    .innerJoin('quizLogicForPart', 'quizLogicForPart.quizTemplateId', 'quizTemplate.id')
    .innerJoin('part', 'part.quizLogicForPartId', 'quizLogicForPart.id')
    .select('quizQuestionTemplate.id')
    .where('quizQuestionTemplate.id', '=', quizQuestionTemplateId)
    .where('part.storyId', '=', storyId)
    .executeTakeFirst();

  return Boolean(question);
}

const answerItemBelongsToStory = async (answerItemId: string, storyId: string) => {
  const answerItem = await db
    .selectFrom('quizQuestionTemplateAnswerItem')
    .innerJoin(
      'quizQuestionTemplateAnswerGroup',
      'quizQuestionTemplateAnswerGroup.id',
      'quizQuestionTemplateAnswerItem.quizQuestionTemplateAnswerGroupId'
    )
    .innerJoin(
      'quizQuestionTemplate',
      'quizQuestionTemplate.quizQuestionTemplateAnswerGroupId',
      'quizQuestionTemplateAnswerGroup.id'
    )
    .innerJoin('quizTemplate', 'quizTemplate.id', 'quizQuestionTemplate.quizTemplateId')
    .innerJoin('quizLogicForPart', 'quizLogicForPart.quizTemplateId', 'quizTemplate.id')
    .innerJoin('part', 'part.quizLogicForPartId', 'quizLogicForPart.id')
    .select('quizQuestionTemplateAnswerItem.id')
    .where('quizQuestionTemplateAnswerItem.id', '=', answerItemId)
    .where('part.storyId', '=', storyId)
    .executeTakeFirst();

  return Boolean(answerItem);
}

const handleTransitionEvent = async (storyId: string, payload: StoryEvent) => {
  const { url, session, event } = payload;

  if (event.type !== 'transition') {
    throw new Error('Expected transition event');
  }

  const validParts = await allPartsBelongToStory([event.fromPartId, event.toPartId], storyId);

  if (!validParts) {
    return unprocessable('One or more part ids do not belong to this story');
  }

  await db
    .insertInto('eventTransition')
    .values({
      url,
      session,
      createdAt: event.createdAt,
      fromPartId: event.fromPartId,
      toPartId: event.toPartId
    })
    .execute();

  return json({ success: true }, { status: 201 });
}

const handleInteractionEvent = async (storyId: string, payload: StoryEvent) => {
  const { url, session, event } = payload;

  if (event.type !== 'interaction') {
    throw new Error('Expected interaction event');
  }

  const [validPart, validQuestion] = await Promise.all([
    partBelongsToStory(event.partId, storyId),
    questionBelongsToStory(event.quizQuestionTemplateId, storyId)
  ]);

  if (!validPart) {
    return unprocessable('Part id does not belong to this story');
  }

  if (!validQuestion) {
    return unprocessable('Quiz question id does not belong to this story');
  }

  if (event.quizQuestionTemplateAnswerItemId) {
    const validAnswerItem = await answerItemBelongsToStory(
      event.quizQuestionTemplateAnswerItemId,
      storyId
    );

    if (!validAnswerItem) {
      return unprocessable('Quiz answer item id does not belong to this story');
    }
  }

  await db
    .insertInto('eventInteraction')
    .values({
      url,
      session,
      createdAt: event.createdAt,
      partId: event.partId,
      quizQuestionTemplateId: event.quizQuestionTemplateId,
      quizQuestionTemplateAnswerItemId: event.quizQuestionTemplateAnswerItemId,
      value: event.value === null ? null : JSON.stringify(event.value)
    })
    .execute();

  return json({ success: true }, { status: 201 });
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const clientId = locals.client.id;
  const storyId = requireParam(params.storyId, 'The story parameter is required');

  const parsed = await parseBody(request, storyEventSchema);
  if (!parsed.ok) return parsed.response;

  const storyAvailable = await storyIsPublicForClient(storyId, clientId);
  if (!storyAvailable) return notFound();

  return parsed.data.event.type === 'transition'
    ? handleTransitionEvent(storyId, parsed.data)
    : handleInteractionEvent(storyId, parsed.data);
};
