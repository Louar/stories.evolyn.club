import { test as base, createBdd } from 'playwright-bdd';
import { ScenarioWorld } from '../support/world';

export const test = base.extend<{ world: ScenarioWorld }>({
	world: async ({ playwright, baseURL }, use, testInfo) => {
		if (!baseURL) throw new Error('The BDD World requires a Playwright baseURL');
		const world = new ScenarioWorld(playwright.request, baseURL, testInfo);
		try {
			await use(world);
		} finally {
			await world.dispose();
		}
	}
});

export const { Given, When, Then, Before, After } = createBdd(test);
