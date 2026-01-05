import { sql, type ExpressionBuilder, type JSONColumnType, type StringReference } from 'kysely';
import { z } from 'zod/v4';

export const MediaCollection = {
  internals: 'internals',
  clients: 'clients',
  campaigns: 'campaigns',
  users: 'users',
  externals: 'externals',
} as const;
export type MediaCollection = (typeof MediaCollection)[keyof typeof MediaCollection];

export const mediaValidator = z.object({
  collection: z.enum(MediaCollection),
  filename: z.string().min(1),
}).strict();
export type Media = z.infer<typeof mediaValidator>;
export type MediaColumn = JSONColumnType<Media>;

export const AcceptedImageFileTypes = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpg',
  png: 'image/png',
  svg: 'image/svg+xml',
  gif: 'image/gif',
} as const;
export type AcceptedImageFileTypes = (typeof AcceptedImageFileTypes)[keyof typeof AcceptedImageFileTypes];

export const AcceptedVideoFileTypes = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
} as const;
export type AcceptedVideoFileTypes = (typeof AcceptedVideoFileTypes)[keyof typeof AcceptedVideoFileTypes];

export const AcceptedFileTypes = { ...AcceptedImageFileTypes, ...AcceptedVideoFileTypes } as const;
export type AcceptedFileTypes = (typeof AcceptedFileTypes)[keyof typeof AcceptedFileTypes];


export const DaysOfWeek = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 0,
} as const;
export type DaysOfWeek = (typeof DaysOfWeek)[keyof typeof DaysOfWeek];


// Adapted from https://gist.github.com/eilonmore/77f9fc3ddfd939f1513d7a8ed2641321
export enum Language {
  'German' = 'de',
  'English' = 'en',
  'Spanish' = 'es',
  'French' = 'fr',
  'Italian' = 'it',
  'Dutch' = 'nl',
  'Portuguese' = 'pt',
}
export enum LanguageFlag {
  'default' = '🌐',
  'de' = '🇩🇪',
  'en' = '🇺🇸',
  'es' = '🇪🇸',
  'fr' = '🇫🇷',
  'it' = '🇮🇹',
  'nl' = '🇳🇱',
  'pt' = '🇵🇹',
}

export const translatableValidator = z.record(z.union([z.enum(['default']), z.enum(Language)]), z.string().min(1).optional()).refine(
  (data) => data.default || data[Language.English], { message: `Translation must include at least 'default' or 'en'` }
);
export type Translatable = Partial<z.infer<typeof translatableValidator>>; // Record<'default' | Language, string>;
export type TranslatableColumn = JSONColumnType<Translatable>;

export const selectLocalizedField = <DB, TB extends keyof DB & string>(eb: ExpressionBuilder<DB, TB>, column: StringReference<DB, TB>, language?: Language | null) => {
  return eb.fn.coalesce(
    sql<string | null>`${eb.ref(column)}->>${language ?? Language.English}`,
    sql<string | null>`${eb.ref(column)}->>'default'`,
    sql<string | null>`${eb.ref(column)}->>${Language.English}`,
  );
}

export const translateLocalizedField = (obj?: Translatable | null, language?: Language | null) => {
  return obj?.[language ?? 'default'] ?? obj?.default ?? obj?.[Language.English];
}

export const expressionValidator = z.object({
  expression: z.record(z.string(), z.unknown()),
  constants: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
}).strict();
export type Expression = z.infer<typeof expressionValidator>;


export const StoryOrientation = {
  portrait: 'portrait',
  landscape: 'landscape',
  square: 'square',
} as const;
export type StoryOrientation = (typeof StoryOrientation)[keyof typeof StoryOrientation];

export const selectByOrientation = <DB, TB extends keyof DB & string>(eb: ExpressionBuilder<DB, TB>, column: StringReference<DB, TB>, orientation?: StoryOrientation | null) => {
  return eb.fn.coalesce(
    sql<string | null>`${eb.ref(column)}->>${orientation ?? StoryOrientation.portrait}`,
    sql<string | null>`${eb.ref(column)}->>'default'`,
    sql<string | null>`${eb.ref(column)}->>${StoryOrientation.portrait}`,
  );
}
