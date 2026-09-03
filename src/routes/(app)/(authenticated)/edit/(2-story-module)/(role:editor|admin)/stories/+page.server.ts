import { db } from '$lib/db/database';
import { StoryPermissionRole } from '$lib/db/schemas/2-story-module';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { fail } from '@sveltejs/kit';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import YAML from 'yaml';
import { z } from 'zod/v4';
import type { Actions, PageServerLoad } from './$types';
import { schemaOfAttachments } from './schemas';

export const load: PageServerLoad = async ({ locals, url }) => {
	const clientId = locals.client.id;
	const userId = locals.authusr!.id;
	const showAll = url.searchParams.get('show') === 'all';
	const isAdmin = locals.authusr?.roles?.includes(UserRole.admin) ?? false;

	let query = db.selectFrom('story').distinctOn('story.id').where('story.clientId', '=', clientId);

	if (!isAdmin || !showAll) {
		query = query
			.innerJoin('storyPermission', 'storyPermission.storyId', 'story.id')
			.where('storyPermission.userId', '=', userId)
			.where('storyPermission.role', 'in', [StoryPermissionRole.owner, StoryPermissionRole.editor]);
	}

	const stories = await query
		.select((eb) => [
			'story.id',
			'story.clientId',
			'story.slug',
			'story.name',
			'story.defaultBackgroundColor',
			'story.thumbnail',
			'story.configuration',
			'story.isPublic',
			'story.isPublished',
			'story.createdAt',
			'story.updatedAt',
			eb
				.selectFrom('storyPermission')
				.whereRef('storyPermission.storyId', '=', 'story.id')
				.select(eb.fn.countAll<number>().as('permissions'))
				.as('permissions'),
			jsonObjectFrom(
				eb
					.selectFrom('user')
					.whereRef('user.id', '=', 'story.createdBy')
					.select((eb) => [
						'user.id',
						eb
							.fn<string | null>('nullif', [
								eb.fn<string>('btrim', [
									eb.fn<string>('concat', [
										'user.firstName',
										eb.cast<string>(eb.val(' '), 'text'),
										'user.lastName'
									])
								]),
								eb.val('')
							])
							.as('label'),
						'user.picture as image'
					])
			).as('createdBy'),
			jsonObjectFrom(
				eb
					.selectFrom('user')
					.whereRef('user.id', '=', 'story.updatedBy')
					.select((eb) => [
						'user.id',
						eb
							.fn<string | null>('nullif', [
								eb.fn<string>('btrim', [
									eb.fn<string>('concat', [
										'user.firstName',
										eb.cast<string>(eb.val(' '), 'text'),
										'user.lastName'
									])
								]),
								eb.val('')
							])
							.as('label'),
						'user.picture as image'
					])
			).as('updatedBy')
		])
		.execute();

	return { stories };
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
				// return setError(form, 'attachments', 'Invalid YAML');
			}
			const res = await fetch(`/api/stories/io`, { method: 'POST', body: JSON.stringify(yaml) });
			if (!res.ok) {
				console.error(await res.json());
				return fail(400, {
					form: 'upload' as const,
					errors: {},
					message: 'Upload failed.'
				});
			}
		}

		return { form: 'upload' as const, message: 'Form posted successfully!' };
	}
};
