import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { schema as storySchema } from '../../routes/api/(authenticated)/(2-story-module)/(role:editor|admin)/stories/[[storyId]]/io/schemas';
import { schema as taxonomySchema } from '../../routes/api/(authenticated)/(2-story-module)/(role:editor|admin)/taxonomies/[[taxonomyId]]/io/schemas';
import { schema as anthologySchema } from '../../routes/api/(authenticated)/(2-story-module)/(role:editor|admin)/anthologies/[[anthologyId]]/io/schemas';
import { demos } from './catalog';

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
		expect(anthology.positions.map((position) => position.storySlug)).toEqual(
			demos.stories.map((demo) => demo.slug)
		);
		for (const story of anthology.stories!)
			expect(story).toEqual(storySchema.parse(load('stories', story.slug)));
		const expedition = storySchema.parse(load('stories', 'world-food-expedition'));
		expect(expedition.parts.filter((part) => part.taxonomyDraftForPart)).toHaveLength(5);
		expect(expedition.animations).toHaveLength(2);
		expect(expedition.parts.every((part) => part.backgroundType === 'animation')).toBe(true);
	});
});
