import { expect } from '@playwright/test';
import type { DataTable } from 'playwright-bdd';
import { Given, When, Then } from './fixtures.test';
import {
	answer,
	activePart,
	assertCompletion,
	collectionNames,
	completeExpedition,
	createDemo,
	demoStory,
	dismissPolicy,
	junction,
	localUntil,
	patchDemo,
	prepareReader,
	rescued,
	storyCard,
	storyState
} from '../support/stories';

const taxonomyDraftResponseKey = 'taxonomy draft response';
const taxonomyDraftExpectedItemKey = 'taxonomy draft expected item';

Given('an editor is authenticated for story authoring', async ({ world }) => {
	const editor = await world.actor('Editor Alpha');
	expect(editor.roles).toContain('editor');
});

Given('an editor has created a fresh {string} demo', async ({ world }, name: string) => {
	await createDemo(world, name);
});

Given('I am an anonymous reader using English', async ({ page, world }) => {
	await prepareReader(page, world);
});

Given('I open the standalone {string} story', async ({ page, world }, name: string) => {
	const response = await page.goto(`/s/${demoStory(world, name).slug}`);
	expect(response?.status()).toBe(200);
	await expect(page).toHaveTitle(name);
	await dismissPolicy(page);
	if (!storyState(world).localTime || name === 'World Food Expedition') {
		await activePart(page)
			.getByRole('button', { name: 'Play', exact: true })
			.click({ timeout: 90_000 });
	}
});

When('I choose the ridge and rewind to the junction', async ({ page, world }) => {
	await answer(page, world, 'Try the ridge. We need a stronger signal.');
	await answer(page, world, "Rewind to the junction. Let's choose differently.");
	await junction(page);
});

When(
	'I guide Rowan to rescue using the service road, emergency call, and whistle',
	async ({ page, world }) => {
		await rescued(page, world);
	}
);

Then('the story confirms Rowan was rescued', async ({ page }) => {
	await expect(page.getByText(/They found the pump house\. Found me\./)).toBeVisible();
});

When(
	'the editor requests a taxonomy draft with three rounds from one item and one attribute',
	async ({ request, world }) => {
		const demo = storyState(world).demos[0];
		const draft = await world.db.query<{
			draft_id: string;
			attribute_id: string;
			item_id: string;
		}>(
			`SELECT d.id AS draft_id, a.id AS attribute_id, i.id AS item_id
			 FROM part p
			 JOIN taxonomy_draft_for_part d ON d.id = p.taxonomy_draft_for_part_id
			 JOIN attribute a ON a.taxonomy_id = d.taxonomy_id
			 JOIN attribute_of_item v ON v.attribute_id = a.id
			 JOIN item i ON i.id = v.item_id
			 JOIN item_of_category ic ON ic.item_id = i.id
			 JOIN attribute_of_category ac ON ac.category_id = ic.category_id AND ac.attribute_id = a.id
			 WHERE p.story_id = ANY($1::uuid[])
			 AND a.type = 'number'
			 AND ac.is_default = false
			 AND v.value IS NOT NULL
			 AND EXISTS (
				 SELECT 1
				 FROM attribute_of_category default_attribute
				 JOIN attribute_of_item name_attribute
					 ON name_attribute.item_id = i.id
					 AND name_attribute.attribute_id = default_attribute.attribute_id
				 WHERE default_attribute.category_id = ic.category_id
				 AND default_attribute.is_default = true
				 AND coalesce(
					 name_attribute.value->>'en',
					 name_attribute.value->>'default',
					 name_attribute.value->>'en'
				 ) IS NOT NULL
			 )
			 ORDER BY d.id, a.slug, i.id
			 LIMIT 1`,
			[demo.stories.map((story) => story.id)]
		);
		expect(draft.rows).toHaveLength(1);
		const [row] = draft.rows;

		await world.db.query(
			`UPDATE taxonomy_draft_for_part
			 SET nr_of_rounds = 3, nr_of_items_per_round = 1, goal = 3
			 WHERE id = $1`,
			[row.draft_id]
		);
		await world.db.query('DELETE FROM drafted_attribute WHERE taxonomy_draft_for_part_id = $1', [
			row.draft_id
		]);
		await world.db.query('DELETE FROM drafted_category WHERE taxonomy_draft_for_part_id = $1', [
			row.draft_id
		]);
		await world.db.query('DELETE FROM drafted_item WHERE taxonomy_draft_for_part_id = $1', [
			row.draft_id
		]);
		await world.db.query(
			'INSERT INTO drafted_attribute (taxonomy_draft_for_part_id, attribute_id) VALUES ($1, $2)',
			[row.draft_id, row.attribute_id]
		);
		await world.db.query(
			'INSERT INTO drafted_item (taxonomy_draft_for_part_id, item_id) VALUES ($1, $2)',
			[row.draft_id, row.item_id]
		);

		const response = await request.get(`/s/${demo.root.slug}`, {
			headers: { Cookie: 'PARAGLIDE_LOCALE=en' }
		});
		expect(response.status()).toBe(200);
		world.entities.set(taxonomyDraftResponseKey, await response.text());
		world.entities.set(taxonomyDraftExpectedItemKey, row.item_id);
	}
);

