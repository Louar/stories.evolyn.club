import { db } from '$lib/db/database';
import { findOneStoryById } from '$lib/db/repositories/2-story-module';
import { canModifyStory } from '$lib/server/utils.server';
import type { PageServerLoad } from './$types';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const parseDate = (value: string | null, fallback: Date) => {
	if (!value || !DATE_PATTERN.test(value)) return fallback;
	const date = new Date(`${value}T00:00:00.000Z`);
	return Number.isNaN(date.getTime()) || formatDate(date) !== value ? fallback : date;
};

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const storyId = params.storyId;
	await canModifyStory(locals, storyId);

	const today = new Date();
	today.setUTCHours(0, 0, 0, 0);
	const thirtyDaysAgo = new Date(today);
	thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 29);

	let start = parseDate(url.searchParams.get('start'), thirtyDaysAgo);
	let end = parseDate(url.searchParams.get('end'), today);
	if (start > end) [start, end] = [end, start];

	const endExclusive = new Date(end);
	endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

	const transitionBase = () =>
		db
			.selectFrom('eventTransition')
			.innerJoin('part as transitionPart', 'transitionPart.id', 'eventTransition.fromPartId')
			.where('transitionPart.storyId', '=', storyId)
			.where('eventTransition.createdAt', '>=', start)
			.where('eventTransition.createdAt', '<', endExclusive);

	const interactionBase = () =>
		db
			.selectFrom('eventInteraction')
			.innerJoin('part as interactionPart', 'interactionPart.id', 'eventInteraction.partId')
			.where('interactionPart.storyId', '=', storyId)
			.where('eventInteraction.createdAt', '>=', start)
			.where('eventInteraction.createdAt', '<', endExclusive);

	const [story, transitions, interactions, transitionSessions] = await Promise.all([
		findOneStoryById(locals.client.id, storyId),
		transitionBase()
			.select((eb) => [
				'eventTransition.fromPartId',
				'eventTransition.toPartId',
				eb.fn.countAll<number>().as('count')
			])
			.groupBy(['eventTransition.fromPartId', 'eventTransition.toPartId'])
			.execute(),
		interactionBase()
			.select((eb) => [
				'eventInteraction.partId',
				'eventInteraction.quizQuestionTemplateId',
				'eventInteraction.quizQuestionTemplateAnswerItemId',
				'eventInteraction.value',
				eb.fn.countAll<number>().as('count')
			])
			.groupBy([
				'eventInteraction.partId',
				'eventInteraction.quizQuestionTemplateId',
				'eventInteraction.quizQuestionTemplateAnswerItemId',
				'eventInteraction.value'
			])
			.execute(),
		transitionBase().select('eventTransition.session').distinct().execute()
	]);

	return {
		story,
		transitions,
		interactions,
		stats: {
			sessions: transitionSessions.length,
			transitions: transitions.reduce((total, transition) => total + transition.count, 0),
			interactions: interactions.reduce((total, interaction) => total + interaction.count, 0)
		},
		range: {
			start: formatDate(start),
			end: formatDate(end)
		}
	};
};
