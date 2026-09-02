import { DEFAULT_CLIENT_ACCESS_TOKEN_KEY, DEFAULT_CLIENT_ADMINISTRATION_EMAIL, DEFAULT_CLIENT_DEFAULT_DOMAIN, DEFAULT_CLIENT_NAME, DEFAULT_CLIENT_PLAUSIBLE_DOMAIN, DEFAULT_CLIENT_SLUG, DEFAULT_USER_EMAIL, DEFAULT_USER_FIRST_NAME, DEFAULT_USER_LAST_NAME, DEFAULT_USER_PASSWORD } from '$app/env/private';
import type { Schema } from '$lib/db/schema';
import { Language, MediaCollection, type Media, type Translatable } from '$lib/db/schemas/0-utils';
import { ClientAuthenticationMethod, UserRole } from '$lib/db/schemas/1-client-user-module';
import bcrypt from 'bcryptjs';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

export const DummyDataDefaultClientAndUsers: Migration = {
  async up(db: Kysely<Schema>) {

    // Create the default Client
    const client = await db.insertInto('client')
      .values({
        slug: DEFAULT_CLIENT_SLUG,
        name: DEFAULT_CLIENT_NAME,
        domains: [...(process.env.NODE_ENV !== 'production' ? ['localhost:5173', 'localhost:4173'] : []), DEFAULT_CLIENT_DEFAULT_DOMAIN],
				locales: [Language.English, Language.Nederlands],
        administrationEmail: DEFAULT_CLIENT_ADMINISTRATION_EMAIL,
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
            name: DEFAULT_CLIENT_NAME,
            short_name: 'Missions',
            description: 'Achieve your missions.',
            scope: '/',
            start_url: '/',
            display: 'standalone',
            icons: [
              {
                src: '/evolyn-logo.svg',
                sizes: 'any',
                type: 'image/svg+xml',
              },
              {
                src: `/evolyn-logo-maskable.png`,
                purpose: 'maskable',
                sizes: '1024x1024',
                type: 'image/png',
              },
            ],
            background_color: '#ffffff',
            theme_color: '#0079c1',
          }
        ),
        isFindableBySearchEngines: true,
        plausibleDomain: process.env.NODE_ENV === 'production' ? DEFAULT_CLIENT_PLAUSIBLE_DOMAIN : undefined,
        authenticationMethods: [ClientAuthenticationMethod.code, ClientAuthenticationMethod.password],
        accessTokenKey: DEFAULT_CLIENT_ACCESS_TOKEN_KEY,
        redirectAuthorized: process.env.NODE_ENV !== 'production' ? '/edit/groups' : null,
        // createdBy: admin.id,
        // updatedBy: admin.id,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const clientId = client.id;

    // Create the default admin User
    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(DEFAULT_USER_PASSWORD, salt);
    const admin = await db.insertInto('user')
      .values({
        clientId,
        email: DEFAULT_USER_EMAIL,
        password: `{bcrypt}${hash}`,
        firstName: DEFAULT_USER_FIRST_NAME,
        lastName: DEFAULT_USER_LAST_NAME,
        picture: JSON.stringify({ collection: MediaCollection.externals, filename: 'https://api.dicebear.com/10.x/open-peeps/svg?seed=50' } as Media),
        language: Language.Nederlands,
        roles: [UserRole.admin, UserRole.participant],
        emailConfirmed: true,
        isActive: true,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // Create a dummy License
    const license = await db.insertInto('license')
      .values({
        clientId,
        name: JSON.stringify({ en: 'Dummy license' } as Translatable),
        version: 'v0.0.0',
        termsOfUse: JSON.stringify({ default: `# Terms of Use` } as Translatable),
        privacyPolicy: JSON.stringify({ default: `# Privacy Policy` } as Translatable),
        createdBy: admin.id,
        updatedBy: admin.id,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // Create additional Users for this Client, with Auth Codes
    if (process.env.NODE_ENV !== 'production') {
      await db.insertInto('user')
        .values([
          {
            clientId,
            password: `{bcrypt}${hash}`,
            firstName: 'Marie',
            lastName: 'Romero',
            picture: JSON.stringify({ collection: MediaCollection.externals, filename: 'https://api.dicebear.com/10.x/open-peeps/svg?seed=5' } as Media),
            language: Language.Nederlands,
            roles: [UserRole.participant],
            emailConfirmed: true,
            isActive: true,
          },
          {
            clientId,
            password: `{bcrypt}${hash}`,
            firstName: 'Albert',
            lastName: 'Morgan',
            picture: JSON.stringify({ collection: MediaCollection.externals, filename: 'https://api.dicebear.com/10.x/open-peeps/svg?seed=8' } as Media),
            language: Language.Nederlands,
            roles: [UserRole.participant],
            emailConfirmed: true,
            isActive: true,
          },
          {
            clientId,
            password: `{bcrypt}${hash}`,
            firstName: 'Cynthia',
            lastName: 'Shaw',
            picture: JSON.stringify({ collection: MediaCollection.externals, filename: 'https://api.dicebear.com/10.x/open-peeps/svg?seed=9' } as Media),
            language: Language.Nederlands,
            roles: [UserRole.participant],
            emailConfirmed: true,
            isActive: true,
          },
          {
            clientId,
            password: `{bcrypt}${hash}`,
            firstName: 'Ryan',
            lastName: 'Carroll',
            picture: JSON.stringify({ collection: MediaCollection.externals, filename: 'https://api.dicebear.com/10.x/open-peeps/svg?seed=7' } as Media),
            language: Language.Nederlands,
            roles: [UserRole.participant],
            emailConfirmed: true,
            isActive: true,
          },
          {
            clientId,
            password: `{bcrypt}${hash}`,
            firstName: 'Barbara',
            lastName: 'Foster',
            picture: JSON.stringify({ collection: MediaCollection.externals, filename: 'https://api.dicebear.com/10.x/open-peeps/svg?seed=16' } as Media),
            language: Language.Nederlands,
            roles: [UserRole.participant],
            emailConfirmed: true,
            isActive: true,
          },
          {
            clientId,
            password: `{bcrypt}${hash}`,
            firstName: 'Rusell',
            lastName: 'Myers',
            picture: JSON.stringify({ collection: MediaCollection.externals, filename: 'https://api.dicebear.com/10.x/open-peeps/svg?seed=14' } as Media),
            language: Language.Nederlands,
            roles: [UserRole.participant],
            emailConfirmed: true,
            isActive: true,
          },
          {
            clientId,
            password: `{bcrypt}${hash}`,
            firstName: 'Evelyn',
            lastName: 'Jimenez',
            picture: JSON.stringify({ collection: MediaCollection.externals, filename: 'https://api.dicebear.com/10.x/open-peeps/svg?seed=27' } as Media),
            language: Language.Nederlands,
            roles: [UserRole.participant],
            emailConfirmed: true,
            isActive: true,
          },
          {
            clientId,
            password: `{bcrypt}${hash}`,
            firstName: 'Jack',
            lastName: 'Newman',
            picture: JSON.stringify({ collection: MediaCollection.externals, filename: 'https://api.dicebear.com/10.x/open-peeps/svg?seed=12' } as Media),
            language: Language.Nederlands,
            roles: [UserRole.participant],
            emailConfirmed: true,
            isActive: true,
          },
          {
            clientId,
            password: `{bcrypt}${hash}`,
            firstName: 'Kathleen',
            lastName: 'Thompson',
            picture: JSON.stringify({ collection: MediaCollection.externals, filename: 'https://api.dicebear.com/10.x/open-peeps/svg?seed=24' } as Media),
            language: Language.Nederlands,
            roles: [UserRole.participant],
            emailConfirmed: true,
            isActive: true,
          }
        ])
        .execute();

      const users = await db.selectFrom('user').where('clientId', '=', client.id).select('id').orderBy('createdAt', 'asc').execute();

      for (const [index, user] of users.entries()) {
        await db.insertInto('licenseAgreement')
          .values({ userId: user.id, licenseId: license.id, isAccepted: true })
          .execute();

        await db.insertInto('authCode')
          .values({
            clientId,
            userId: user.id,
            value: `access-${index}`,
            // value: crypto.randomUUID().toString().slice(0, 8),
          })
          .returning('id')
          .executeTakeFirstOrThrow();
      }
    }

  },
  async down() {
    // db: Kysely<Schema>

  },
};