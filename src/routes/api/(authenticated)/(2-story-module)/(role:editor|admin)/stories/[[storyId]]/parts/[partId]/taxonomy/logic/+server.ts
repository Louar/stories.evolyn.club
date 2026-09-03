import { db } from '$lib/db/database';
import { findOnePartById } from '$lib/db/repositories/2-story-module';
import { canModifyStory, requireParam } from '$lib/server/utils.server';
import { json } from '@sveltejs/kit';
import z from 'zod/v4';
import type { RequestHandler } from './$types';

const rangeSchema = z.tuple([z.number().int().nullable(), z.number().int().nullable()]).nullable();
const ruleSchema = z.object({
	id: z.string().min(1),
	order: z.number().int().positive(),
	name: z.string().trim().optional(),
	nextPartId: z.string().nullable().optional(),
	nrOfRounds: rangeSchema,
	score: rangeSchema,
	mistakes: rangeSchema,
	duration: rangeSchema,
	isRemoved: z.boolean().optional()
});
const schema = z.object({
	taxonomyId: z.string().min(1),
	nrOfRounds: z.number().int().positive().nullable(),
	nrOfItemsPerRound: z.number().int().positive().nullable(),
	goal: z.number().int().positive().nullable(),
	maxMistakes: z.number().int().nonnegative().nullable(),
	difficulty: z.number().int().nonnegative().nullable(),
	draftedAttributeIds: z.array(z.string().min(1)).default([]),
	draftedCategoryIds: z.array(z.string().min(1)).default([]),
	draftedItemIds: z.array(z.string().min(1)).default([]),
	rules: z.array(ruleSchema)
});

const assertTaxonomyMembers = async (
	table: 'attribute' | 'category' | 'item',
	ids: string[],
	taxonomyId: string
) => {
	const uniqueIds = [...new Set(ids)];
	if (!uniqueIds.length) return uniqueIds;

	const validRows = await db
		.selectFrom(table)
		.where(`${table}.taxonomyId`, '=', taxonomyId)
		.where(`${table}.id`, 'in', uniqueIds)
		.select(`${table}.id`)
		.execute();

	if (validRows.length !== uniqueIds.length) {
		throw new Error(`One or more selected ${table}s do not exist in this taxonomy`);
	}

	return uniqueIds;
};

/**
 * @openapi
 * summary: Update taxonomy logic
 * tags:
 *  - Stories
 *  - Assistant
 */
