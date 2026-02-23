import { type Media } from '$lib/db/schemas/0-utils';
import { ClientAuthenticationMethod } from '$lib/db/schemas/1-client-user-module';
import type { JSONSchema } from 'zod/v4/core';
import { createClientGameBus } from './2a-client-gamebus';


export type CurrentClient = {
  id: string;
  reference: string;
  name: string;
  logo: Media | null;
  favicon: Media | null;
  css: Record<string, Record<string, string>> | null;
  manifest: object | null;
  isFindableBySearchEngines: boolean;
  plausibleDomain: string | null;
  authenticationMethods: ClientAuthenticationMethod[];
  accessTokenKey: string;
  redirectAuthorized: string | null;
  redirectUnauthorized: string | null;
  onboardingSchema: JSONSchema.BaseSchema | null;
};

export const DEMO_CLIENTS = [
  {
    reference: 'gamebus',
    domains: ['stories.test.gamebus.eu', 'stories.healthyw8.gamebus.eu', 'stories.gamebus.eu'],
    create: createClientGameBus,
  },
];
