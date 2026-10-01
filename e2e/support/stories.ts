import { expect, type Locator, type Page } from '@playwright/test';
import type { ScenarioWorld } from './world';

export const collectionNames = ['Quiz of Cities', 'Trail Decisions', 'World Food Expedition'];
const demoSlugs: Record<string, string> = {
	'Discovery Collection': 'discovery-collection',
	'Trail Decisions': 'trail-decisions',
	'Quiz of Cities': 'quiz-of-cities',
	'Home Workout': 'home-workout',
	'World Food Expedition': 'world-food-expedition'
};
export type DemoRecord = { id: string; slug: string; name: string };
export type Demo = {
	root: DemoRecord;
	kind: 'stories' | 'anthologies';
	stories: DemoRecord[];
	taxonomies: DemoRecord[];
};
type StoryState = { demos: Demo[]; localTime: boolean; firstCountry?: string };
const states = new WeakMap<ScenarioWorld, StoryState>();
export function storyState(world: ScenarioWorld) {
	let state = states.get(world);
	if (!state) {
		state = { demos: [], localTime: false };
		states.set(world, state);
	}
	return state;
}

export async function createDemo(world: ScenarioWorld, name: string) {
	const slug = demoSlugs[name];
	expect(slug, `Known demo: ${name}`).toBeTruthy();
	const kind: Demo['kind'] = name === 'Discovery Collection' ? 'anthologies' : 'stories';
	const editor = await world.actor('Editor Alpha');
	const response = await editor.request.post(`/api/demos/${kind}/${slug}`);
	expect(response.ok(), await response.text()).toBeTruthy();
	const root = { ...(await response.json()), name } as DemoRecord;
	world.register(kind === 'stories' ? 'story' : 'anthology', root.id);
	expect(root.slug).toMatch(new RegExp(`^${slug}-[\\da-f]{8}(?:-[\\da-f]{4}){3}-[\\da-f]{12}$`));
	const suffix = root.slug.slice(slug.length);
	const taxonomies = (
		await world.db.query<DemoRecord>(
			`SELECT id, slug, name->>'en' AS name FROM taxonomy WHERE client_id = $1 AND right(slug, length($2)) = $2`,
			[world.clientId, suffix]
		)
	).rows;
	for (const taxonomy of taxonomies) world.register('taxonomy', taxonomy.id);
	const stories =
		kind === 'stories'
			? [root]
			: (
					await world.db.query<DemoRecord>(
						`SELECT s.id, s.slug, s.name->>'en' AS name FROM anthology_position ap
		 JOIN story s ON s.id = ap.story_id WHERE ap.anthology_id = $1 ORDER BY ap."order"`,
						[root.id]
					)
				).rows;
	for (const story of stories) world.register('story', story.id);
	const demo = { root, kind, stories, taxonomies };
	storyState(world).demos.push(demo);
	return demo;
}

export function demoStory(world: ScenarioWorld, name: string, copy = 0) {
	const story = storyState(world).demos[copy].stories.find((story) => story.name === name);
	expect(story, `${name} exists in demo copy ${copy + 1}`).toBeDefined();
	return story!;
}

export async function patchDemo(
	world: ScenarioWorld,
	resource: 'story' | 'anthology',
	data: Record<string, unknown>
) {
	const demo = storyState(world).demos[0];
	const id = resource === 'story' ? demoStory(world, 'Trail Decisions').id : demo.root.id;
	const editor = await world.actor('Editor Alpha');
	const response = await editor.request.patch(
		`/api/${resource === 'story' ? 'stories' : 'anthologies'}/${id}`,
		{ data }
	);
	expect(response.ok(), await response.text()).toBeTruthy();
}

export async function prepareReader(page: Page, world: ScenarioWorld) {
	await page.context().clearCookies();
	await page.context().addCookies([{ name: 'PARAGLIDE_LOCALE', value: 'en', url: world.baseURL }]);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.addInitScript(() => {
		const messages: { isCompleted: boolean; events: string }[] = [];
		Object.assign(window, { storyCompletionMessages: messages });
		window.addEventListener('message', (event) => {
			if (event.source === window && typeof event.data?.isCompleted === 'boolean')
				messages.push(event.data);
		});
	});
	const name = storyState(world).demos[0].root.name;
	if (name !== 'Home Workout' && name !== 'Quiz of Cities') {
		await page.clock.install();
		storyState(world).localTime = true;
	}
}

