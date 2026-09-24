import { sql, type ExpressionBuilder, type JSONColumnType, type StringReference } from 'kysely';
import { z } from 'zod/v4';
import type { $ZodIssue } from 'zod/v4/core';

export const MediaCollection = {
  externals: 'externals',
  internals: 'internals',
  clients: 'clients',
  users: 'users',
} as const;
export type MediaCollection = (typeof MediaCollection)[keyof typeof MediaCollection];

export const mediaValidator = z.object({
  collection: z.enum(MediaCollection),
  filename: z.string().trim().min(1),
});
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

// Adapted from https://gist.github.com/eilonmore/77f9fc3ddfd939f1513d7a8ed2641321
export enum Language {
  'English' = 'en',
  'български' = 'bg',
  'Català' = 'ca',
  'Dansk' = 'da',
  'Deutsch' = 'de',
  'Español' = 'es',
  'Suomi' = 'fi',
  'Français' = 'fr',
  'Italiano' = 'it',
  'Nederlands' = 'nl',
  'Norsk' = 'no',
  'Português' = 'pt',
  'Svenska' = 'sv',
}
export const LanguageReverse = Object.fromEntries(
  Object.entries(Language).map(([k, v]) => [v, k])
) as Record<Language, keyof typeof Language>;
export enum LanguageFlag {
  'default' = '🌐',
  'en' = '🇺🇸',
  'bg' = '🇧🇬',
  'ca' = '🏴',
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
    z.string().trim().min(1)
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

export const translatableMediaValidator = z
  .partialRecord(z.enum(Language).or(z.enum(['default'])), mediaValidator)
  .refine((data) => data.default || data[Language.English], {
    message: `TranslatedMedia must include at least 'default' or 'en'`
  });
export type TranslatableMedia = z.infer<typeof translatableMediaValidator>;
export type TranslatableMediaColumn = JSONColumnType<TranslatableMedia>;
export const selectLocalizedMediaField = <DB, TB extends keyof DB & string>(
  eb: ExpressionBuilder<DB, TB>,
  column: StringReference<DB, TB>,
  language?: Language | null
) => {
  return sql<Media | null>`coalesce(
    ${eb.ref(column)}->${language ?? Language.English},
    ${eb.ref(column)}->'default',
    ${eb.ref(column)}->${Language.English}
  )`;
};
export const translateLocalizedMediaField = (
  obj?: TranslatableMedia | null,
  language?: Language | 'default' | null
) => {
  return obj?.[language ?? 'default'] ?? obj?.default ?? obj?.[Language.English];
};

export const areTranslatablesEqual = (a?: Translatable | null, b?: Translatable | null) => {
  if (a == null && b == null) return true; // both null/undefined
  if (a == null || b == null) return false;

  const keys = [...Object.values(Language), 'default'] as const;

  return keys.every((key) => {
    const aHas = Object.prototype.hasOwnProperty.call(a, key);
    const bHas = Object.prototype.hasOwnProperty.call(b, key);

    if (aHas !== bHas) return false;
    if (aHas && a[key] !== b[key]) return false;

    return true;
  });
};

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
