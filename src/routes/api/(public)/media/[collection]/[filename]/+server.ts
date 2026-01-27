import { env as private_env } from '$env/dynamic/private';
import { db } from '$lib/db/database';
import { MediaCollection, type Media } from '$lib/db/schemas/0-utils';
import { error } from '@sveltejs/kit';
import fs from 'fs';
import type { RequestHandler } from './$types';


export const GET = (async ({ locals, params }) => {

  const cid = locals.client.id;
  const { collection: collectionRaw, filename } = params;
  let collection: MediaCollection | null = null;
  if (Object.values(MediaCollection).includes(collectionRaw as MediaCollection)) collection = collectionRaw as MediaCollection;
  if (!collection || !filename) error(404, `File not found`);

  let path = `${private_env.SECRET_ASSETS_DIR}/clients/${cid}/${collection}/${filename}`;
  if (collection === MediaCollection.internals) path = `${private_env.SECRET_ASSETS_DIR}/${collection}/${filename}`;

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

export const POST = (async ({ params, request, locals, fetch }) => {
  const clientId = locals.client.id;
  const userId = locals.authusr?.id;
  if (!userId) error(401, 'Unauthorized');

  const { collection: collectionRaw, filename } = params;
  const [name, extension] = filename?.split('.') || [undefined, undefined];
  if (!name || !extension) error(422, `New file name and extension could not be parsed.`);

  let collection: MediaCollection | null = null;
  if (Object.values(MediaCollection).includes(collectionRaw as MediaCollection)) collection = collectionRaw as MediaCollection;
  if (!collection || !filename) error(422, `File not found.`);
  if (collection === MediaCollection.externals) error(403, `Cannot upload external files.`);

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
    let dir = `${private_env.SECRET_ASSETS_DIR}/clients/${clientId}/${collection}`;
    if (collection === MediaCollection.internals) dir = `${private_env.SECRET_ASSETS_DIR}/${collection}`;

    // Persist the file in database
    const data = {
      name: filename,
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
    const path = `${dir}/${filename}`
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

  return new Response(JSON.stringify({ collection, filename } as Media), {
    status: 201, headers: {
      'Content-Type': 'application/json'
    }
  });
}) satisfies RequestHandler;

// export const DELETE = (async ({ url, params, locals }) => {
//   const clientId = locals.client.id;
//   const userId = locals.authusr?.id;
//   if (!userId) error(401, 'Unauthorized');

//   const { collection: collectionRaw, filename } = params;
//   const [name, extension] = filename?.split('.') || [undefined, undefined];
//   if (!name || !extension) error(422, `New file name and extension could not be parsed.`);

//   let collection: MediaCollection | null = null;
//   if (Object.values(MediaCollection).includes(collectionRaw as MediaCollection)) collection = collectionRaw as MediaCollection;
//   if (!collection || !filename) error(422, `File not found.`);
//   if (collection === MediaCollection.externals) error(422, `Cannot delete external files.`);

//   const x = url.searchParams.get('x');
//   if (collection === MediaCollection.campaigns && !x?.length) error(422, `Campaign reference query parameter (x) required when uploading campaign files.`);

//   // TODO: Check if deleting a file is allowed for the given user.

//   await db.transaction().execute(async (trx) => {
//     // Remove the database entry
//     switch (collection) {
//       case MediaCollection.clients: {
//         await trx
//           .deleteFrom('clientMedia')
//           .where('name', '=', name)
//           .where('clientId', '=', clientId)
//           .execute();
//         break;
//       }
//       case MediaCollection.campaigns: {
//         const { id: campaignId } = await trx.selectFrom('campaign').select('id').where('reference', '=', x).executeTakeFirstOrThrow();

//         await trx
//           .deleteFrom('campaignMedia')
//           .where('name', '=', name)
//           .where('campaignId', '=', campaignId)
//           .execute();
//         break;
//       }
//       case MediaCollection.users: {
//         await trx
//           .deleteFrom('userMedia')
//           .where('name', '=', name)
//           .where('userId', '=', userId)
//           .execute();
//         break;
//       }
//     }

//     // Remove the file
//     let path = `${private_env.SECRET_ASSETS_DIR}/clients/${clientId}/${collection}/${filename}`;
//     if (collection === MediaCollection.internals) path = `${private_env.SECRET_ASSETS_DIR}/${collection}/${filename}`;
//     try {
//       if (fs.existsSync(path)) fs.promises.rm(path, { force: true });
//     } catch (e) {
//       console.error(e);
//       error(400, 'Deleting file failed.');
//     }
//   });

//   return new Response(JSON.stringify({}), {
//     status: 201, headers: {
//       'Content-Type': 'application/json'
//     }
//   });
// }) satisfies RequestHandler;