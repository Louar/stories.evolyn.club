import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { schema as storySchema } from '../../routes/api/(authenticated)/(2-story-module)/(role:editor|admin)/stories/[[storyId]]/io/schemas';
import { schema as taxonomySchema } from '../../routes/api/(authenticated)/(2-story-module)/(role:editor|admin)/taxonomies/[[taxonomyId]]/io/schemas';
import { schema as anthologySchema } from '../../routes/api/(authenticated)/(2-story-module)/(role:editor|admin)/anthologies/[[anthologyId]]/io/schemas';
import { demos } from './catalog';
import {
	getRoundedVideoTime,
	getVideoSourceType,
	getYouTubeVideoId,
	isYouTubeShort
} from '$lib/media/video';

const files = import.meta.glob('./*/*.yaml', { query: '?raw', import: 'default', eager: true });
const parsed = new Map<string, unknown>();
const load = (kind: string, slug: string) => {
	const path = `./${kind}/${slug}.yaml`;
	if (!parsed.has(path)) parsed.set(path, YAML.parse(files[path] as string));
	return parsed.get(path);
};

describe('demo bundles', { timeout: 20000 }, () => {
	it('validates every catalog entry against the real import schemas', () => {
		for (const [kind, schema] of Object.entries({
			stories: storySchema,
			taxonomies: taxonomySchema,
			anthologies: anthologySchema
		})) {
			for (const demo of demos[kind as keyof typeof demos]) {
				expect(schema.safeParse(load(kind, demo.slug)).success, `${kind}/${demo.slug}`).toBe(true);
			}
		}
	});

	it('includes city quiz assets, numeric answers, and fail/success branches', () => {
		const story = storySchema.parse(load('stories', 'quiz-of-cities'));
		expect(story.parts).toHaveLength(9);
		expect(story.videos).toHaveLength(7);
		expect(story.quizzes[0].questions[0].answerOptions.map((option) => option.value)).toEqual([
			1, 0
		]);
		expect(story.parts.find((part) => part.terminationStrategy === 'FAIL_STORY')?.id).toBe(
			'part-7'
		);
		expect(story.parts.find((part) => part.terminationStrategy === 'COMPLETE_STORY')?.id).toBe(
			'part-9'
		);
	});

	it.each(['general-taxonomy', 'food-taxonomy'])(
		'preserves translated questions and accepts legacy attributes in %s',
		(slug) => {
			const bundle = taxonomySchema.parse(load('taxonomies', slug));
			const calories = bundle.attributes.find((attribute) => attribute.slug === 'calories')!;
			expect(calories.question).toEqual({
				en: 'How much energy per 100 g (kcal)?',
				nl: 'Hoeveel energie per 100 g (kcal)?'
			});
			expect(taxonomySchema.parse(JSON.parse(JSON.stringify(bundle)))).toEqual(bundle);
			const legacy = {
				...bundle,
				attributes: bundle.attributes.map((attribute) =>
					Object.fromEntries(Object.entries(attribute).filter(([key]) => key !== 'question'))
				)
			};
			expect(
				taxonomySchema.parse(legacy).attributes.every((attribute) => attribute.question === null)
			).toBe(true);
		}
	);

	it('preserves the genuine workout Shorts and regular video sources', () => {
		const story = storySchema.parse(load('stories', 'home-workout'));
		expect(story.isPublished).toBe(false);
		expect(story.videos).toHaveLength(4);
		const sources = story.videos.map((video) => {
			expect(video.source.default?.collection).toBe('externals');
			expect(video.duration).toBeGreaterThan(0);
			const source = video.source.default!.filename;
			expect(getVideoSourceType(source)).toBe('youtube');
			return source;
		});
		expect(sources.map(getYouTubeVideoId)).toEqual([
			'JgWcw0ozVRw',
			'gC_L9qAHVJ8',
			'UItWltVZZmE',
			'bfSIZPSuGQo'
		]);
		expect(sources.map(isYouTubeShort)).toEqual([true, false, false, true]);
		expect(story.parts).toHaveLength(story.videos.length);
		expect(story.parts.map((part) => part.videoId)).toEqual(story.videos.map((video) => video.id));
		expect(sources).toEqual([
			'https://www.youtube.com/shorts/JgWcw0ozVRw',
			'https://www.youtube.com/watch?v=gC_L9qAHVJ8',
			'https://www.youtube.com/watch?v=UItWltVZZmE',
			'https://www.youtube.com/shorts/bfSIZPSuGQo'
		]);
	});

	it('uses normalized 10-second workout clips with source-relative overlay cues', () => {
		const story = storySchema.parse(load('stories', 'home-workout'));
		const intervals = [
			[10, 20],
			[120, 130],
			[60, 70],
			[5, 15]
		];
		expect(story.parts.map((part) => part.foregroundType)).toEqual([
			'announcement',
			'quiz',
			'quiz',
			'announcement'
		]);
		for (const [index, part] of story.parts.entries()) {
			const video = story.videos.find((video) => video.id === part.videoId)!;
			const { start, end } = part.backgroundConfiguration!;
			expect(typeof start).toBe('number');
			expect(typeof end).toBe('number');
			expect(start).toBeGreaterThanOrEqual(0);
			expect(end).toBeGreaterThan(start as number);
			expect(end).toBeLessThanOrEqual(1);
			const clipStart = getRoundedVideoTime(start as number, video.duration)!;
			const clipEnd = getRoundedVideoTime(end as number, video.duration)!;
			expect([clipStart, clipEnd]).toEqual(intervals[index]);
			expect(clipEnd - clipStart).toBe(10);
			// Story computes foreground cues from the full duration, without rounding.
			const cue = (part.foregroundConfiguration!.start as number) * video.duration - clipStart;
			expect(cue).toBeCloseTo(part.foregroundType === 'quiz' ? 10 : 0, 8);
		}
	});

	it('advances correct workout answers, retries incorrect ones, and ends after the summary', () => {
		const story = storySchema.parse(load('stories', 'home-workout'));
		expect(story.announcements).toHaveLength(2);
		expect(story.quizzes).toHaveLength(2);
		for (const [index, part] of story.parts.entries()) {
			const next = story.parts[index + 1];
			expect(part.isInitial).toBe(index === 0);
			expect(part.backgroundType).toBe('video');
			expect(part.taxonomyDraftForPart).toBeFalsy();
			expect(part.terminationStrategy).toBe(next ? 'NONE' : 'COMPLETE_STORY');
			if (part.foregroundType === 'announcement') {
				expect(part.defaultNextPartId).toBe(next?.id ?? null);
				expect(part.quizLogicForPart).toBeNull();
				const announcement = story.announcements.find(
					(item) => item.id === part.announcementTemplateId
				)!;
				expect(announcement.title?.en).toBeTruthy();
				expect(announcement.message?.nl).toBeTruthy();
				continue;
			}
			expect(part.defaultNextPartId).toBeNull();
			expect(part.announcementTemplateId).toBeNull();
			expect(part.quizLogicForPartId).toBeTruthy();
			const logic = part.quizLogicForPart!;
			expect(logic.hitpolicy).toBe('first');
			expect(logic.quizTemplateId).toBe(part.quizTemplateId);
			expect(logic.defaultNextPartId).toBe(part.id);
			expect(logic.rules).toHaveLength(1);
			const rule = logic.rules[0];
			expect(rule.nextPartId).toBe(next!.id);
			expect(rule.inputs).toHaveLength(1);
			const quiz = story.quizzes.find((quiz) => quiz.id === part.quizTemplateId)!;
			expect(quiz.questions).toHaveLength(1);
			const question = quiz.questions[0];
			expect(question.answerTemplateSlug).toBe('select-single');
			expect(question.isRequired).toBe(true);
			expect(question.instruction?.en).toContain('replays this clip');
			expect(rule.inputs[0].quizQuestionTemplateId).toBe(question.id);
			expect(rule.inputs[0].value).toBeNull();
			const correct = question.answerOptions.find(
				(answer) => answer.id === rule.inputs[0].quizQuestionTemplateAnswerItemId
			)!;
			expect(correct.value).toBe(index === 1 ? 'comfortable' : 'steady');
			expect(question.answerOptions).toHaveLength(2);
			expect(new Set(question.answerOptions.map((answer) => answer.value)).size).toBe(2);
		}
	});

	it.each(['general-taxonomy', 'food-taxonomy'])(
		'contains valid taxonomy relations in %s',
		(slug) => {
			const bundle = taxonomySchema.parse(load('taxonomies', slug));
			const categories = new Set(bundle.categories.map((row) => row.id));
			const attributes = new Map(bundle.attributes.map((row) => [row.id, row]));
			const items = new Set(bundle.items.map((row) => row.id));
			expect(items.size).toBe(bundle.items.length);
			for (const attribute of bundle.attributes) {
				if (attribute.referencedCategoryId)
					expect(categories.has(attribute.referencedCategoryId)).toBe(true);
			}
			for (const relation of bundle.attributeOfCategories) {
				expect(categories.has(relation.categoryId) && attributes.has(relation.attributeId)).toBe(
					true
				);
			}
			for (const relation of bundle.itemOfCategories) {
				expect(categories.has(relation.categoryId) && items.has(relation.itemId)).toBe(true);
			}
			for (const relation of bundle.attributeOfItems) {
				expect(items.has(relation.itemId) && attributes.has(relation.attributeId)).toBe(true);
				if (relation.referencedItemId) {
					expect(items.has(relation.referencedItemId)).toBe(true);
					expect(bundle.itemOfCategories).toContainEqual({
						itemId: relation.referencedItemId,
						categoryId: attributes.get(relation.attributeId)!.referencedCategoryId
					});
				}
			}
		}
	);

	it('resolves story assets, graph edges, rule inputs, and portable taxonomy attributes', () => {
		for (const demo of demos.stories) {
			const story = storySchema.parse(load('stories', demo.slug));
			const parts = new Set(story.parts.map((part) => part.id));
			expect(parts.size).toBe(story.parts.length);
			expect(story.parts.filter((part) => part.isInitial)).toHaveLength(1);
			const checkNext = (id: string | null) => {
				if (id) expect(parts.has(id)).toBe(true);
			};
			for (const part of story.parts) {
				checkNext(part.defaultNextPartId);
				for (const [id, assets] of [
					[part.videoId, story.videos],
					[part.animationId, story.animations],
					[part.stillId, story.stills],
					[part.announcementTemplateId, story.announcements]
				] as const) {
					if (id) expect(assets.some((asset) => asset.id === id)).toBe(true);
				}
				if (part.quizLogicForPart) {
					const logic = part.quizLogicForPart;
					checkNext(logic.defaultNextPartId);
					const quiz = story.quizzes.find((quiz) => quiz.id === logic.quizTemplateId)!;
					expect(quiz).toBeDefined();
					for (const rule of logic.rules) {
						checkNext(rule.nextPartId);
						for (const input of rule.inputs) {
							const question = quiz.questions.find(
								(question) => question.id === input.quizQuestionTemplateId
							)!;
							expect(question).toBeDefined();
							if (input.quizQuestionTemplateAnswerItemId)
								expect(
									question.answerOptions.some(
										(answer) => answer.id === input.quizQuestionTemplateAnswerItemId
									)
								).toBe(true);
						}
					}
				}
				if (part.taxonomyDraftForPart) {
					const draft = part.taxonomyDraftForPart;
					const taxonomy = taxonomySchema.parse(load('taxonomies', draft.taxonomySlug));
					expect(draft.draftedCategoryIds).toEqual([]);
					expect(draft.draftedItemIds).toEqual([]);
					for (const id of draft.draftedAttributeIds ?? []) {
						const slug = draft.attributeOptions?.find((option) => option.id === id)?.slug;
						const attribute = taxonomy.attributes.find((attribute) => attribute.slug === slug)!;
						expect(attribute).toBeDefined();
						expect(['number', 'translatable_category', 'item_reference']).toContain(attribute.type);
						expect(
							taxonomy.attributeOfItems.filter((value) => value.attributeId === attribute.id).length
						).toBeGreaterThanOrEqual(draft.nrOfItemsPerRound!);
					}
					checkNext(draft.defaultNextPartId);
					for (const rule of draft.rules) checkNext(rule.nextPartId);
				}
			}
		}
	});

	it('embeds the same stories in anthology order and includes a substantial animated draft', () => {
		const anthology = anthologySchema.parse(load('anthologies', 'discovery-collection'));
		expect(anthology.stories).toHaveLength(3);
		expect(anthology.positions.map((position) => position.storySlug)).toEqual([
			'quiz-of-cities',
			'trail-decisions',
			'world-food-expedition'
		]);
		for (const story of anthology.stories!)
			expect(story).toEqual(storySchema.parse(load('stories', story.slug)));
		const expedition = storySchema.parse(load('stories', 'world-food-expedition'));
		expect(expedition.parts.filter((part) => part.taxonomyDraftForPart)).toHaveLength(5);
		expect(expedition.animations).toHaveLength(2);
		expect(expedition.parts.every((part) => part.backgroundType === 'animation')).toBe(true);
	});
});
