import { db } from '$lib/db/database';
import { findOneStoryById } from '$lib/db/repositories/2-stories-module';
import type { Translatable } from '$lib/db/schemas/0-utils';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { hasPermission } from '$lib/server/utils.server';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from '../$types';

export const load: PageServerLoad = (async ({ locals, params }) => {
  const clientId = locals.client.id;
  const storyId = params.storyId;

  if (storyId === 'new') {
    const newStoryId = await db.transaction().execute(async (trx) => {
      const userId = locals.authusr!.id;

      const { id: newStoryId } = await trx
        .insertInto('story')
        .values({
          clientId,
          reference: crypto.randomUUID().toString().slice(0, 8),
          name: JSON.stringify({ en: 'New story' } as Translatable),
          isPublic: true,
          isPublished: true,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await trx
        .insertInto('storyPermission')
        .values({
          storyId: newStoryId,
          userId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await trx
        .insertInto('part')
        .values({
          storyId: newStoryId,
          position: JSON.stringify({ x: 0, y: 0 }),
          isInitial: true,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return newStoryId;
    });

    redirect(302, `/edit/stories/${newStoryId}/flow`);
  } else {

    const canModify = await hasPermission(locals, {
      elevatedRoles: [UserRole.admin],
      permissionQuery: ({ locals, db }) => {
        const userId = locals.authusr!.id;

        return db
          .selectFrom('storyPermission')
          .where('storyPermission.storyId', '=', storyId)
          .where('storyPermission.userId', '=', userId)
          .select('storyPermission.id');
      }
    });
    if (!canModify) error(403, 'You are not allowed to view this story');

    const story = await findOneStoryById(clientId, storyId);
    return { story };
  }

});
