import { POSTGRES_DB, POSTGRES_HOST, POSTGRES_MAX, POSTGRES_PASSWORD, POSTGRES_PORT, POSTGRES_USER } from '$app/env/private';
import { CamelCasePlugin, HandleEmptyInListsPlugin, Kysely, PostgresDialect, replaceWithNoncontingentExpression } from 'kysely';
import pg from 'pg';
import { migrate } from './migrator';
import type { Schema } from './schema';

const { Pool } = pg;

// Map bigint to number
pg.types.setTypeParser(20, (val) => {
  return parseInt(val, 10)
})

const dialect = new PostgresDialect({
  pool: new Pool({
    database: POSTGRES_DB,
    host: POSTGRES_HOST,
    user: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    port: POSTGRES_PORT,
    max: POSTGRES_MAX,
  })
})

const kysely = new Kysely<Schema>({
  dialect,
  plugins: [
    new CamelCasePlugin(),
    new HandleEmptyInListsPlugin({
      strategy: replaceWithNoncontingentExpression
    })
  ]
});

try {
  await migrate(kysely);
} catch (e) {
  console.error(e);
}

export const db = kysely;
