import { expect } from '@playwright/test';
import { Then, When } from './fixtures.test';

const walk = {
	template: 'walk',
	properties: [
		{
			template: 'description',
			obj: { value: 'Playwright test walk' }
		},
		{
			template: 'duration',
			obj: { value: 30, unit: 'minutes' }
		},
		{
			template: 'steps',
			obj: { value: 4200 }
		},
	]
};

When('Participant Pascal submits a new walk activity with valid details', async ({ request }) => {
	const response = await request.post('/api/me/activities', {
		data: walk,
	});
	expect(response.ok()).toBeTruthy();
});

Then('Participant Pascal sees the created walk activity in the activities list', async ({ request }) => {
	const response = await request.get('/api/me/activities?limit=1');
	expect(response.ok()).toBeTruthy();
	const activities = await response.json();
	expect(activities).toContainEqual(
		expect.objectContaining({
			properties: expect.arrayContaining([
				expect.objectContaining({
					template: expect.objectContaining({
						slug: 'description',
					}),
					value: expect.objectContaining({
						value: 'Playwright test walk',
					}),
				}),
				expect.objectContaining({
					template: expect.objectContaining({
						slug: 'duration',
					}),
					value: expect.objectContaining({
						value: 30,
						unit: 'minutes',
					}),
				}),
				expect.objectContaining({
					template: expect.objectContaining({
						slug: 'steps',
					}),
					value: expect.objectContaining({
						value: 4200,
					}),
				}),
			]),
		})
	);
});



const run = {
	title: `Playwright run ${Date.now()}`,
	durationValue: '20',
	durationUnit: 'minutes',
	stepsValue: '4200'
};

When('Participant Pascal opens the overview of activities page', async ({ page }) => {
	await page.goto('/activities');
	await page.waitForLoadState('networkidle');
	await expect(page).toHaveURL(/\/activities$/);
	await expect(page.getByRole('heading', { name: 'My activities' })).toBeVisible();
});

When('Participant Pascal start creating a new run activity', async ({ page }) => {
	await page.getByRole('link', { name: /create/i }).click();
	await page.waitForLoadState('networkidle');
	await expect(page).toHaveURL(/\/activities\/create\/run$/);
	await expect(page.getByRole('heading', { name: 'Create activity' })).toBeVisible();
});

When('Participant Pascal submits a new run activity with valid details', async ({ page }) => {
	const durationGroup = page.getByRole('group').filter({ hasText: /duur|duration/i });
	const stepsGroup = page.getByRole('group').filter({ hasText: /stappen|steps/i });
	const descriptionGroup = page.getByRole('group').filter({ hasText: /omschrijving|description/i });

	await durationGroup.getByRole('combobox', { name: 'unit' }).selectOption(run.durationUnit);
	await durationGroup.getByRole('spinbutton', { name: 'value' }).fill(run.durationValue);
	await stepsGroup.getByRole('spinbutton', { name: 'value' }).fill(run.stepsValue);
	await page.getByLabel('title').fill(run.title);
	await descriptionGroup.getByRole('textbox', { name: 'value' }).fill(run.title);

	await page.getByRole('button', { name: 'Submit' }).click();
});

Then('Participant Pascal is redirected back to the overview of activities page', async ({ page }) => {
	await page.waitForURL(/\/activities$/);
	await page.waitForLoadState('networkidle');
	await expect(page).toHaveURL(/\/activities$/);
	await expect(page.getByRole('heading', { name: 'My activities' })).toBeVisible();
});

Then('Participant Pascal sees the created run activity in the activities list', async ({ page }) => {
	const createdCard = page
		.getByTestId('activity-card')
		.filter({ has: page.getByText(run.title, { exact: true }) })
		.last();

	await expect(createdCard.getByRole('heading', { name: /hardlopen|run/i })).toBeVisible();
	await expect(createdCard.getByText(/20\s*minutes/i)).toHaveCount(2);
	await expect(createdCard.getByText(/4200/i)).toBeVisible();
});