Then('the taxonomy draft returns one unique item-attribute question', async ({ world }) => {
	const html = world.entities.get(taxonomyDraftResponseKey) as string;
	const itemId = world.entities.get(taxonomyDraftExpectedItemKey) as string;
	expect(html.match(new RegExp(itemId, 'g')) ?? []).toHaveLength(1);
});

Then(
	'the standalone player reports successful completion and offers a restart',
	async ({ page, world }) => {
		await assertCompletion(page, world, true);
	}
);

When('I choose the ridge and end the attempt without rewinding', async ({ page, world }) => {
	await answer(page, world, 'Try the ridge. We need a stronger signal.');
	await answer(page, world, 'End this attempt here.');
});

Then('the story confirms the connection closed without a rescue', async ({ page }) => {
	await expect(page.getByRole('heading', { name: 'Connection closed', exact: true })).toBeVisible();
	await expect(page.getByText(/No rescue is confirmed\./)).toBeVisible();
});

Then(
	'the standalone player reports unsuccessful completion and offers a restart',
	async ({ page, world }) => {
		await assertCompletion(page, world, false);
	}
);

When('I restart the story', async ({ page }) => {
	await page.getByRole('button', { name: 'Restart', exact: true }).click();
});

Then('I can make a fresh choice at the original junction', async ({ page }) => {
	await junction(page);
	await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
});

When('I confirm both readiness questions', async ({ page, world }) => {
	await expect(page.getByRole('heading', { name: 'Are you ready?', exact: true })).toBeVisible({
		timeout: 90_000
	});
	await answer(page, world, 'Yes');
	await expect(page.getByRole('heading', { name: 'Are you sure?', exact: true })).toBeVisible();
	await answer(page, world, 'Yes');
});

When('I incorrectly identify Barcelona as Amsterdam', async ({ page, world }) => {
	await answer(page, world, 'Amsterdam');
	await expect(page.getByText('Amsterdam', { exact: true })).not.toBeVisible();
});

Then('the video quiz lets me retry the Barcelona question', async ({ page }) => {
	await expect(page.getByText('Barcelona', { exact: true })).toBeVisible({ timeout: 90_000 });
	await expect(
		page.getByRole('heading', { name: 'Which city is this?', exact: true })
	).toBeVisible();
	await expect(page.getByRole('button', { name: 'Restart', exact: true })).toHaveCount(0);
});

When('I correctly identify Barcelona and Luzern', async ({ page, world }) => {
	await answer(page, world, 'Barcelona');
	await answer(page, world, 'Luzern');
});

When('I choose an unsafe pace after the first exercise', async ({ page, world }) => {
	await answer(page, world, 'As fast as possible, even if it hurts');
});

Then('the exercise replays and its question returns', async ({ page }) => {
	const question = activePart(page).getByRole('heading', {
		name: 'How should you choose your workout pace?',
		exact: true
	});
	await expect(question).toHaveCount(0);
	const progress = activePart(page).getByRole('slider', { name: 'Video progress', exact: true });
	await expect.poll(async () => Number(await progress.inputValue())).toBeLessThan(5);
	await expect(question).toBeVisible({ timeout: 90_000 });
});

