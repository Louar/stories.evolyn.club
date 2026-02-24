import { db } from '$lib/db/database';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { StoryPermissionRole } from '$lib/db/schemas/2-story-module';
import { canModifyStory, isUniqueViolation, parseBody, requireParam } from '$lib/server/utils.server';
import { error, json } from '@sveltejs/kit';
import z from 'zod/v4';
import type { AssetRow } from '../../../../../../(app)/(authenticated)/edit/(role:editor|admin)/stories/[storyId]/assets/proxy+page.server';
import type { RequestHandler } from './$types';

const assetTypeSchema = z.enum(['video', 'announcement', 'quiz']);
type AssetType = z.infer<typeof assetTypeSchema>;

const bodySchema = z.object({
  type: assetTypeSchema,
  asset: z.uuid(),
});

const querySchema = z.object({
  type: assetTypeSchema.optional(),
});

const isAdmin = (locals: App.Locals) => locals.authusr?.roles?.includes(UserRole.admin) ?? false;

const listPermittedStoryIds = async (locals: App.Locals): Promise<string[] | null> => {
  if (isAdmin(locals)) return null;
  const userId = locals.authusr?.id;
  if (!userId) return [];
  const rows = await db
    .selectFrom('storyPermission')
    .where('storyPermission.userId', '=', userId)
    .where((eb) =>
      eb.or([
        eb('storyPermission.role', '=', StoryPermissionRole.owner),
        eb('storyPermission.role', '=', StoryPermissionRole.editor),
      ])
    )
    .select('storyPermission.storyId')
    .execute();
  return rows.map((row) => row.storyId);
};

const ensureTargetStory = async (clientId: string, storyId: string) => {
  const story = await db
    .selectFrom('story')
    .where('story.clientId', '=', clientId)
    .where('story.id', '=', storyId)
    .select(['story.id'])
    .executeTakeFirst();
  if (!story) throw error(404, 'Story not found');
  return story;
};

const assertNever = (x: never): never => {
  throw new Error(`Unexpected case: ${String(x)}`);
};

const typesToFetch = (type?: AssetType): AssetType[] => (type ? [type] : ['video', 'announcement', 'quiz']);

//
// Typed list helpers
//

const listVideosAllStories = async (args: {
  clientId: string;
  permittedStoryIds: string[] | null;
}): Promise<Extract<AssetRow, { type: 'video' }>[]> => {
  let qb = db
    .selectFrom('videoAvailableToStory as link')
    .distinctOn('link.videoId')
    .innerJoin('video', 'video.id', 'link.videoId')
    .innerJoin('story', 'story.id', 'link.storyId')
    .where('story.clientId', '=', args.clientId)
    .orderBy('link.videoId')
    .select(['link.id as id', 'video.id as asset', 'video.name', 'video.duration']);

  if (args.permittedStoryIds !== null) {
    qb = qb.where('story.id', 'in', args.permittedStoryIds);
  }

  const rows = await qb.execute();
  return rows.map((row) => ({ type: 'video', ...row }));
};

const listAnnouncementsAllStories = async (args: {
  clientId: string;
  permittedStoryIds: string[] | null;
}): Promise<Extract<AssetRow, { type: 'announcement' }>[]> => {
  let qb = db
    .selectFrom('announcementTemplateAvailableToStory as link')
    .distinctOn('link.announcementTemplateId')
    .innerJoin('announcementTemplate', 'announcementTemplate.id', 'link.announcementTemplateId')
    .innerJoin('story', 'story.id', 'link.storyId')
    .where('story.clientId', '=', args.clientId)
    .orderBy('link.announcementTemplateId')
    .select(['link.id as id', 'announcementTemplate.id as asset', 'announcementTemplate.name']);

  if (args.permittedStoryIds !== null) {
    qb = qb.where('story.id', 'in', args.permittedStoryIds);
  }

  const rows = await qb.execute();
  return rows.map((row) => ({ type: 'announcement', ...row }));
};

const listQuizzesAllStories = async (args: {
  clientId: string;
  permittedStoryIds: string[] | null;
}): Promise<Extract<AssetRow, { type: 'quiz' }>[]> => {
  let qb = db
    .selectFrom('quizTemplateAvailableToStory as link')
    .distinctOn('link.quizTemplateId')
    .innerJoin('quizTemplate', 'quizTemplate.id', 'link.quizTemplateId')
    .innerJoin('story', 'story.id', 'link.storyId')
    .where('story.clientId', '=', args.clientId)
    .orderBy('link.quizTemplateId')
    .select((eb) => [
      'link.id as id',
      'quizTemplate.id as asset',
      'quizTemplate.name',
      eb
        .selectFrom('quizQuestionTemplate')
        .whereRef('quizQuestionTemplate.quizTemplateId', '=', 'quizTemplate.id')
        .select(eb.fn.countAll<number>().as('questions'))
        .as('questions'),
    ]);

  if (args.permittedStoryIds !== null) {
    qb = qb.where('story.id', 'in', args.permittedStoryIds);
  }

  const rows = await qb.execute();
  return rows.map((row) => ({ type: 'quiz', ...row }));
};

