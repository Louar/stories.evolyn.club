import { db } from '$lib/db/database';
import type { Schema } from '$lib/db/schema.js';
import { Language, type Media } from '$lib/db/schemas/0-utils.js';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { StoryPermissionRole } from '$lib/db/schemas/2-story-module';
import { error, json } from '@sveltejs/kit';
import type { ExpressionBuilder, Kysely, Transaction } from 'kysely';
import { z } from 'zod/v4';
import * as zodLocales from 'zod/v4/locales';

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

type ZodSafeParseOptions = NonNullable<Parameters<z.ZodType<unknown>['safeParse']>[1]>;
type ZodLocaleError = ZodSafeParseOptions['error'];

export const getZodLocaleError = (
	language: Language | null | undefined
): ZodLocaleError | undefined => {
	const locale = (
		zodLocales as unknown as Record<string, (() => { localeError: ZodLocaleError }) | undefined>
	)[language ?? Language.English];
	return locale?.().localeError;
};

const localizedSafeParse = <T>(
	schema: z.ZodType<T>,
	data: unknown,
	language: Language | null | undefined
) => {
	const localeError = getZodLocaleError(language);
	return localeError ? schema.safeParse(data, { error: localeError }) : schema.safeParse(data);
};

export const parseBody = async <T>(
	input: Request | unknown,
	schema: z.ZodType<T>,
	language?: Language | null
) => {
	const raw = input instanceof Request ? await input.json().catch(() => ({})) : (input ?? {});
	const parsed = localizedSafeParse(schema, raw, language);
	if (!parsed.success) {
		return {
			ok: false as const,
			response: json({ errors: z.flattenError(parsed.error)?.fieldErrors }, { status: 422 })
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
		elevatedRoles?: UserRole[];
		permissionQuery?: (args: { locals: App.Locals; db: typeof db }) => {
			executeTakeFirst: () => Promise<unknown | undefined>;
		};
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
				.where((eb) =>
					eb.or([
						eb('storyPermission.role', '=', StoryPermissionRole.owner),
						eb('storyPermission.role', '=', StoryPermissionRole.editor)
					])
				)
				.select('storyPermission.id');
		}
	});
	if (!canModify) error(403, 'You are not allowed to edit this story');
};

export const MEDIA_REFERENCE_LOCATIONS = [
	'client.logo',
	'client.favicon',
	'client.splash',
	'client.hero',
	'user.picture',
] as const;

type DatabaseExecutor = Kysely<Schema> | Transaction<Schema>;
type MediaReferenceSchema = Record<string, { [column: string]: unknown }>;
type MediaReferenceExpressionBuilder = ExpressionBuilder<MediaReferenceSchema, string>;

export async function isMediaReferenced(
	executor: DatabaseExecutor,
	clientId: string,
	media: Media
): Promise<boolean> {
	const object = JSON.stringify(media);
	const array = JSON.stringify([media]);
	const db = executor as unknown as Kysely<MediaReferenceSchema>;
	const matches = (column: `${string}.${string}`) => (eb: MediaReferenceExpressionBuilder) =>
		eb.or([
			eb(column, '@>', eb.cast(eb.val(object), 'jsonb')),
			eb(column, '@>', eb.cast(eb.val(array), 'jsonb'))
		]);

	const queries = [
		db
			.selectFrom('client as c')
			.where('c.id', '=', clientId)
			.where((eb) =>
				eb.or([
					matches('c.logo')(eb),
					matches('c.favicon')(eb),
					matches('c.splash')(eb),
					matches('c.hero')(eb)
				])
			)
			.select('c.id'),
		db
			.selectFrom('user as u')
			.where('u.clientId', '=', clientId)
			.where(matches('u.picture'))
			.select('u.id'),
	];

	for (const query of queries) {
		if (await query.executeTakeFirst()) return true;
	}

	return false;
}
