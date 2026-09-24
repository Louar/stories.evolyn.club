import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { defineBddConfig } from 'playwright-bdd';

dotenv.config({ path: path.resolve('.env') });

const testDir = defineBddConfig({
	features: 'e2e/features/**/*.feature',
	steps: ['e2e/steps/**/*.ts'],
});

const port = 4173;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
	webServer: {
		// command: 'npm run build && npm run preview',
		command: 'npm run preview',
		port,
		reuseExistingServer: true,
	},
	use: {
		baseURL,
	},
	testDir,
	projects: [
		/* Test against desktop browsers */
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
		// /* Test against mobile viewports. */
		// {
		// 	name: 'Mobile Chrome',
		// 	use: { ...devices['Pixel 5'] },
		// },
		/* Test against branded browsers. */
		// {
		// 	name: 'Google Chrome',
		// 	use: { ...devices['Desktop Chrome'], channel: 'chrome' }, // or 'chrome-beta'
		// },
	],
	reporter: [['list', { printFailuresInline: true }]],
});