When('I choose a comfortable pace and steady controlled movements', async ({ page, world }) => {
	await answer(page, world, 'A comfortable pace I can control');
	await answer(page, world, 'Steady, controlled movements');
});

When('I finish the stretching exercise', async ({ page }) => {
	await expect(page.getByRole('heading', { name: 'Finish gently', exact: true })).toBeVisible({
		timeout: 90_000
	});
	await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeVisible({
		timeout: 90_000
	});
});

When('I choose an incorrect location in the first country round', async ({ page, world }) => {
	const game = page.locator('[data-taxonomy-game]');
	await localUntil(page, game);
	await expect(game.getByLabel('Round 1 of 5', { exact: true })).toBeVisible();
	const target = await game.getByRole('heading', { level: 1 }).innerText();
	storyState(world).firstCountry = target;
	const wrong = game.locator('path[role="button"]');
	const names = await wrong.evaluateAll((paths) =>
		paths.map((path) => path.getAttribute('aria-label'))
	);
	const name = names.find((name) => name && name !== target);
	expect(name).toBeTruthy();
	const region = game.getByRole('button', { name: name!, exact: true }).first();
	await region.focus();
	await region.press('Enter');
});

Then('the expedition lets me correct the same round', async ({ page, world }) => {
	const game = page.locator('[data-taxonomy-game]');
	await expect(game.getByText('Not that part of the map.', { exact: true })).toBeVisible();
	await expect(game.getByLabel('1 mistakes', { exact: true })).toBeVisible();
	await expect(game.getByLabel('0 of 3 completed', { exact: true })).toBeVisible();
	await page.clock.runFor(3100);
	await expect(game.getByText('Not that part of the map.', { exact: true })).not.toBeVisible();
	await expect(game.getByLabel('Round 1 of 5', { exact: true })).toBeVisible();
	await expect(game.getByRole('heading', { level: 1 })).toHaveText(storyState(world).firstCountry!);
});

When(
	'I complete every round of these expedition stages:',
	async ({ page, world }, table: DataTable) => {
		await completeExpedition(
			page,
			world,
			table.hashes().map((row) => row.stage)
		);
	}
);

Given('I open the anthology grid', async ({ page, world }) => {
	const response = await page.goto(`/${storyState(world).demos[0].root.slug}`);
	expect(response?.status()).toBe(200);
	await dismissPolicy(page);
	await expect(
		page.getByRole('heading', { name: 'Discovery Collection', exact: true })
	).toBeVisible();
});

Then('the collection offers these stories in order:', async ({ page }, table: DataTable) => {
	const names = table.hashes().map((row) => row.story);
	await expect(page.locator('main a')).toHaveCount(names.length);
	for (let index = 0; index < names.length; index++) {
		await expect(page.locator('main a').nth(index)).toHaveAccessibleName(`Open ${names[index]}`);
	}
});