export const POST = (async ({ locals, params, request }) => {
	const storyId = requireParam(params.storyId, 'The story path parameter is required');
	const partId = requireParam(params.partId, 'The part path parameter is required');
	await canModifyStory(locals, storyId);

	const parsed = schema.safeParse(await request.json());
	if (!parsed.success) return json(parsed.error.issues, { status: 422 });

	const taxonomy = await db
		.selectFrom('taxonomy')
		.where('id', '=', parsed.data.taxonomyId)
		.where('clientId', '=', locals.client.id)
		.select('id')
		.executeTakeFirst();
	if (!taxonomy) return json({ message: 'The taxonomy does not exist' }, { status: 404 });

	let draftedAttributeIds: string[];
	let draftedCategoryIds: string[];
	let draftedItemIds: string[];
	try {
		[draftedAttributeIds, draftedCategoryIds, draftedItemIds] = await Promise.all([
			assertTaxonomyMembers('attribute', parsed.data.draftedAttributeIds, parsed.data.taxonomyId),
			assertTaxonomyMembers('category', parsed.data.draftedCategoryIds, parsed.data.taxonomyId),
			assertTaxonomyMembers('item', parsed.data.draftedItemIds, parsed.data.taxonomyId)
		]);
	} catch (error) {
		return json(
			{ message: error instanceof Error ? error.message : 'Invalid draft selection' },
			{ status: 422 }
		);
	}

	await db.transaction().execute(async (trx) => {
		const part = await trx
			.selectFrom('part')
			.where('id', '=', partId)
			.where('storyId', '=', storyId)
			.select(['id', 'taxonomyDraftForPartId'])
			.executeTakeFirstOrThrow();

		const draft = await trx
			.insertInto('taxonomyDraftForPart')
			.values({
				id: part.taxonomyDraftForPartId ?? undefined,
				taxonomyId: parsed.data.taxonomyId,
				nrOfRounds: parsed.data.nrOfRounds,
				nrOfItemsPerRound: parsed.data.nrOfItemsPerRound,
				goal: parsed.data.goal,
				maxMistakes: parsed.data.maxMistakes,
				difficulty: parsed.data.difficulty
			})
			.onConflict((oc) =>
				oc.column('id').doUpdateSet({
					taxonomyId: parsed.data.taxonomyId,
					nrOfRounds: parsed.data.nrOfRounds,
					nrOfItemsPerRound: parsed.data.nrOfItemsPerRound,
					goal: parsed.data.goal,
					maxMistakes: parsed.data.maxMistakes,
					difficulty: parsed.data.difficulty
				})
			)
			.returning('id')
			.executeTakeFirstOrThrow();

		if (!part.taxonomyDraftForPartId) {
			await trx
				.updateTable('part')
				.where('id', '=', partId)
				.set({ foregroundType: 'taxonomy', taxonomyDraftForPartId: draft.id })
				.executeTakeFirstOrThrow();
		}

		await Promise.all([
			trx.deleteFrom('draftedAttribute').where('taxonomyDraftForPartId', '=', draft.id).execute(),
			trx.deleteFrom('draftedCategory').where('taxonomyDraftForPartId', '=', draft.id).execute(),
			trx.deleteFrom('draftedItem').where('taxonomyDraftForPartId', '=', draft.id).execute()
		]);

		await Promise.all([
			draftedAttributeIds.length
				? trx
						.insertInto('draftedAttribute')
						.values(
							draftedAttributeIds.map((attributeId) => ({
								taxonomyDraftForPartId: draft.id,
								attributeId
							}))
						)
						.execute()
				: Promise.resolve(),
			draftedCategoryIds.length
				? trx
						.insertInto('draftedCategory')
						.values(
							draftedCategoryIds.map((categoryId) => ({
								taxonomyDraftForPartId: draft.id,
								categoryId
							}))
						)
						.execute()
				: Promise.resolve(),
			draftedItemIds.length
				? trx
						.insertInto('draftedItem')
						.values(draftedItemIds.map((itemId) => ({ taxonomyDraftForPartId: draft.id, itemId })))
						.execute()
				: Promise.resolve()
		]);

		const activeRules = parsed.data.rules.filter((rule) => !rule.isRemoved);
		const retainedIds = activeRules.map((rule) => rule.id).filter((id) => !id.startsWith('new-'));
		await trx
			.deleteFrom('taxonomyDraftLogicRule')
			.where('taxonomyDraftForPartId', '=', draft.id)
			.where('id', 'not in', retainedIds)
			.execute();

		for (const rule of activeRules) {
			await trx
				.insertInto('taxonomyDraftLogicRule')
				.values({
					id: rule.id.startsWith('new-') ? undefined : rule.id,
					taxonomyDraftForPartId: draft.id,
					order: rule.order,
					name: rule.name || `Rule ${rule.order}`,
					nextPartId: rule.nextPartId ?? null,
					nrOfRounds: rule.nrOfRounds ? JSON.stringify(rule.nrOfRounds) : null,
					score: rule.score ? JSON.stringify(rule.score) : null,
					mistakes: rule.mistakes ? JSON.stringify(rule.mistakes) : null,
					duration: rule.duration ? JSON.stringify(rule.duration) : null
				})
				.onConflict((oc) =>
					oc.column('id').doUpdateSet({
						taxonomyDraftForPartId: draft.id,
						order: rule.order,
						name: rule.name || `Rule ${rule.order}`,
						nrOfRounds: rule.nrOfRounds ? JSON.stringify(rule.nrOfRounds) : null,
						score: rule.score ? JSON.stringify(rule.score) : null,
						mistakes: rule.mistakes ? JSON.stringify(rule.mistakes) : null,
						duration: rule.duration ? JSON.stringify(rule.duration) : null
					})
				)
				.executeTakeFirstOrThrow();
		}
	});

	const part = await findOnePartById(partId);
	return json(part.taxonomyDraftForPart);
}) satisfies RequestHandler;
