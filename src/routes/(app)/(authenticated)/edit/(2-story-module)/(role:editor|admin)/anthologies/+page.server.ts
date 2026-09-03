import { db } from '$lib/db/database';
import { selectLocalizedField } from '$lib/db/schemas/0-utils';
import { fail } from '@sveltejs/kit';
import type { NotNull } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import YAML from 'yaml';
import { z } from 'zod/v4';
import type { Actions, PageServerLoad } from './$types';
import { anthologySchema, schemaOfAttachments } from './schemas';

export const load: PageServerLoad = async ({ locals }) => {
	const clientId = locals.client.id;
	const userId = locals.authusr!.id;
	const language = locals.authusr!.language;

	const anthologies = await db
		.selectFrom('anthology')
		.leftJoin('anthologyPermission', 'anthologyPermission.anthologyId', 'anthology.id')
		.where('anthology.clientId', '=', clientId)
		.where('anthologyPermission.userId', '=', userId)
		.select((eb) => [
			'anthology.id',
			'anthology.slug',
			selectLocalizedField(eb, 'anthology.name', language).as('name'),
			'anthology.name as nameRaw',
			'anthology.isPublic',
			'anthology.isPublished',
			jsonArrayFrom(
				eb
					.selectFrom('anthologyPosition')
					.whereRef('anthologyPosition.anthologyId', '=', 'anthology.id')
					.leftJoin('story', 'story.id', 'anthologyPosition.storyId')
					.select(['anthologyPosition.id', 'anthologyPosition.order', 'story.id as storyId'])
					.orderBy('anthologyPosition.order', 'asc')
					.$narrowType<{ id: NotNull; order: NotNull; storyId: NotNull }>()
			).as('positions')
		])
		.execute();

	const stories = await db
		.selectFrom('story')
		.leftJoin('storyPermission', 'storyPermission.storyId', 'story.id')
		.where('story.clientId', '=', clientId)
		.where('storyPermission.userId', '=', userId)
		.select((eb) => [
			'story.id',
			selectLocalizedField(eb, 'story.name', language).as('name'),

			'story.isPublic',
			'story.isPublished'
		])
		.execute();

	return { anthologies, stories };
};

const parseJsonField = (value: FormDataEntryValue | null) => {
	if (typeof value !== 'string' || !value.length) return undefined;
	return JSON.parse(value);
};

export const actions: Actions = {
	upload: async ({ request, fetch }) => {
		const formData = await request.formData();
		const result = schemaOfAttachments.safeParse({
			attachments: formData
				.getAll('attachments')
				.filter((value): value is File => value instanceof File)
		});

		if (!result.success) {
			return fail(400, {
				form: 'upload' as const,
				errors: z.flattenError(result.error).fieldErrors,
				message: 'Upload failed.'
			});
		}

		const { attachments } = result.data;

		for (const attachment of attachments) {
			let yaml;
			try {
				yaml = YAML.parse(await attachment.text());
			} catch {
				return fail(400, {
					form: 'upload' as const,
					errors: { attachments: ['Invalid YAML'] },
					message: 'Upload failed.'
				});
			}
			const res = await fetch(`/api/anthologies/io`, {
				method: 'POST',
				body: JSON.stringify(yaml),
				headers: { 'content-type': 'application/json' }
			});
			if (!res.ok) {
				const response = await res.json().catch(() => ({}));
				console.error(response);
				return fail(400, {
					form: 'upload' as const,
					errors: {
						attachments: [
							response.message ??
								response.issues?.[0]?.message ??
								response.storySlugs?.join(', ') ??
								'Upload failed.'
						]
					},
					message: response.message ?? 'Upload failed.'
				});
			}
		}

		return { form: 'upload' as const, message: 'Form posted successfully!' };
	},
	upsert: async ({ request, locals }) => {
		const clientId = locals.client.id;
		const userId = locals.authusr!.id;

		const formData = await request.formData();
		const values = {
			id: String(formData.get('id') ?? '') || null,
			slug: String(formData.get('slug') ?? ''),
			nameRaw: parseJsonField(formData.get('nameRaw')),
			isPublished: formData.get('isPublished') === 'true',
			isPublic: formData.get('isPublic') === 'true',
			positions: parseJsonField(formData.get('positions')) ?? []
		};
		const result = anthologySchema.safeParse(values);
		if (!result.success) {
			return fail(400, {
				form: 'upsert' as const,
				values,
				errors: z.flattenError(result.error).fieldErrors,
				message: 'Form submission failed.'
			});
		}

		const { id: anthologyId, slug, nameRaw, positions, ...rest } = result.data;

		const isNotUnique = await db
			.selectFrom('anthology')
			.where('clientId', '=', clientId)
			.$if(anthologyId != null, (qb) => qb.where('id', '!=', anthologyId!))
			.where('slug', '=', slug)
			.select('id')
			.executeTakeFirst();
		if (isNotUnique) {
			return fail(400, {
				form: 'upsert' as const,
				values: result.data,
				errors: { slug: ['Slug already exists'] },
				message: 'Form submission failed.'
			});
		}

		await db.transaction().execute(async (trx) => {
			const anthology = await trx
				.insertInto('anthology')
				.values({
					id: anthologyId ?? undefined,
					clientId,
					slug,
					name: JSON.stringify(nameRaw),
					createdBy: userId,
					updatedBy: userId,
					...rest
				})
				.onConflict((oc) =>
					oc.columns(['id']).doUpdateSet({
						slug,
						name: JSON.stringify(nameRaw),
						updatedBy: userId,
						updatedAt: new Date(),
						...rest
					})
				)
				.returning('id')
				.executeTakeFirstOrThrow();

			if (!anthologyId) {
				await trx
					.insertInto('anthologyPermission')
					.values({
						userId,
						anthologyId: anthology.id
					})
					.executeTakeFirstOrThrow();
			}

			// Delete removed anthology positions
			await trx
				.deleteFrom('anthologyPosition')
				.where('anthologyId', '=', anthology.id)
				.where(
					'id',
					'in',
					positions
						?.filter((p) => p.isRemoved)
						.map((p) => p.id)
						?.filter<string>((p): p is string => typeof p === 'string' && !p?.startsWith('new')) ??
						null
				)
				.execute();

			// Create / update the remaining anthology positions
			for (const rawposition of positions.filter((p) => !p.isRemoved)) {
				const { id: positionId, configuration, storyId, order } = rawposition;
				await trx
					.insertInto('anthologyPosition')
					.values({
						id: positionId?.startsWith('new') ? undefined : positionId,
						anthologyId: anthology.id,
						configuration: configuration ? JSON.stringify(configuration) : null,
						storyId,
						order
					})
					.onConflict((oc) =>
						oc.columns(['id']).doUpdateSet({
							anthologyId: anthology.id,
							configuration: configuration ? JSON.stringify(configuration) : null,
							storyId,
							order
						})
					)
					.returning('id')
					.executeTakeFirstOrThrow();
			}
		});

		return { form: 'upsert' as const, values: result.data, message: 'Form posted successfully!' };
	},
	delete: async ({ request }) => {
		const data = await request.formData();
		const anthologyId = data.get('anthologyId') as string;

		await db.deleteFrom('anthology').where('id', '=', anthologyId).execute();
	}
};
