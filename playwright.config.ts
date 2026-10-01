import { defineConfig, devices } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { defineBddConfig } from 'playwright-bdd';
import { assertTestSchema } from './e2e/support/database';
import { loadTestEnvironment } from './e2e/support/environment';

const { baseURL, env } = loadTestEnvironment();
env.E2E_SCHEMA = process.env.E2E_SCHEMA ?? `e2e_${randomUUID().replaceAll('-', '')}`;
env.PGOPTIONS = `-c search_path=${env.E2E_SCHEMA}`;
assertTestSchema(env);
Object.assign(process.env, env);
const externalMedia = process.env.E2E_EXTERNAL_MEDIA === '1';
const testDir = defineBddConfig({
	features: 'e2e/features/**/*.feature',
	steps: ['e2e/steps/**/*.ts']
});

export default defineConfig({
	testDir,
	snapshotPathTemplate: 'e2e/snapshots/{projectName}/{platform}/{arg}{ext}',
	outputDir: externalMedia ? 'test-results/media' : 'test-results/core',
	fullyParallel: true,
	workers: externalMedia ? 1 : 2,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	timeout: externalMedia ? 240_000 : 120_000,
	expect: { timeout: 15_000 },
	grep: externalMedia ? /@external-media/ : undefined,
	grepInvert: externalMedia ? undefined : /@external-media/,
	webServer: {
		command: 'node --experimental-strip-types e2e/support/server.ts',
		url: `${baseURL}/auth`,
		env,
		reuseExistingServer: false,
		gracefulShutdown: { signal: 'SIGTERM', timeout: 15_000 },
		timeout: 120_000
	},
	use: {
		baseURL,
		locale: 'en-US',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	reporter: [
		['list'],
		[
			'html',
			{
				open: 'never',
				outputFolder: externalMedia ? 'playwright-report/media' : 'playwright-report/core'
			}
		]
	]
});
