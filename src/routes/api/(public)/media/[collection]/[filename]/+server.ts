import { ASSETS_DIR } from '$app/env/private';
import { db } from '$lib/db/database';
import { MediaCollection, type Media } from '$lib/db/schemas/0-utils';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { isMediaReferenced } from '$lib/server/utils.server';
import { error } from '@sveltejs/kit';
import fs from 'fs';
import { Uuid25 } from 'uuid25';
import { uuidv7obj } from 'uuidv7';
import type { RequestHandler } from './$types';


/**
 * @openapi
 * summary: Get media file
 * tags:
 *  - Media
 */
export const GET = (async ({ locals, params }) => {

  const cid = locals.client.id;
  const { collection: collectionRaw, filename } = params;
  let collection: MediaCollection | null = null;
  if (Object.values(MediaCollection).includes(collectionRaw as MediaCollection)) collection = collectionRaw as MediaCollection;
  if (!collection || !filename) error(404, `File not found`);

  let path = `${ASSETS_DIR}/clients/${cid}/${collection}/${filename}`;
  if (collection === MediaCollection.internals) path = `${ASSETS_DIR}/${collection}/${filename}`;

  let file: Buffer<ArrayBuffer> | null = null;
  try {
    file = fs.readFileSync(path);
  } catch {
    error(404, `File not found`);
  }
  if (!file) error(404, `File not found`);

  const headers: HeadersInit = {
    'Content-Disposition': `inline; filename=${filename}`,
  }

  const types: Record<string, string> = {
    jpeg: 'image/jpeg',
    jpg: 'image/jpg',
    png: 'image/png',
    svg: 'image/svg+xml',
    gif: 'image/gif',
    webp: 'image/webp',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
  }
  const extension = filename.split('.')?.at(-1);
  if (extension && types[extension]) {
    headers['Content-Type'] = types[extension];
  }

  return new Response(file, { status: 200, headers });
}) satisfies RequestHandler;

/**
 * @openapi
 * summary: Create a media file
 * tags:
 *  - Media
 */
export const POST = (async ({ locals, params, request, fetch }) => {
  const clientId = locals.client.id;
  const userId = locals.authusr?.id;
  if (!userId) error(401, 'Unauthorized');

  const { collection: collectionRaw, filename } = params;
  const [name, ...extensionParts] = filename?.split('.') || [undefined];
  const extension = extensionParts.at(-1);
  if (!name || !extension) error(422, `New file name and extension could not be parsed`);

  const hash = Uuid25.fromBytes(uuidv7obj().bytes).toHex();
  const hashedFilename = `${hash}.${extension}`;

  let collection: MediaCollection | null = null;
  if (Object.values(MediaCollection).includes(collectionRaw as MediaCollection)) collection = collectionRaw as MediaCollection;
  if (!collection || !filename) error(422, `File not found`);
  if (collection === MediaCollection.externals) error(403, `Cannot upload external files`);

  // Obtain the new file
  let file: File;
  let description: string | undefined = undefined;
  if (request.headers.get('content-type')?.startsWith('application/json')) {
    // URL upload
    const { url } = await request.json();
    file = await fetch(url).then(async res => new File([await res.blob()], params.filename));
  } else {
    // File upload
    const values = await request.formData();
    file = values.get('file') as File;
    description = values.get('description') as string;
  }
  if (!file?.size) error(422, 'Not a valid file.');

  await db.transaction().execute(async (trx) => {
    let dir = `${ASSETS_DIR}/clients/${clientId}/${collection}`;
    if (collection === MediaCollection.internals) dir = `${ASSETS_DIR}/${collection}`;

    // Persist the file in database
    const data = {
      name: hashedFilename,
      extension,
      description,
      size: file.size,
      createdBy: userId,
      updatedBy: userId,
    }
    switch (collection) {
      case MediaCollection.clients: {
        await trx
          .insertInto('clientMedia')
          .values({
            clientId, ...data
          })
          .onConflict((oc) =>
            oc.columns(['clientId', 'name']).doUpdateSet({
              extension,
              updatedAt: new Date(),
              updatedBy: userId,
            })
          )
          .execute();
        break;
      }
      case MediaCollection.users: {
        await trx
          .insertInto('userMedia')
          .values({
            userId, ...data
          })
          .onConflict((oc) =>
            oc.columns(['userId', 'name']).doUpdateSet({
              extension,
              updatedAt: new Date(),
              updatedBy: userId,
            })
          )
          .execute();
        break;
      }
    }

    // Upload the file
    const path = `${dir}/${hashedFilename}`
    try {
      if (!fs.existsSync(dir)) await fs.promises.mkdir(dir, { recursive: true });

      const buffer = Buffer.from(await file.arrayBuffer());

      // Minify images...
      // if (['jpg', 'jpeg', 'png'].includes(extension)) {
      //   await sharp(buffer)
      //     .resize({ fit: sharp.fit.inside, width: 768, height: 768, withoutEnlargement: true })
      //     .webp({ quality: 80 })
      //     .toFile(path);
      // }
      // else {
      //   await fs.promises.writeFile(path, buffer);
      // }
      await fs.promises.writeFile(path, buffer);

    } catch (e) {
      console.error(e);
      error(400, 'Uploading the new file failed.');
    }
  });

  return new Response(JSON.stringify({ collection, filename: hashedFilename } as Media), {
    status: 201, headers: {
      'Content-Type': 'application/json'
    }
  });
}) satisfies RequestHandler;