export async function dismissPolicy(page: Page) {
	// Anonymous policy controls appear after afterNavigate, so they also establish hydration.
	const policy = page.getByRole('region', { name: 'Policy and terms of service', exact: true });
	await expect(policy).toBeVisible();
	await policy.getByRole('button', { name: 'Not now', exact: true }).click();
	await expect(policy).not.toBeVisible();
}

export function activePart(page: Page) {
	// Story keeps every preloaded media player mounted; opacity is not Playwright visibility.
	return page.locator('div.absolute.inset-0.z-10.opacity-100');
}

// Advance only local player time, never synthesize media events or modify application state.
export async function localUntil(page: Page, target: Locator, maxSeconds = 45) {
	for (let elapsed = 0; elapsed < maxSeconds * 2; elapsed++) {
		if ((await target.count()) === 1 && (await target.isVisible())) return;
		for (const play of await activePart(page)
			.getByRole('button', { name: 'Play', exact: true })
			.all()) {
			const box = await play.boundingBox();
			const viewport = page.viewportSize();
			if (
				box &&
				viewport &&
				box.y >= 0 &&
				box.y < viewport.height &&
				box.x >= 0 &&
				box.x < viewport.width
			) {
				await play.click();
				break;
			}
		}
		await page.clock.runFor(500);
	}
	await expect(target).toBeVisible();
}

export async function answer(page: Page, world: ScenarioWorld, label: string) {
	const choice = activePart(page).locator('label').filter({ hasText: label });
	if (storyState(world).localTime) await localUntil(page, choice);
	await expect(choice).toHaveCount(1, { timeout: 90_000 });
	await expect(choice).toBeVisible({ timeout: 90_000 });
	await choice.click();
}

export async function junction(page: Page) {
	const choice = page.getByText('Take the marked service road. Give that ankle a chance.', {
		exact: true
	});
	await localUntil(page, choice);
	await expect(choice).toBeVisible();
	await expect(
		page.getByText('Try the ridge. We need a stronger signal.', { exact: true })
	).toBeVisible();
}

export async function rescued(page: Page, world: ScenarioWorld) {
	await answer(page, world, 'Take the marked service road. Give that ankle a chance.');
	await answer(page, world, 'Call emergency services. Tell them P-17 and stay there.');
	await answer(page, world, 'Stay at P-17. Use the whistle to bring them to you.');
	await localUntil(page, page.getByText(/They found the pump house\. Found me\./));
}

export async function assertCompletion(page: Page, world: ScenarioWorld, completed: boolean) {
	const restart = page.getByRole('button', { name: 'Restart', exact: true });
	if (storyState(world).localTime) await localUntil(page, restart);
	await expect(restart).toBeVisible({ timeout: 90_000 });
	await expect
		.poll(() =>
			page.evaluate(() => {
				const messages = (
					window as unknown as { storyCompletionMessages: { isCompleted: boolean }[] }
				).storyCompletionMessages;
				return messages.at(-1)?.isCompleted;
			})
		)
		.toBe(completed);
}

export function storyCard(page: Page, name: string) {
	return page.getByRole('link', { name: `Open ${name}`, exact: true }).locator('..');
}

type TaxonomyAnswer = {
	id: string;
	referencedId: string | null;
	taxonomy: string;
	slug: string;
	question: string | null;
	attribute: string;
	item: string;
	value: unknown;
	referenced: string | null;
};
export async function taxonomyAnswers(world: ScenarioWorld) {
	const ids = storyState(world).demos[0].taxonomies.map((taxonomy) => taxonomy.id);
	return (
		await world.db.query<TaxonomyAnswer>(
			`SELECT v.item_id AS id, v.referenced_item_id AS "referencedId", a.taxonomy_id AS taxonomy, a.slug, a.question->>'en' AS question, a.name->>'en' AS attribute,
		 n.value->>'en' AS item, v.value, rn.value->>'en' AS referenced
		 FROM attribute_of_item v JOIN attribute a ON a.id = v.attribute_id
		 JOIN attribute na ON na.taxonomy_id = a.taxonomy_id AND na.slug = 'name'
		 JOIN attribute_of_item n ON n.item_id = v.item_id AND n.attribute_id = na.id
		 LEFT JOIN item ri ON ri.id = v.referenced_item_id
		 LEFT JOIN attribute rna ON rna.taxonomy_id = ri.taxonomy_id AND rna.slug = 'name'
		 LEFT JOIN attribute_of_item rn ON rn.item_id = ri.id AND rn.attribute_id = rna.id
		 WHERE a.taxonomy_id = ANY($1::uuid[])`,
			[ids]
		)
	).rows;
}

