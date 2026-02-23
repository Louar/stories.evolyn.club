import type { Kysely, Migration } from 'kysely';
import { sql } from 'kysely';

export const InitClientUserModule: Migration = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async up(db: Kysely<any>) {

    // Create the Client table
    await db.schema.createTable('client')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`uuidv7()`).notNull())
      .addColumn('reference', 'text', (col) => col.unique().notNull())
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('description', 'jsonb')
      .addColumn('domains', sql`text[]`, (col) => col.notNull())
      .addColumn('logo', 'jsonb')
      .addColumn('favicon', 'jsonb')
      .addColumn('splash', 'jsonb')
      .addColumn('css', 'json')
      .addColumn('manifest', 'json')
      .addColumn('is_findable_by_search_engines', 'boolean', (col) => col.defaultTo(false).notNull())
      .addColumn('plausible_domain', 'text')
      .addColumn('authentication_methods', sql`text[]`, (col) => col.notNull())
      .addColumn('access_token_key', 'text', (col) => col.notNull())
      .addColumn('redirect_authorized', 'text')
      .addColumn('redirect_unauthorized', 'text')
      .addColumn('onboarding_schema', 'json')
      .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
      .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
      .execute();

    // Create the ClientMedia table
    await db.schema.createTable('client_media')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`uuidv7()`).notNull())
      .addColumn('client_id', 'uuid', (col) => col.references('client.id').onDelete('cascade').notNull())
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('extension', 'text', (col) => col.notNull())
      .addColumn('description', 'text')
      .addColumn('size', 'bigint', (col) => col.notNull())
      .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
      .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
      .addUniqueConstraint('unique_media_per_client', ['client_id', 'name'])
      .execute();

    // Create the User table
    await db.schema.createTable('user')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`uuidv7()`).notNull())
      .addColumn('client_id', 'uuid', (col) => col.references('client.id').onDelete('cascade').notNull())
      .addColumn('email', 'text')
      .addColumn('first_name', 'text')
      .addColumn('last_name', 'text')
      .addColumn('picture', 'jsonb')
      .addColumn('password', 'text')
      .addColumn('roles', sql`text[]`, (col) => col.notNull())
      .addColumn('language', 'text')
      .addColumn('pronouns', 'text')
      .addColumn('address', 'jsonb')
      .addColumn('date_of_birth', 'date')
      .addColumn('email_confirmed', 'boolean', (col) => col.defaultTo(false).notNull())
      .addColumn('email_confirm_code', 'text')
      .addColumn('password_reset_code', 'text')
      .addColumn('password_reset_expires_at', 'timestamp')
      .addColumn('is_active', 'boolean', (col) => col.defaultTo(true).notNull())
      .addColumn('reason_for_deactivation', 'text')
      .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
      .addColumn('created_by', 'uuid', (col) => col.references('user.id').onDelete('set null'))
      .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
      .addColumn('updated_by', 'uuid', (col) => col.references('user.id').onDelete('set null'))
      .execute();

    await db.schema.alterTable('client')
      .addColumn('created_by', 'uuid', (col) => col.references('user.id').onDelete('set null'))
      .addColumn('updated_by', 'uuid', (col) => col.references('user.id').onDelete('set null'))
      .execute();
    await db.schema.alterTable('client_media')
      .addColumn('created_by', 'uuid', (col) => col.references('user.id').onDelete('set null'))
      .addColumn('updated_by', 'uuid', (col) => col.references('user.id').onDelete('set null'))
      .execute();

    // Create the UserMedia table
    await db.schema.createTable('user_media')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`uuidv7()`).notNull())
      .addColumn('user_id', 'uuid', (col) => col.references('user.id').onDelete('cascade').notNull())
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('extension', 'text', (col) => col.notNull())
      .addColumn('description', 'text')
      .addColumn('size', 'bigint', (col) => col.notNull())
      .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
      .addColumn('created_by', 'uuid', (col) => col.references('user.id').onDelete('set null'))
      .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
      .addColumn('updated_by', 'uuid', (col) => col.references('user.id').onDelete('set null'))
      .addUniqueConstraint('unique_media_per_user', ['user_id', 'name'])
      .execute();

    // Create the AuthCode table
    await db.schema.createTable('auth_code')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`uuidv7()`).notNull())
      .addColumn('client_id', 'uuid', (col) => col.references('client.id').onDelete('cascade').notNull())
      .addColumn('user_id', 'uuid', (col) => col.references('user.id').onDelete('cascade').notNull())
      .addColumn('value', 'text', (col) => col.notNull())
      .addColumn('used_at', 'timestamptz')
      .addUniqueConstraint('unique_value_per_client', ['client_id', 'value'])
      .addUniqueConstraint('unique_per_user_per_client', ['client_id', 'user_id'])
      .execute();

    // Create the License table
    await db.schema.createTable('license')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`uuidv7()`).notNull())
      .addColumn('client_id', 'uuid', (col) => col.references('client.id').onDelete('cascade').notNull())
      .addColumn('name', 'jsonb', (col) => col.notNull())
      .addColumn('version', 'text', (col) => col.notNull())
      .addColumn('terms_of_use', 'jsonb')
      .addColumn('privacy_policy', 'jsonb')
      .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
      .addColumn('created_by', 'uuid', (col) => col.references('user.id').onDelete('set null'))
      .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
      .addColumn('updated_by', 'uuid', (col) => col.references('user.id').onDelete('set null'))
      .addUniqueConstraint('unique_name_per_client', ['client_id', 'name'])
      .execute();

    // Create the LicenseAgreement table
    await db.schema.createTable('license_agreement')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`uuidv7()`).notNull())
      .addColumn('license_id', 'uuid', (col) => col.references('license.id').onDelete('cascade').notNull())
      .addColumn('user_id', 'uuid', (col) => col.references('user.id').onDelete('cascade').notNull())
      .addColumn('is_accepted', 'boolean', (col) => col.defaultTo(false).notNull())
      .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
      .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
      .addUniqueConstraint('unique_license_per_user', ['license_id', 'user_id'])
      .execute();
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async down(db: Kysely<any>) {
    await db.schema.dropTable('license_agreement').ifExists().execute();
    await db.schema.dropTable('license').ifExists().execute();
    await db.schema.dropTable('auth_code').ifExists().execute();
    await db.schema.dropTable('user_media').ifExists().execute();
    await db.schema.dropTable('user').ifExists().execute();
    await db.schema.dropTable('client_media').ifExists().execute();
    await db.schema.dropTable('client').ifExists().execute();
  },
};