import { Pool } from 'pg';
import { assertTestEnvironment } from './environment.ts';

export function assertTestSchema(env: Record<string, string | undefined>) {
	const schema = env.E2E_SCHEMA;
	if (!schema || !/^e2e_[a-f0-9]{32}$/.test(schema)) {
		throw new Error('E2E_SCHEMA must be a unique, run-owned e2e UUID namespace.');
	}
	if (env.PGOPTIONS !== `-c search_path=${schema}`) {
		throw new Error('The test server and fixtures must use the same isolated search_path.');
	}
	return schema;
}

export async function withTestSchema<T>(
	env: Record<string, string | undefined>,
	run: () => Promise<T>
): Promise<T> {
	assertTestEnvironment(env);
	const schema = assertTestSchema(env);
	const db = new Pool({
		host: env.POSTGRES_HOST,
		port: Number(env.POSTGRES_PORT),
		database: env.POSTGRES_DB,
		user: env.POSTGRES_USER,
		password: env.POSTGRES_PASSWORD,
		max: 1,
		connectionTimeoutMillis: 10_000,
		statement_timeout: 10_000
	});
	let created = false;
	try {
		// Never adopt or drop a namespace that existed before this server started.
		await db.query(`CREATE SCHEMA "${schema}"`);
		created = true;
		return await run();
	} finally {
		try {
			if (created) await db.query(`DROP SCHEMA "${schema}" CASCADE`);
		} finally {
			await db.end();
		}
	}
}