export const plainItemName = (name: string) =>
	name.replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D]/gu, '').trim();

export async function completeExpedition(page: Page, world: ScenarioWorld, stages: string[]) {
	expect(stages).toEqual([
		'Locate countries',
		'Compare populations',
		'Trace food origins',
		'Compare nutrition',
		'Classify food groups'
	]);
	const answers = await taxonomyAnswers(world);
	const slugs = [
		['name'],
		['population'],
		['countryOfOrigin'],
		['calories', 'protein', 'fiber', 'averagePrice'],
		['wheelOfFive']
	];
	const game = page.locator('[data-taxonomy-game]');
	for (let stage = 0; stage < stages.length; stage++) {
		const taxonomy = storyState(world).demos[0].taxonomies.find((entry) =>
			entry.slug.startsWith(stage < 3 ? 'countries-and-foods-' : 'foods-and-wheel-of-five-')
		);
		expect(taxonomy).toBeDefined();
		const stageAnswers = answers.filter((answer) => answer.taxonomy === taxonomy!.id);
		for (let round = 1; round <= 5; round++) {
			await expect(game.getByLabel(`Round ${round} of 5`, { exact: true })).toBeVisible();
			const heading = await game.getByRole('heading', { level: 1 }).innerText();
			if (stage === 1 || stage === 3) {
				const candidates = stageAnswers.filter(
					(a) =>
						slugs[stage].includes(a.slug) && (a.question ?? `Sort by ${a.attribute}`) === heading
				);
				expect(candidates.length, `Imported numeric attribute for ${heading}`).toBeGreaterThan(0);
				const options = game.locator('[role="option"][data-is-ghost="false"]');
				await expect(options).toHaveCount(4);
				const names = await options.locator('[data-slot="item-title"]').allTextContents();
				expect(names).toHaveLength(4);
				const ordered = names
					.map((name) => {
						const value = candidates.find(
							(candidate) => candidate.item === plainItemName(name)
						)?.value;
						expect(typeof value, `Imported value for ${name}`).toBe('number');
						return { name, value: Number(value) };
					})
					.sort((a, b) => a.value - b.value);
				for (let index = 0; index < ordered.length; index++) {
					const current = await options.locator('[data-slot="item-title"]').allTextContents();
					const from = current.indexOf(ordered[index].name);
					if (from === index) continue;
					await options.nth(from).focus();
					await page.keyboard.press('Space');
					for (let step = from; step > index; step--) await page.keyboard.press('ArrowUp');
					await page.keyboard.press('Space');
					await expect(options.locator('[data-slot="item-title"]').nth(index)).toHaveText(
						ordered[index].name
					);
				}
				await game.getByRole('button', { name: 'Submit order', exact: true }).click();
				await expect(game.getByText('Perfect order!', { exact: true })).toBeVisible();
			} else {
				const candidate = stageAnswers.find(
					(a) => slugs[stage].includes(a.slug) && a.item === plainItemName(heading)
				);
				expect(candidate, `Imported map answer for ${stages[stage]}: ${heading}`).toBeDefined();
				const region = game
					.locator(
						`[role="button"][data-map-item-id="${candidate!.referencedId ?? candidate!.id}"]`
					)
					.first();
				await region.focus();
				await region.press('Enter');
				await expect(game.getByText('Correct location!', { exact: true })).toBeVisible();
			}
			await expect(game.getByLabel(`${round} of 3 completed`, { exact: true })).toBeVisible();
			await game
				.getByRole('button', { name: round === 5 ? 'Show results' : 'Next round', exact: true })
				.click();
		}
	}
	await expect(
		page.getByRole('heading', { name: 'Expedition complete', exact: true })
	).toBeVisible();
}
