import type { ColumnType, Generated, JSONColumnType } from 'kysely';
import type { JSONSchema } from 'zod/v4/core';
import type { Language, MediaColumn, TranslatableColumn } from './0-utils';


export const UserRole = {
  participant: 'participant',
  editor: 'editor',
  admin: 'admin',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ClientAuthenticationMethod = {
  password: 'password',
  code: 'code'
} as const;
export type ClientAuthenticationMethod = (typeof ClientAuthenticationMethod)[keyof typeof ClientAuthenticationMethod];

export type ClientUserModuleSchema = {
  client: Client;
  clientMedia: ClientMedia;
  user: User;
  userMedia: UserMedia;
  authCode: AuthCode;
  license: License;
  licenseAgreement: LicenseAgreement;
};

type Client = {
  id: Generated<string>;
  reference: string; // unique
  name: string;
  description: TranslatableColumn | null;
  domains: string[];
  logo: MediaColumn | null;
  favicon: MediaColumn | null;
  splash: MediaColumn | null;
  hero: MediaColumn | null;
  css: JSONColumnType<Record<string, Record<string, string>>> | null;
  manifest: JSONColumnType<object> | null;
  isFindableBySearchEngines: ColumnType<boolean, boolean | null, boolean>;
  plausibleDomain: string | null;
  authenticationMethods: ClientAuthenticationMethod[];
  accessTokenKey: string;
  redirectAuthorized: string | null;
  redirectUnauthorized: string | null;
  onboardingSchema: JSONColumnType<JSONSchema.BaseSchema> | null;
  createdAt: ColumnType<Date, never, never>;
  createdBy: string | null;
  updatedAt: ColumnType<Date, never, Date>;
  updatedBy: string | null;
  defaultCampaignId: string | null;
}

type ClientMedia = {
  id: Generated<string>;
  clientId: string;
  name: string;
  extension: string;
  description: string | null;
  size: number;
  createdAt: ColumnType<Date, never, never>;
  createdBy: string | null;
  updatedAt: ColumnType<Date, never, Date>;
  updatedBy: string | null;
}

type User = {
  id: Generated<string>;
  clientId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  picture: MediaColumn | null;
  password: string | null;
  roles: UserRole[];
  language: Language | null;
  pronouns: string | null;
  address: JSONColumnType<object> | null;
  dateOfBirth: ColumnType<Date | null, Date | null, Date | null>;
  emailConfirmed: ColumnType<boolean, boolean | null, boolean>;
  emailConfirmCode: string | null;
  passwordResetCode: string | null;
  passwordResetExpiresAt: ColumnType<Date | null, Date | null, Date | null>;
  isActive: ColumnType<boolean, boolean | null, boolean>;
  reasonForDeactivation: string | null;
  createdAt: ColumnType<Date, never, never>;
  createdBy: string | null;
  updatedAt: ColumnType<Date, never, Date>;
  updatedBy: string | null;
}

type UserMedia = {
  id: Generated<string>;
  userId: string;
  name: string;
  extension: string;
  description: string | null;
  size: number;
  createdAt: ColumnType<Date, never, never>;
  createdBy: string | null;
  updatedAt: ColumnType<Date, never, Date>;
  updatedBy: string | null;
}

type AuthCode = {
  id: Generated<string>;
  clientId: string;
  userId: string;
  value: string;
  usedAt: ColumnType<Date, Date | null, Date | null>;
}

type License = {
  id: Generated<string>;
  clientId: string;
  name: TranslatableColumn;
  version: string;
  termsOfUse: TranslatableColumn | null;
  privacyPolicy: TranslatableColumn | null;
  createdAt: ColumnType<Date, never, never>;
  createdBy: string | null;
  updatedAt: ColumnType<Date, never, Date>;
  updatedBy: string | null;
}

type LicenseAgreement = {
  id: Generated<string>;
  licenseId: string;
  userId: string;
  isAccepted: boolean;
  createdAt: ColumnType<Date, never, never>;
  updatedAt: ColumnType<Date, never, Date>;
}
