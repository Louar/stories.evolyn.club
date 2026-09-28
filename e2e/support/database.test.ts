import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Pool } from 'pg';
import { assertTestSchema, withTestSchema } from './database.ts';
import { loadTestEnvironment } from './environment.ts';

const { env } = loadTestEnvironment();
const scope = () => {
	const E2E_SCHEMA = `e2e_${randomUUID().replaceAll('-', '')}`;
	return { ...env, E2E_SCHEMA, PGOPTIONS: `-c search_path=${E2E_SCHEMA}` };
};
const pool = () =>
	new Pool({
		host: env.POSTGRES_HOST,
		port: Number(env.POSTGRES_PORT),
		database: env.POSTGRES_DB,
		user: env.POSTGRES_USER,
		password: env.POSTGRES_PASSWORD,
		max: 1,
		connectionTimeoutMillis: 10_000
	});

test('rejects shared schemas and mismatched fixture search paths', () => {
	assert.throws(() =>
		assertTestSchema({ E2E_SCHEMA: 'public', PGOPTIONS: '-c search_path=public' })
	);
	assert.throws(() => assertTestSchema({ ...scope(), PGOPTIONS: '-c search_path=public' }));
});

test('removes a successful run namespace', async () => {
	const run = scope();
	const db = pool();
	try {
		await withTestSchema(run, async () => {
			assert.equal(
				(await db.query('SELECT to_regnamespace($1) AS name', [run.E2E_SCHEMA])).rows[0].name,
				run.E2E_SCHEMA
			);
		});
		assert.equal(
			(await db.query('SELECT to_regnamespace($1) AS name', [run.E2E_SCHEMA])).rows[0].name,
			null
		);
	} finally {
		await db.end();
	}
});

test('removes unregistered partial imports on failure without touching another run', async () => {
	const other = scope();
	const failed = scope();
	const db = pool();
	try {
		await withTestSchema(other, async () => {
			await db.query(`CREATE TABLE "${other.E2E_SCHEMA}".taxonomy (id int PRIMARY KEY)`);
			await db.query(`INSERT INTO "${other.E2E_SCHEMA}".taxonomy VALUES (1)`);
			await assert.rejects(
				withTestSchema(failed, async () => {
					await db.query(`CREATE TABLE "${failed.E2E_SCHEMA}".taxonomy (id int PRIMARY KEY)`);
					await db.query(
						`CREATE TABLE "${failed.E2E_SCHEMA}".item (taxonomy_id int REFERENCES "${failed.E2E_SCHEMA}".taxonomy)`
					);
					await db.query(`INSERT INTO "${failed.E2E_SCHEMA}".taxonomy VALUES (2)`);
					await db.query(`INSERT INTO "${failed.E2E_SCHEMA}".item VALUES (2)`);
					// No root ID was returned or registered before provisioning failed.
					throw new Error('Root import failed after taxonomy import');
				}),
				/Root import failed after taxonomy import/
			);
			assert.equal(
				(await db.query('SELECT to_regnamespace($1) AS name', [failed.E2E_SCHEMA])).rows[0].name,
				null
			);
			assert.deepEqual((await db.query(`SELECT id FROM "${other.E2E_SCHEMA}".taxonomy`)).rows, [
				{ id: 1 }
			]);
			await assert.rejects(
				withTestSchema(other, async () => assert.fail('Must not adopt an existing namespace')),
				/already exists/
			);
			assert.deepEqual((await db.query(`SELECT id FROM "${other.E2E_SCHEMA}".taxonomy`)).rows, [
				{ id: 1 }
			]);
		});
	} finally {
		await db.end();
	}
});