const listVideosForStory = async (storyId: string): Promise<Extract<AssetRow, { type: 'video' }>[]> => {
  const rows = await db
    .selectFrom('videoAvailableToStory as link')
    .innerJoin('video', 'video.id', 'link.videoId')
    .where('link.storyId', '=', storyId)
    .select(['link.id as id', 'video.id as asset', 'video.name', 'video.duration'])
    .execute();

  return rows.map((row) => ({ type: 'video', ...row }));
};

const listAnnouncementsForStory = async (
  storyId: string
): Promise<Extract<AssetRow, { type: 'announcement' }>[]> => {
  const rows = await db
    .selectFrom('announcementTemplateAvailableToStory as link')
    .innerJoin('announcementTemplate', 'announcementTemplate.id', 'link.announcementTemplateId')
    .where('link.storyId', '=', storyId)
    .select(['link.id as id', 'announcementTemplate.id as asset', 'announcementTemplate.name'])
    .execute();

  return rows.map((row) => ({ type: 'announcement', ...row }));
};

const listQuizzesForStory = async (storyId: string): Promise<Extract<AssetRow, { type: 'quiz' }>[]> => {
  const rows = await db
    .selectFrom('quizTemplateAvailableToStory as link')
    .innerJoin('quizTemplate', 'quizTemplate.id', 'link.quizTemplateId')
    .where('link.storyId', '=', storyId)
    .select((eb) => [
      'link.id as id',
      'quizTemplate.id as asset',
      'quizTemplate.name',
      eb
        .selectFrom('quizQuestionTemplate')
        .whereRef('quizQuestionTemplate.quizTemplateId', '=', 'quizTemplate.id')
        .select(eb.fn.countAll<number>().as('questions'))
        .as('questions'),
    ])
    .execute();

  return rows.map((row) => ({ type: 'quiz', ...row }));
};

//
// Typed access checks for POST
//

const ensureAssetExists = async (type: AssetType, assetId: string) => {
  switch (type) {
    case 'video': {
      const asset = await db.selectFrom('video').where('video.id', '=', assetId).select('video.id').executeTakeFirst();
      if (!asset) throw error(404, 'Video not found');
      return;
    }
    case 'announcement': {
      const asset = await db
        .selectFrom('announcementTemplate')
        .where('announcementTemplate.id', '=', assetId)
        .select('announcementTemplate.id')
        .executeTakeFirst();
      if (!asset) throw error(404, 'Announcement template not found');
      return;
    }
    case 'quiz': {
      const asset = await db
        .selectFrom('quizTemplate')
        .where('quizTemplate.id', '=', assetId)
        .select('quizTemplate.id')
        .executeTakeFirst();
      if (!asset) throw error(404, 'Quiz template not found');
      return;
    }
    default:
      assertNever(type);
  }
};

const ensureSourceAccess = async (args: {
  clientId: string;
  type: AssetType;
  assetId: string;
  permittedStoryIds: string[] | null;
}) => {
  // Admin/unrestricted
  if (args.permittedStoryIds === null) return;

  // Non-admin but no permitted stories at all
  if (args.permittedStoryIds.length === 0) throw error(403, 'You are not allowed to use this asset');

  switch (args.type) {
    case 'video': {
      const exists = await db
        .selectFrom('videoAvailableToStory as sourceLink')
        .innerJoin('story as sourceStory', 'sourceStory.id', 'sourceLink.storyId')
        .where('sourceStory.clientId', '=', args.clientId)
        .where('sourceLink.videoId', '=', args.assetId)
        .where('sourceStory.id', 'in', args.permittedStoryIds)
        .select('sourceLink.id')
        .executeTakeFirst();
      if (!exists) throw error(403, 'You are not allowed to use this asset');
      return;
    }
    case 'announcement': {
      const exists = await db
        .selectFrom('announcementTemplateAvailableToStory as sourceLink')
        .innerJoin('story as sourceStory', 'sourceStory.id', 'sourceLink.storyId')
        .where('sourceStory.clientId', '=', args.clientId)
        .where('sourceLink.announcementTemplateId', '=', args.assetId)
        .where('sourceStory.id', 'in', args.permittedStoryIds)
        .select('sourceLink.id')
        .executeTakeFirst();
      if (!exists) throw error(403, 'You are not allowed to use this asset');
      return;
    }
    case 'quiz': {
      const exists = await db
        .selectFrom('quizTemplateAvailableToStory as sourceLink')
        .innerJoin('story as sourceStory', 'sourceStory.id', 'sourceLink.storyId')
        .where('sourceStory.clientId', '=', args.clientId)
        .where('sourceLink.quizTemplateId', '=', args.assetId)
        .where('sourceStory.id', 'in', args.permittedStoryIds)
        .select('sourceLink.id')
        .executeTakeFirst();
      if (!exists) throw error(403, 'You are not allowed to use this asset');
      return;
    }
    default:
      assertNever(args.type);
  }
};

