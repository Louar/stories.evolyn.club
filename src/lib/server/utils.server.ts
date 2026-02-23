import { db } from '$lib/db/database';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { StoryPermissionRole } from '$lib/db/schemas/2-story-module';
import { error, json } from '@sveltejs/kit';
import { z } from 'zod/v4';

export const isUniqueViolation = (e: unknown) => {
  // Postgres: 23505, SQLite: SQLITE_CONSTRAINT_UNIQUE / SQLITE_CONSTRAINT, MySQL: ER_DUP_ENTRY (1062)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyErr = e as any;
  return (
    anyErr?.code === '23505' ||
    anyErr?.code === 'SQLITE_CONSTRAINT' ||
    anyErr?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    anyErr?.errno === 1062
  );
};

export const parseBody = async <T>(request: Request, schema: z.ZodType<T>) => {
  const raw = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      response: json({ errors: z.flattenError(parsed.error)?.fieldErrors }, { status: 422 }),
    };
  }
  return { ok: true as const, data: parsed.data };
};

export const requireParam = (v: string | undefined, message: string) => {
  if (!v?.length) throw error(404, message);
  return v;
};

export const hasPermission = async (
  locals: App.Locals,
  rule: {
    elevatedRoles?: UserRole[],
    permissionQuery?: (args: { locals: App.Locals; db: typeof db }) => { executeTakeFirst: () => Promise<unknown | undefined> }
  }
): Promise<boolean> => {
  const roles = locals.authusr?.roles ?? [];
  const { elevatedRoles, permissionQuery } = rule;

  // role-based fast-path
  if (elevatedRoles?.length && roles.some((r) => elevatedRoles.includes(r))) return true;

  // no query provided => only roles can grant permission
  if (!permissionQuery) return false;

  // query-based permission
  const row = await permissionQuery({ locals, db }).executeTakeFirst();
  return !!row;
};
export const canModifyStory = async (locals: App.Locals, storyId: string) => {
  const canModify = await hasPermission(locals, {
    elevatedRoles: [UserRole.admin],
    permissionQuery: ({ locals, db }) => {
      const userId = locals.authusr!.id;

      return db
        .selectFrom('storyPermission')
        .where('storyPermission.storyId', '=', storyId)
        .where('storyPermission.userId', '=', userId)
        .where((eb) => eb.or([
          eb('storyPermission.role', '=', StoryPermissionRole.owner),
          eb('storyPermission.role', '=', StoryPermissionRole.editor)
        ]))
        .select('storyPermission.id');
    }
  });
  if (!canModify) error(403, 'You are not allowed to edit this story');
};
