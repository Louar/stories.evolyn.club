import dotenv from 'dotenv';
import path from 'node:path';

const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function assertTestEnvironment(env: Record<string, string | undefined>) {
	const url = new URL(env.E2E_BASE_URL ?? '');
	if (
		url.protocol !== 'http:' ||
		!loopbackHosts.has(url.hostname) ||
		url.pathname !== '/' ||
		url.search ||
		url.hash ||
		url.username ||
		url.password
	) {
		throw new Error('E2E_BASE_URL must be a plain loopback HTTP origin.');
	}
	if (
		!['localhost', '127.0.0.1', '::1'].includes(env.POSTGRES_HOST ?? '') ||
		!/(?:^|_)(?:test|e2e)(?:_|$)/i.test(env.POSTGRES_DB ?? '')
	) {
		throw new Error(
			'E2E requires a loopback PostgreSQL host and an explicitly test/e2e-named database.'
		);
	}
	if (env.DEFAULT_CLIENT_DEFAULT_DOMAIN !== url.host) {
		throw new Error('DEFAULT_CLIENT_DEFAULT_DOMAIN must match the E2E URL host and port.');
	}
	for (const key of ['POSTGRES_PORT', 'POSTGRES_MAX']) {
		const value = Number(env[key]);
		if (!Number.isInteger(value) || value < 1 || (key === 'POSTGRES_PORT' && value > 65535)) {
			throw new Error(`Invalid E2E ${key}.`);
		}
	}
	return url.origin;
}

export function loadTestEnvironment() {
	// Do not fall back to development credentials, even when the shell has them set.
	const result = dotenv.config({ path: path.resolve('.env.test'), processEnv: {}, quiet: true });
	if (result.error || !result.parsed)
		throw new Error('A complete local .env.test is required.', { cause: result.error });
	const env = result.parsed;
	for (const key of [
		'E2E_BASE_URL',
		'POSTGRES_HOST',
		'POSTGRES_PORT',
		'POSTGRES_DB',
		'POSTGRES_USER',
		'POSTGRES_PASSWORD',
		'POSTGRES_MAX',
		'DEFAULT_USER_EMAIL',
		'DEFAULT_USER_PASSWORD',
		'DEFAULT_USER_FIRST_NAME',
		'DEFAULT_USER_LAST_NAME',
		'DEFAULT_CLIENT_SLUG',
		'DEFAULT_CLIENT_NAME',
		'DEFAULT_CLIENT_DEFAULT_DOMAIN',
		'DEFAULT_CLIENT_ACCESS_TOKEN_KEY',
		'ASSETS_DIR'
	]) {
		if (!env[key]) throw new Error(`Missing ${key} in .env.test.`);
	}
	for (const key of [
		'DEFAULT_CLIENT_ADMINISTRATION_EMAIL',
		'DEFAULT_CLIENT_PLAUSIBLE_DOMAIN',
		'DEFAULT_CADDY_API_BASE_URL',
		'DEFAULT_RESEND_API_KEY',
		'DEFAULT_OPENAI_API_KEY'
	]) {
		env[key] ??= '';
	}
	const baseURL = assertTestEnvironment(env);
	Object.assign(process.env, env);
	return { baseURL, env };
}
