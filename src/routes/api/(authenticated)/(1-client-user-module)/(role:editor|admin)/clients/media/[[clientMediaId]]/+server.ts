import { ASSETS_DIR } from '$app/env/private';
import { db } from '$lib/db/database';
import type { Schema } from '$lib/db/schema.js';
import { MediaCollection } from '$lib/db/schemas/0-utils.js';
import { isMediaReferenced, requireParam } from '$lib/server/utils.server.js';
import { error, json } from '@sveltejs/kit';
import { sql, type Transaction } from 'kysely';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import fs from 'node:fs';
import path from 'node:path';
import { Uuid25 } from 'uuid25';
import { uuidv7obj } from 'uuidv7';
import type { RequestHandler } from './$types';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const IMAGE_TYPES = {
	gif: ['image/gif'],
	jpeg: ['image/jpeg'],
	jpg: ['image/jpeg', 'image/jpg'],
	png: ['image/png'],
	svg: ['image/svg+xml'],
	webp: ['image/webp']
} as const;

const selectMedia = (clientId: string, clientMediaId?: string) =>
	db
		.selectFrom('clientMedia')
		.where('clientMedia.clientId', '=', clientId)
		.where('clientMedia.extension', 'in', Object.keys(IMAGE_TYPES))
		.$if(Boolean(clientMediaId), (query) => query.where('clientMedia.id', '=', clientMediaId!))
		.select((eb) => [
			'clientMedia.id',
			'clientMedia.name',
			'clientMedia.extension',
			'clientMedia.description',
			'clientMedia.size',
			'clientMedia.createdAt',
			'clientMedia.updatedAt',
			jsonObjectFrom(
				eb
					.selectFrom('user')
					.whereRef('user.id', '=', 'clientMedia.updatedBy')
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
		]);

async function getMediaFile(request: Request) {
	const values = await request.formData();
	const file = values.get('file');
	if (!(file instanceof File) || !file.size) error(422, 'Select a valid image file');
	if (file.size > MAX_IMAGE_SIZE) error(413, 'Images cannot exceed 10 MB');

	const extension = path.extname(file.name).slice(1).toLowerCase();
	const allowedTypes = IMAGE_TYPES[extension as keyof typeof IMAGE_TYPES];
	if (!allowedTypes || !(allowedTypes as readonly string[]).includes(file.type)) {
		error(422, 'The image type is not supported');
	}
	return { file, extension, buffer: Buffer.from(await file.arrayBuffer()) };
}

function getDirectory(clientId: string) {
	return path.join(ASSETS_DIR, 'clients', clientId, MediaCollection.clients);
}

async function clearMediaReferences(trx: Transaction<Schema>, clientId: string, filename: string) {
	const media = { collection: MediaCollection.clients, filename };
	const object = JSON.stringify(media);
	const array = JSON.stringify([media]);
	const matches = (column: string) =>
		sql<boolean>`(${sql.ref(column)} @> ${object}::jsonb or ${sql.ref(column)} @> ${array}::jsonb)`;

	for (const column of ['logo', 'favicon', 'splash', 'hero'] as const) {
		await trx
			.updateTable('client')
			.set({ [column]: null })
			.where('id', '=', clientId)
			.where(matches(`client.${column}`))
			.execute();
	}
	await trx
		.updateTable('user')
		.set({ picture: null })
		.where('clientId', '=', clientId)
		.where(matches('user.picture'))
		.execute();
	await trx
		.updateTable('provider')
		.set({ image: null })
		.where('clientId', '=', clientId)
		.where(matches('provider.image'))
		.execute();
	await trx
		.updateTable('activityTemplate')
		.set({ image: null })
		.where('clientId', '=', clientId)
		.where(matches('activityTemplate.image'))
		.execute();
	await trx
		.updateTable('group')
		.set({ image: null })
		.where('clientId', '=', clientId)
		.where(matches('group.image'))
		.execute();
	await trx
		.updateTable('mission')
		.set({ image: null })
		.where('clientId', '=', clientId)
		.where(matches('mission.image'))
		.execute();
	await trx
		.updateTable('milestone')
		.set({ image: null })
		.where(
			'missionId',
			'in',
			trx.selectFrom('mission').select('id').where('clientId', '=', clientId)
		)
		.where(matches('milestone.image'))
		.execute();
	for (const column of ['thumbnail', 'hero'] as const) {
		await trx
			.updateTable('task')
			.set({ [column]: null })
			.where(
				'milestoneId',
				'in',
				trx
					.selectFrom('milestone')
					.innerJoin('mission', 'mission.id', 'milestone.missionId')
					.select('milestone.id')
					.where('mission.clientId', '=', clientId)
			)
			.where(matches(`task.${column}`))
			.execute();
	}
	await trx
		.updateTable('skill')
		.set({ image: null })
		.where('clientId', '=', clientId)
		.where(matches('skill.image'))
		.execute();
}

export const GET: RequestHandler = async ({ locals, params }) => {
	const clientId = locals.client.id;
	const rows = await selectMedia(clientId, params.clientMediaId)
		.orderBy('updatedAt', 'desc')
		.execute();
	if (params.clientMediaId && !rows.length) error(404, 'The image does not exist');
	return json(params.clientMediaId ? rows[0] : rows);
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const clientId = locals.client.id;
	const userId = locals.authusr!.id;
	const { file, extension, buffer } = await getMediaFile(request);
	const name = `${Uuid25.fromBytes(uuidv7obj().bytes).toHex()}.${extension}`;
	const directory = getDirectory(clientId);
	const filename = path.join(directory, name);

	await fs.promises.mkdir(directory, { recursive: true });
	await fs.promises.writeFile(filename, buffer);
	try {
		const inserted = await db
			.insertInto('clientMedia')
			.values({
				clientId,
				name,
				extension,
				description: file.name,
				size: file.size,
				createdBy: userId,
				updatedBy: userId
			})
			.returning('id')
			.executeTakeFirstOrThrow();
		return json(await selectMedia(clientId, inserted.id).executeTakeFirstOrThrow(), {
			status: 201
		});
	} catch (cause) {
		await fs.promises.rm(filename, { force: true });
		throw cause;
	}
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const clientId = locals.client.id;
	const userId = locals.authusr!.id;
	const clientMediaId = requireParam(params.clientMediaId, 'The image parameter is required');
	const body = (await request.json()) as { description?: unknown };
	if (body.description !== null && typeof body.description !== 'string') {
		error(422, 'Description must be a string or null');
	}
	const description = typeof body.description === 'string' ? body.description.trim() || null : null;
	const updated = await db
		.updateTable('clientMedia')
		.where('id', '=', clientMediaId)
		.where('clientId', '=', clientId)
		.set({ description, updatedAt: new Date(), updatedBy: userId })
		.returning('id')
		.executeTakeFirst();
	if (!updated) error(404, 'The image does not exist');
	return json(await selectMedia(clientId, updated.id).executeTakeFirstOrThrow());
};

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const clientId = locals.client.id;
	const userId = locals.authusr!.id;
	const clientMediaId = requireParam(params.clientMediaId, 'The image parameter is required');
	const current = await selectMedia(clientId, clientMediaId).executeTakeFirst();
	if (!current) error(404, 'The image does not exist');
	const { file, extension, buffer } = await getMediaFile(request);
	if (extension !== current.extension) {
		error(422, `Replacement images must use the .${current.extension} extension`);
	}

	const filename = path.join(getDirectory(clientId), current.name);
	const temporaryFilename = `${filename}.${crypto.randomUUID()}.tmp`;
	await fs.promises.writeFile(temporaryFilename, buffer);
	try {
		await fs.promises.rename(temporaryFilename, filename);
		await db
			.updateTable('clientMedia')
			.where('id', '=', clientMediaId)
			.where('clientId', '=', clientId)
			.set({ size: file.size, updatedAt: new Date(), updatedBy: userId })
			.executeTakeFirstOrThrow();
	} finally {
		await fs.promises.rm(temporaryFilename, { force: true });
	}
	return json(await selectMedia(clientId, clientMediaId).executeTakeFirstOrThrow());
};

export const DELETE: RequestHandler = async ({ locals, params, url }) => {
	const clientId = locals.client.id;
	const clientMediaId = requireParam(params.clientMediaId, 'The image parameter is required');
	const doForce = url.searchParams.get('force') === 'true';
	const current = await db.transaction().execute(async (trx) => {
		const current = await trx
			.selectFrom('clientMedia')
			.where('id', '=', clientMediaId)
			.where('clientId', '=', clientId)
			.where('extension', 'in', Object.keys(IMAGE_TYPES))
			.select('name')
			.forUpdate()
			.executeTakeFirst();
		if (!current) error(404, 'The image does not exist');

		const media = { collection: MediaCollection.clients, filename: current.name };
		if (await isMediaReferenced(trx, clientId, media)) {
			if (!doForce) error(409, 'The image is still referenced');
			await clearMediaReferences(trx, clientId, current.name);
		}

		await trx
			.deleteFrom('clientMedia')
			.where('id', '=', clientMediaId)
			.where('clientId', '=', clientId)
			.executeTakeFirstOrThrow();
		return current;
	});
	await fs.promises.rm(path.join(getDirectory(clientId), current.name), { force: true });
	return new Response(undefined, { status: 204 });
};