/**
 * @openapi
 * summary: Delete media file
 * tags:
 *  - Media
 */
export const DELETE = (async ({ params, locals }) => {
  const clientId = locals.client.id;
  const authUser = locals.authusr;
  const userId = authUser?.id;
  if (!userId) error(401, 'Unauthorized');

  const { collection: collectionRaw, filename } = params;
  const [name, ...extensionParts] = filename?.split('.') || [undefined];
  const extension = extensionParts.at(-1);
  if (!name || !extension) error(422, `New file name and extension could not be parsed`);

  let collection: MediaCollection | null = null;
  if (Object.values(MediaCollection).includes(collectionRaw as MediaCollection)) collection = collectionRaw as MediaCollection;
  if (!collection || !filename) error(422, `File not found`);
  if (collection === MediaCollection.externals) error(422, `Cannot delete external files`);
  if (collection === MediaCollection.internals) error(422, `Cannot delete internal files`);

  const isAdmin = authUser?.roles.includes(UserRole.admin) ?? false;
  const isEditor = authUser?.roles.includes(UserRole.editor) ?? false;
  let canDelete = false;
  switch (collection) {
    case MediaCollection.clients: {
      canDelete = isAdmin || isEditor;
      break;
    }
    case MediaCollection.users: {
      canDelete = isAdmin ||
        Boolean(await db
          .selectFrom('userMedia')
          .select('id')
          .where('userId', '=', userId)
          .where('name', '=', filename)
          .executeTakeFirst());
      break;
    }
  }
  if (!canDelete) error(403, 'You are not allowed to delete this file');

  await db.transaction().execute(async (trx) => {
    if (await isMediaReferenced(trx, clientId, { collection, filename })) {
      error(409, 'Media is still referenced');
    }

    // Remove the database entry
    switch (collection) {
      case MediaCollection.clients: {
        await trx
          .deleteFrom('clientMedia')
          .where('name', '=', filename)
          .where('clientId', '=', clientId)
          .execute();
        break;
      }
      case MediaCollection.users: {
        let query = trx
          .deleteFrom('userMedia')
          .where('name', '=', filename)
          .where((eb) => eb.exists(
            eb.selectFrom('user')
              .select('user.id')
              .whereRef('user.id', '=', 'userMedia.userId')
              .where('user.clientId', '=', clientId)
          ));
        if (!isAdmin) query = query.where('userId', '=', userId);
        await query.execute();
        break;
      }
    }

    // Remove the file
    const path = `${ASSETS_DIR}/clients/${clientId}/${collection}/${filename}`;
    try {
      await fs.promises.rm(path, { force: true });
    } catch (e) {
      console.error(e);
      error(400, 'Deleting file failed.');
    }
  });

  return new Response(JSON.stringify({}), {
    status: 201, headers: {
      'Content-Type': 'application/json'
    }
  });
}) satisfies RequestHandler;