// ********* //
// ENDPOINTS //
// ********* //

export const GET: RequestHandler = async ({ locals, params, url }) => {
  if (!locals.authusr?.id) throw error(401, 'Unauthorized');

  const clientId = locals.client.id;
  const storyId = requireParam(params.storyId, 'The story parameter is required');

  const parsedQuery = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsedQuery.success) return json({ errors: z.flattenError(parsedQuery.error).fieldErrors }, { status: 422 });

  const { type } = parsedQuery.data;
  const wantedTypes = typesToFetch(type);

  if (storyId === '-') {
    const permittedStoryIds = await listPermittedStoryIds(locals);

    if (permittedStoryIds !== null && permittedStoryIds.length === 0) {
      return json([]);
    }

    const tasks = wantedTypes.map((t) => {
      switch (t) {
        case 'video':
          return listVideosAllStories({ clientId, permittedStoryIds });
        case 'announcement':
          return listAnnouncementsAllStories({ clientId, permittedStoryIds });
        case 'quiz':
          return listQuizzesAllStories({ clientId, permittedStoryIds });
        default:
          return assertNever(t);
      }
    });

    const chunks = await Promise.all(tasks);
    return json(chunks.flat());
  }

  await canModifyStory(locals, storyId);
  await ensureTargetStory(clientId, storyId);

  const tasks = wantedTypes.map((t) => {
    switch (t) {
      case 'video':
        return listVideosForStory(storyId);
      case 'announcement':
        return listAnnouncementsForStory(storyId);
      case 'quiz':
        return listQuizzesForStory(storyId);
      default:
        return assertNever(t);
    }
  });

  const chunks = await Promise.all(tasks);
  return json(chunks.flat());
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.authusr?.id) throw error(401, 'Unauthorized');

  const clientId = locals.client.id;
  const storyId = requireParam(params.storyId, 'The story parameter is required');

  await canModifyStory(locals, storyId);
  await ensureTargetStory(clientId, storyId);

  const parsed = await parseBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const { asset: assetId, type } = parsed.data;

  const permittedStoryIds = await listPermittedStoryIds(locals);

  // Independent checks in parallel
  await Promise.all([
    ensureAssetExists(type, assetId),
    ensureSourceAccess({ clientId, type, assetId, permittedStoryIds }),
  ]);

  try {
    switch (type) {
      case 'video': {
        const inserted = await db
          .insertInto('videoAvailableToStory')
          .values({ storyId, videoId: assetId })
          .returning('id')
          .executeTakeFirstOrThrow();
        return json({ status: 'added', id: inserted.id }, { status: 201 });
      }
      case 'announcement': {
        const inserted = await db
          .insertInto('announcementTemplateAvailableToStory')
          .values({ storyId, announcementTemplateId: assetId })
          .returning('id')
          .executeTakeFirstOrThrow();
        return json({ status: 'added', id: inserted.id }, { status: 201 });
      }
      case 'quiz': {
        const inserted = await db
          .insertInto('quizTemplateAvailableToStory')
          .values({ storyId, quizTemplateId: assetId })
          .returning('id')
          .executeTakeFirstOrThrow();
        return json({ status: 'added', id: inserted.id }, { status: 201 });
      }
      default:
        return assertNever(type);
    }
  } catch (e) {
    if (isUniqueViolation(e)) {
      return json({ errors: { asset: ['Availability link already exists'] } }, { status: 422 });
    }
    throw e;
  }
};

export const DELETE: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.authusr?.id) throw error(401, 'Unauthorized');

  const storyId = requireParam(params.storyId, 'The story parameter is required');
  await canModifyStory(locals, storyId);

  const parsed = await parseBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const { asset: assetId, type } = parsed.data;

  switch (type) {
    case 'video': {
      const deleted = await db
        .deleteFrom('videoAvailableToStory')
        .where('storyId', '=', storyId)
        .where('videoId', '=', assetId)
        .returning('id')
        .executeTakeFirst();
      if (!deleted) throw error(404, 'Availability link not found');
      return json({ status: 'removed' });
    }
    case 'announcement': {
      const deleted = await db
        .deleteFrom('announcementTemplateAvailableToStory')
        .where('storyId', '=', storyId)
        .where('announcementTemplateId', '=', assetId)
        .returning('id')
        .executeTakeFirst();
      if (!deleted) throw error(404, 'Availability link not found');
      return json({ status: 'removed' });
    }
    case 'quiz': {
      const deleted = await db
        .deleteFrom('quizTemplateAvailableToStory')
        .where('storyId', '=', storyId)
        .where('quizTemplateId', '=', assetId)
        .returning('id')
        .executeTakeFirst();
      if (!deleted) throw error(404, 'Availability link not found');
      return json({ status: 'removed' });
    }
    default:
      return assertNever(type);
  }
};