import { sql, type ExpressionBuilder, type JSONColumnType, type StringReference } from 'kysely';
import { z } from 'zod/v4';
import type { $ZodIssue } from 'zod/v4/core';

export const MediaCollection = {
  internals: 'internals',
  clients: 'clients',
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


export const formObjectPreprocessor = (val: unknown) => {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const cleaned = Object.fromEntries(Object.entries(val).filter(([, v]) => v !== ''));
    val = Object.keys(cleaned).length === 0 ? null : cleaned;
  }
  return val;
}

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
  'English' = 'en',
  'Bulgarian' = 'bg',
  'Catalan' = 'ca',
  'Danish' = 'da',
  'German' = 'de',
  'Spanish' = 'es',
  'Finnish' = 'fi',
  'French' = 'fr',
  'Italian' = 'it',
  'Dutch' = 'nl',
  'Norwegian' = 'no',
  'Portuguese' = 'pt',
  'Swedish' = 'sv',
}
export enum LanguageFlag {
  'default' = '🌐',
  'en' = '🇺🇸',
  'bg' = '🇧🇬',
  'ca' = '🏴󠁥󠁳󠁣󠁴󠁿',
  'da' = '🇩🇰',
  'de' = '🇩🇪',
  'es' = '🇪🇸',
  'fi' = '🇫🇮',
  'fr' = '🇫🇷',
  'it' = '🇮🇹',
  'nl' = '🇳🇱',
  'no' = '🇳🇴',
  'pt' = '🇵🇹',
  'sv' = '🇸🇪',
}
export const translatableValidator = z
  .partialRecord(
    z.enum(Language).or(z.enum(['default'])),
    z.string().min(1)
  ).refine(
    (data) => data.default || data[Language.English], { message: `Translation must include at least 'default' or 'en'` }
  );
export type Translatable = z.infer<typeof translatableValidator>; // Record<'default' | Language, string>;
export type TranslatableColumn = JSONColumnType<Translatable>;
export const selectLocalizedField = <DB, TB extends keyof DB & string>(eb: ExpressionBuilder<DB, TB>, column: StringReference<DB, TB>, language?: Language | null) => {
  return eb.fn.coalesce(
    sql<string | null>`${eb.ref(column)}->>${language ?? Language.English}`,
    sql<string | null>`${eb.ref(column)}->>'default'`,
    sql<string | null>`${eb.ref(column)}->>${Language.English}`,
  );
}
export const translateLocalizedField = (obj?: Translatable | null, language?: Language | 'default' | null) => {
  return obj?.[language ?? 'default'] ?? obj?.default ?? obj?.[Language.English];
}

export const expressionValidator = z.object({
  expression: z.record(z.string(), z.unknown()),
  constants: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
}).strict();
export type Expression = z.infer<typeof expressionValidator>;


export const Orientation = {
  portrait: 'portrait',
  landscape: 'landscape',
  square: 'square',
} as const;
export type Orientation = (typeof Orientation)[keyof typeof Orientation];
export const orientationableUrlValidator = z.record(z.union([z.enum(['default']), z.enum(Orientation)]), z.url().min(1).optional()).refine(
  (data) => data.default || data[Orientation.portrait], { message: `Must include at least 'default' or 'portrait'` }
);
export type Orientationable = Partial<z.infer<typeof orientationableUrlValidator>>; // Record<'default' | Orientation, string>;
export type OrientationableColumn = JSONColumnType<Orientationable>;
export const selectByOrientation = <DB, TB extends keyof DB & string>(eb: ExpressionBuilder<DB, TB>, column: StringReference<DB, TB>, orientation?: Orientation | null) => {
  return eb.fn.coalesce(
    sql<string | null>`${eb.ref(column)}->>${orientation ?? Orientation.portrait}`,
    sql<string | null>`${eb.ref(column)}->>'default'`,
    sql<string | null>`${eb.ref(column)}->>${Orientation.portrait}`,
  );
}
export const orientateOrientationableField = (obj?: Orientationable | null, orientation?: Orientation | null) => {
  return obj?.[orientation ?? 'default'] ?? obj?.default ?? obj?.[Orientation.portrait];
}

export const formatDuration = (duration: number, percentage: number = 1) => {
  const seconds = duration * percentage;
  return [Math.floor((seconds / 60) % 60), Math.round(seconds % 60)]
    .join(':')
    .replace(/\b(\d)\b/g, '0$1');
};

export const formatFormError = (error: $ZodIssue[] | null | undefined, path: string) => {
  let message;
  if (path.endsWith('.*')) {
    path = path.replace('.*', '');
    message = error?.find((e) => e.path?.join('.').startsWith(path))?.message
  } else {
    message = error?.find((e) => e.path?.join('.') === path)?.message
  }
  return message;
}