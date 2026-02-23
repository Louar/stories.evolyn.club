import { env } from '$env/dynamic/private';
import type { Schema } from '$lib/db/schema';
import { Language, MediaCollection, type Media, type Translatable } from '$lib/db/schemas/0-utils';
import { ClientAuthenticationMethod, UserRole } from '$lib/db/schemas/1-client-user-module';
import bcrypt from 'bcryptjs';
import type { Transaction } from 'kysely';
import { DEMO_CLIENTS, type CurrentClient } from './2-demo-clients';


export const createClientGameBus = async (trx: Transaction<Schema>): Promise<CurrentClient> => {

  // ******************************
  // CLIENT
  // ******************************
  const client = await trx.insertInto('client')
    .values({
      reference: 'gamebus',
      name: 'GameBus Stories',
      description: JSON.stringify({
        default: `# GameBus Stories`,
      } as Translatable),
      domains: DEMO_CLIENTS.find(client => client.reference === 'gamebus')!.domains,
      favicon: JSON.stringify({ collection: MediaCollection.clients, filename: 'gamebus-logo.png' } as Media),
      css: JSON.stringify({
        ":root": {
          "--radius": "0.625rem",
          "--background": "oklch(1 0 0)",
          "--foreground": "oklch(0.129 0.042 264.695)",
          "--card": "oklch(1 0 0)",
          "--card-foreground": "oklch(0.129 0.042 264.695)",
          "--popover": "oklch(1 0 0)",
          "--popover-foreground": "oklch(0.129 0.042 264.695)",
          "--primary": "oklch(0.208 0.042 265.755)",
          "--primary-foreground": "oklch(0.984 0.003 247.858)",
          "--secondary": "oklch(0.968 0.007 247.896)",
          "--secondary-foreground": "oklch(0.208 0.042 265.755)",
          "--muted": "oklch(0.968 0.007 247.896)",
          "--muted-foreground": "oklch(0.554 0.046 257.417)",
          "--accent": "oklch(0.968 0.007 247.896)",
          "--accent-foreground": "oklch(0.208 0.042 265.755)",
          "--destructive": "oklch(0.577 0.245 27.325)",
          "--border": "oklch(0.929 0.013 255.508)",
          "--input": "oklch(0.929 0.013 255.508)",
          "--ring": "oklch(0.704 0.04 256.788)",
          "--chart-1": "oklch(0.646 0.222 41.116)",
          "--chart-2": "oklch(0.6 0.118 184.704)",
          "--chart-3": "oklch(0.398 0.07 227.392)",
          "--chart-4": "oklch(0.828 0.189 84.429)",
          "--chart-5": "oklch(0.769 0.188 70.08)",
          "--sidebar": "oklch(0.984 0.003 247.858)",
          "--sidebar-foreground": "oklch(0.129 0.042 264.695)",
          "--sidebar-primary": "oklch(0.208 0.042 265.755)",
          "--sidebar-primary-foreground": "oklch(0.984 0.003 247.858)",
          "--sidebar-accent": "oklch(0.968 0.007 247.896)",
          "--sidebar-accent-foreground": "oklch(0.208 0.042 265.755)",
          "--sidebar-border": "oklch(0.929 0.013 255.508)",
          "--sidebar-ring": "oklch(0.704 0.04 256.788)"
        },
        ".dark": {
          "--background": "oklch(0.129 0.042 264.695)",
          "--foreground": "oklch(0.984 0.003 247.858)",
          "--card": "oklch(0.208 0.042 265.755)",
          "--card-foreground": "oklch(0.984 0.003 247.858)",
          "--popover": "oklch(0.208 0.042 265.755)",
          "--popover-foreground": "oklch(0.984 0.003 247.858)",
          "--primary": "oklch(0.929 0.013 255.508)",
          "--primary-foreground": "oklch(0.208 0.042 265.755)",
          "--secondary": "oklch(0.279 0.041 260.031)",
          "--secondary-foreground": "oklch(0.984 0.003 247.858)",
          "--muted": "oklch(0.279 0.041 260.031)",
          "--muted-foreground": "oklch(0.704 0.04 256.788)",
          "--accent": "oklch(0.279 0.041 260.031)",
          "--accent-foreground": "oklch(0.984 0.003 247.858)",
          "--destructive": "oklch(0.704 0.191 22.216)",
          "--border": "oklch(1 0 0 / 10%)",
          "--input": "oklch(1 0 0 / 15%)",
          "--ring": "oklch(0.551 0.027 264.364)",
          "--chart-1": "oklch(0.488 0.243 264.376)",
          "--chart-2": "oklch(0.696 0.17 162.48)",
          "--chart-3": "oklch(0.769 0.188 70.08)",
          "--chart-4": "oklch(0.627 0.265 303.9)",
          "--chart-5": "oklch(0.645 0.246 16.439)",
          "--sidebar": "oklch(0.208 0.042 265.755)",
          "--sidebar-foreground": "oklch(0.984 0.003 247.858)",
          "--sidebar-primary": "oklch(0.488 0.243 264.376)",
          "--sidebar-primary-foreground": "oklch(0.984 0.003 247.858)",
          "--sidebar-accent": "oklch(0.279 0.041 260.031)",
          "--sidebar-accent-foreground": "oklch(0.984 0.003 247.858)",
          "--sidebar-border": "oklch(1 0 0 / 10%)",
          "--sidebar-ring": "oklch(0.551 0.027 264.364)"
        }
      }),
      manifest: JSON.stringify(
        {
          name: 'GameBus Stories',
          short_name: 'Stories',
          description: 'Maak je eigen stories.',
          lang: 'nl-NL',
          scope: '/',
          start_url: '/',
          display: 'standalone',
          icons: [
            {
              src: `/api/media/${MediaCollection.clients}/gamebus-logo.svg`,
              sizes: 'any',
              type: 'image/svg+xml',
            },
            {
              src: `/api/media/${MediaCollection.clients}/gamebus-logo-maskable.png`,
              purpose: 'maskable',
              sizes: '1024x1024',
              type: 'image/png',
            },
          ],
          background_color: '#ffffff',
          theme_color: '#f54900',
        }
      ),
      isFindableBySearchEngines: true,
      plausibleDomain: undefined,
      authenticationMethods: [ClientAuthenticationMethod.code, ClientAuthenticationMethod.password],
      accessTokenKey: 'VlxkYqAkpZCPm4Ds1ZAOQUlZFAZVMx3oUh4GDya8jRo=',
      onboardingSchema: undefined,
      // createdBy: userId,
      // updatedBy: userId,
    })
    .returning([
      'client.id',
      'client.reference',
      'client.name',
      'client.logo',
      'client.favicon',
      'client.css',
      'client.manifest',
      'client.isFindableBySearchEngines',
      'client.plausibleDomain',
      'client.authenticationMethods',
      'client.accessTokenKey',
      'client.redirectAuthorized',
      'client.redirectUnauthorized',
      'client.accessTokenKey',
      'client.onboardingSchema'
    ])
    .executeTakeFirstOrThrow();

  // Create the default admin User
  const salt = await bcrypt.genSalt();
  const hash = await bcrypt.hash(env.SECRET_DEFAULT_USER_PASSWORD, salt);
  const admin = await trx.insertInto('user')
    .values({
      clientId: client.id,
      email: env.SECRET_DEFAULT_USER_EMAIL,
      password: `{bcrypt}${hash}`,
      firstName: env.SECRET_DEFAULT_USER_FIRST_NAME,
      lastName: env.SECRET_DEFAULT_USER_LAST_NAME,
      roles: [UserRole.admin, UserRole.user],
      language: Language.Dutch,
      emailConfirmed: true,
      isActive: true,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await trx.insertInto('authCode')
    .values({
      clientId: client.id,
      userId: admin.id,
      value: `access-admin`,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  await trx.insertInto('license')
    .values({
      clientId: client.id,
      name: JSON.stringify({ en: 'Dummy license' } as Translatable),
      version: 'v1.0.0',
      termsOfUse: JSON.stringify({
        default: `# Terms of Use`
      } as Translatable),
      privacyPolicy: JSON.stringify({
        default: `# Privacy Policy`
      } as Translatable),
      createdBy: admin.id,
      updatedBy: admin.id,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  return client;

};
