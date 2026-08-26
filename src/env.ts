import { defineEnvVars } from '@sveltejs/kit/env';
import z from 'zod/v4';

export const variables = defineEnvVars({
  POSTGRES_DB: {
    schema: z.string().min(1),
  },
  POSTGRES_HOST: {
    schema: z.string().min(1),
  },
  POSTGRES_USER: {
    schema: z.string().min(1),
  },
  POSTGRES_PASSWORD: {
    schema: z.string().optional(),
  },
  POSTGRES_PORT: {
    schema: z.string().transform((val) => Number(val)).pipe(z.number().int().min(0)),
  },
  POSTGRES_MAX: {
    schema: z.string().transform((val) => Number(val)).pipe(z.number().int().min(0)),
  },

  DEFAULT_USER_EMAIL: {
    schema: z.email().min(1)
  },
  DEFAULT_USER_PASSWORD: {
    schema: z.string().min(5)
  },
  DEFAULT_USER_FIRST_NAME: {
    schema: z.string().min(1)
  },
  DEFAULT_USER_LAST_NAME: {
    schema: z.string().min(1)
  },

  DEFAULT_CLIENT_SLUG: {
    schema: z.string().min(1)
  },
  DEFAULT_CLIENT_NAME: {
    schema: z.string().min(1)
  },
  DEFAULT_CLIENT_DEFAULT_DOMAIN: {
    schema: z.string().min(1)
  },
  DEFAULT_CLIENT_ADMINISTRATION_EMAIL: {
    schema: z.string().min(1).optional(),
  },
  DEFAULT_CLIENT_ACCESS_TOKEN_KEY: {
    schema: z.string().min(1)
  },
  DEFAULT_CLIENT_PLAUSIBLE_DOMAIN: {
    schema: z.string().min(1).optional(),
  },

  ASSETS_DIR: {
    schema: z.string().min(1),
  },

  DEFAULT_CADDY_API_BASE_URL: {
    schema: z.string().optional(),
  },
  DEFAULT_RESEND_API_KEY: {
    schema: z.string().optional(),
  },
  DEFAULT_OPENAI_API_KEY: {
    schema: z.string().optional(),
  },
});