When('I open {string} from the grid', async ({ page }, name: string) => {
	await page.getByRole('link', { name: `Open ${name}`, exact: true }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
});

When('I open {string} from the grid again', async ({ page }, name: string) => {
	await page.getByRole('link', { name: `Open ${name}`, exact: true }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
});

Then(
	'I return to the collection with {string} marked completed',
	async ({ page }, name: string) => {
		await localUntil(page, storyCard(page, name).locator('.lucide-flag'));
		await expect(page.getByRole('dialog')).not.toBeVisible();
		await expect(storyCard(page, name).locator('.lucide-flag')).toBeVisible();
	}
);

When('I reload the collection', async ({ page }) => {
	await page.reload();
});

Then('{string} is still marked completed', async ({ page }, name: string) => {
	await expect(storyCard(page, name).locator('.lucide-flag')).toBeVisible();
});

Then('the other stories are not marked completed', async ({ page }) => {
	for (const name of ['Quiz of Cities', 'World Food Expedition']) {
		await expect(storyCard(page, name).locator('.lucide-flag')).toHaveCount(0);
		await expect(storyCard(page, name).locator('.lucide-arrow-up-right')).toBeVisible();
	}
});

When('I navigate back to the collection before finishing', async ({ page }) => {
	await junction(page);
	await page.getByRole('button', { name: 'Previous story', exact: true }).click();
});

Then('the collection is visible without any completed stories', async ({ page }) => {
	await expect(page.getByRole('dialog')).not.toBeVisible();
	await expect(
		page.getByRole('heading', { name: 'Discovery Collection', exact: true })
	).toBeVisible();
	for (const name of collectionNames) {
		await expect(storyCard(page, name).locator('.lucide-flag')).toHaveCount(0);
		await expect(storyCard(page, name).locator('.lucide-arrow-up-right')).toBeVisible();
	}
});

Given('the editor has configured the anthology as a feed', async ({ world }) => {
	await patchDemo(world, 'anthology', { visualization: 'FEED' });
});

When('I browse all three stories to the performance overview', async ({ page, world }) => {
	await page.goto(`/${storyState(world).demos[0].root.slug}`);
	await dismissPolicy(page);
	for (let index = 0; index < 3; index++) {
		await expect(page.locator(`[data-index="${index}"]`)).toBeInViewport({ ratio: 0.9 });
		await page.keyboard.press('ArrowDown');
		const destination = page.locator(`[data-index="${index + 1}"]`);
		// Native smooth scrolling uses real time; advancing JS timers can finish the
		// app's scroll timeout before the compositor reaches the requested story.
		await expect(destination).toBeInViewport({ ratio: 0.99 });
		await expect
			.poll(async () => Math.abs((await destination.boundingBox())?.y ?? Infinity))
			.toBeLessThan(1);
		if (index < 2) await expect(page.getByText(`${index + 2} / 3`, { exact: true })).toBeVisible();
	}
	await expect(page.getByText('3 / 3', { exact: true })).not.toBeVisible();
});

Then('the overview lists all three stories without successful completions', async ({ page }) => {
	const overview = page.locator('[data-index="3"]');
	await expect(overview.getByRole('listitem')).toHaveText(collectionNames);
	await expect(overview.locator('.lucide-circle-x')).toHaveCount(3);
	await expect(overview.locator('.lucide-circle-check')).toHaveCount(0);
});

When('I navigate back to {string}', async ({ page }, name: string) => {
	expect(name).toBe('Trail Decisions');
	for (const index of [2, 1]) {
		await page.keyboard.press('ArrowUp');
		const destination = page.locator(`[data-index="${index}"]`);
		await expect(destination).toBeInViewport({ ratio: 0.99 });
		await expect
			.poll(async () => Math.abs((await destination.boundingBox())?.y ?? Infinity))
			.toBeLessThan(1);
		await expect(page.getByText(`${index + 1} / 3`, { exact: true })).toBeVisible();
	}
});

When('the editor creates two copies of {string}', async ({ world }, name: string) => {
	await createDemo(world, name);
	await createDemo(world, name);
});

Then('both copies contain the expected three stories in order', async ({ world }) => {
	for (const demo of storyState(world).demos)
		expect(demo.stories.map((story) => story.name)).toEqual(collectionNames);
});

Then('each copy keeps the anthology description and thumbnail', async ({ world }) => {
	const rows = (
		await world.db.query<{ description: string | null; thumbnail: string | null }>(
			`SELECT description->>'en' AS description, thumbnail->'default'->>'filename' AS thumbnail
			 FROM anthology WHERE id = ANY($1::uuid[])`,
			[storyState(world).demos.map((demo) => demo.root.id)]
		)
	).rows;
	expect(rows).toHaveLength(storyState(world).demos.length);
	for (const row of rows) {
		expect(row.description).toContain('ordered anthology');
		expect(row.thumbnail).toBe('https://assets.evolyn.club/videos/play-pause.jpg');
	}
});

Then(
	'each copy resolves its taxonomy references to its own imported taxonomies',
	async ({ world }) => {
		for (const demo of storyState(world).demos) {
			expect(demo.taxonomies).toHaveLength(2);
			const rows = (
				await world.db.query<{
					draft_id: string;
					taxonomy_id: string;
					attribute_taxonomy_id: string | null;
				}>(
					`SELECT d.id AS draft_id, d.taxonomy_id, a.taxonomy_id AS attribute_taxonomy_id FROM part p
			 JOIN taxonomy_draft_for_part d ON d.id = p.taxonomy_draft_for_part_id
			 LEFT JOIN drafted_attribute da ON da.taxonomy_draft_for_part_id = d.id
			 LEFT JOIN attribute a ON a.id = da.attribute_id
			 WHERE p.story_id = ANY($1::uuid[])`,
					[demo.stories.map((story) => story.id)]
				)
			).rows;
			expect(new Set(rows.map((row) => row.draft_id)).size).toBe(5);
			for (const row of rows) {
				expect(demo.taxonomies.map((taxonomy) => taxonomy.id)).toContain(row.taxonomy_id);
				expect(row.attribute_taxonomy_id).toBe(row.taxonomy_id);
			}
			const references = (
				await world.db.query<{ source: string; target: string }>(
					`SELECT a.taxonomy_id AS source, i.taxonomy_id AS target
				 FROM attribute_of_item v JOIN attribute a ON a.id = v.attribute_id
				 JOIN item i ON i.id = v.referenced_item_id
				 WHERE a.taxonomy_id = ANY($1::uuid[])`,
					[demo.taxonomies.map((taxonomy) => taxonomy.id)]
				)
			).rows;
			expect(references.length).toBeGreaterThan(0);
			for (const reference of references) expect(reference.target).toBe(reference.source);
		}
	}
);

Then('the copies have different anthology, story, and taxonomy identities', async ({ world }) => {
	const [first, second] = storyState(world).demos;
	const ids = (demo: typeof first) => [
		demo.root.id,
		...demo.stories.map((story) => story.id),
		...demo.taxonomies.map((taxonomy) => taxonomy.id)
	];
	expect(ids(first).filter((id) => ids(second).includes(id))).toEqual([]);
	expect(first.root.slug).not.toBe(second.root.slug);
});

When('the editor unpublishes {string} in the first copy', async ({ world }, name: string) => {
	expect(name).toBe('Trail Decisions');
	await patchDemo(world, 'story', { isPublished: false });
});

Then('an anonymous reader cannot open that story or its anthology', async ({ request, world }) => {
	for (const path of [
		`/s/${demoStory(world, 'Trail Decisions').slug}`,
		`/${storyState(world).demos[0].root.slug}`
	]) {
		expect((await request.get(path)).status()).toBe(404);
	}
});

Then(
	'an anonymous reader can still open the second anthology and its {string} story',
	async ({ request, world }, name: string) => {
		for (const path of [
			`/s/${demoStory(world, name, 1).slug}`,
			`/${storyState(world).demos[1].root.slug}`
		]) {
			expect((await request.get(path)).status()).toBe(200);
		}
	}
);

When('the editor republishes {string} in the first copy', async ({ world }, name: string) => {
	expect(name).toBe('Trail Decisions');
	await patchDemo(world, 'story', { isPublished: true });
});

Then(
	'an anonymous reader can open the first anthology and its {string} story',
	async ({ request, world }, name: string) => {
		for (const path of [
			`/s/${demoStory(world, name).slug}`,
			`/${storyState(world).demos[0].root.slug}`
		]) {
			expect((await request.get(path)).status()).toBe(200);
		}
	}
);

When(
	/^the editor makes the (story|anthology) private$/,
	async ({ world }, resource: 'story' | 'anthology') => {
		await patchDemo(world, resource, { isPublic: false });
	}
);

Then(
	/^an anonymous reader receives not found for the (story|anthology) shared link$/,
	async ({ request, world }, resource: 'story' | 'anthology') => {
		const path =
			resource === 'story'
				? `/s/${demoStory(world, 'Trail Decisions').slug}`
				: `/${storyState(world).demos[0].root.slug}`;
		expect((await request.get(path)).status()).toBe(404);
	}
);
