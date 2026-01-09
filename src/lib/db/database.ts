import { env } from '$env/dynamic/private';
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
    database: env.SECRET_DB_DATABASE,
    host: env.SECRET_DB_HOST,
    user: env.SECRET_DB_USER,
    password: env.SECRET_DB_PASSWORD,
    port: Number(env.SECRET_DB_PORT),
    max: Number(env.SECRET_DB_MAX),
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
