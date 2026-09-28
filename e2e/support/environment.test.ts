import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertTestEnvironment } from './environment.ts';

const safe = {
	E2E_BASE_URL: 'http://localhost:4174',
	POSTGRES_HOST: '127.0.0.1',
	POSTGRES_DB: 'stories_e2e',
	POSTGRES_PORT: '55433',
	POSTGRES_MAX: '5',
	DEFAULT_CLIENT_DEFAULT_DOMAIN: 'localhost:4174'
};

test('accepts an isolated loopback test environment', () => {
	assert.equal(assertTestEnvironment(safe), safe.E2E_BASE_URL);
});

test('accepts IPv6 URL syntax with an unbracketed database hostname', () => {
	assert.equal(
		assertTestEnvironment({
			...safe,
			E2E_BASE_URL: 'http://[::1]:4174',
			DEFAULT_CLIENT_DEFAULT_DOMAIN: '[::1]:4174',
			POSTGRES_HOST: '::1'
		}),
		'http://[::1]:4174'
	);
});

for (const [name, changes] of Object.entries({
	'remote application': { E2E_BASE_URL: 'https://stories.example' },
	'remote database': { POSTGRES_HOST: 'db.example' },
	'bracketed database hostname': { POSTGRES_HOST: '[::1]' },
	'development database': { POSTGRES_DB: 'stories' },
	'lookalike test database': { POSTGRES_DB: 'contest' },
	'wrong tenant domain': { DEFAULT_CLIENT_DEFAULT_DOMAIN: 'localhost:5173' },
	'application path': { E2E_BASE_URL: 'http://localhost:4174/app' },
	'invalid database port': { POSTGRES_PORT: '0' },
	'invalid pool size': { POSTGRES_MAX: 'NaN' }
})) {
	test(`rejects ${name}`, () => {
		assert.throws(() => assertTestEnvironment({ ...safe, ...changes }));
	});
}
