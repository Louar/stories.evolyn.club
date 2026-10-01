import { readFile } from 'node:fs/promises';
import { expect, type Page, type TestInfo } from '@playwright/test';
import type { DataTable } from 'playwright-bdd';
import YAML from 'yaml';
import { feature } from 'topojson-client';
import { booleanPointInPolygon, kinks, point } from '@turf/turf';
import type { Polygon, FeatureCollection } from 'geojson';
import { Given, When, Then } from './fixtures.test';
import { activePart, localUntil, plainItemName, storyState } from '../support/stories';
import type { ScenarioWorld } from '../support/world';

type MapCategory = {
	id: string;
	map: { source: { filename: string }; scene: string; showLabels: boolean } | null;
};
type ImportedTaxonomy = {
	categories: MapCategory[];
	attributes: { id: string; slug: string }[];
	attributeOfItems: {
		itemId: string;
		attributeId: string;
		value: unknown;
		referencedItemId: string | null;
	}[];
};
type FoodState = {
	taxonomy: ImportedTaxonomy;
	viewport: string;
	scene: string;
	errors: string[];
	pointerAnswers: number;
	keyboardAnswers: number;
	disclaimerSeen: boolean;
};
const state = (world: ScenarioWorld) => world.entities.get('food maps') as FoodState;
const game = (page: Page) => activePart(page).locator('[data-taxonomy-game]');
const map = (page: Page) => game(page).locator('svg[aria-label="Item map"]');

Given(
	'an editor has imported and published a fresh {string} source bundle with its taxonomy',
	async ({ page, world }, slug: string) => {
		expect(['farm-to-table-pin-game', 'meat-cuts-and-animals']).toContain(slug);
		const taxonomySlug = slug === 'farm-to-table-pin-game' ? 'farm-to-table-origins' : slug;
		const source = async (file: string) =>
			YAML.parse(await readFile(new URL(`../../imported/${file}.yaml`, import.meta.url), 'utf8'));
		const taxonomy = await source(`${taxonomySlug}.taxonomy`);
		const story = await source(`${slug}.story`);
		const editor = await world.actor('Editor Alpha');
		taxonomy.slug += `-${world.namespace}`;
		const imported = await editor.request.post('/api/taxonomies/io', { data: taxonomy });
		expect(imported.ok(), await imported.text()).toBeTruthy();
		const taxonomyRecord = await imported.json();
		world.register('taxonomy', taxonomyRecord.id);
		story.slug += `-${world.namespace}`;
		story.isPublished = true;
		story.isPublic = true;
		for (const part of story.parts)
			if (part.taxonomyDraftForPart) part.taxonomyDraftForPart.taxonomySlug = taxonomyRecord.slug;
		const response = await editor.request.post('/api/stories/io', { data: story });
		expect(response.ok(), await response.text()).toBeTruthy();
		const record = { ...(await response.json()), name: story.name.en };
		world.register('story', record.id);
		storyState(world).demos.push({
			root: record,
			stories: [record],
			kind: 'stories',
			taxonomies: [{ ...taxonomyRecord, name: taxonomy.name.en }]
		});
		const exported = await editor.request.get(`/api/taxonomies/${taxonomyRecord.id}/io`);
		expect(exported.ok()).toBeTruthy();
		const data: FoodState = {
			taxonomy: YAML.parse(await exported.text()),
			viewport: 'desktop',
			scene: '',
			errors: [],
			pointerAnswers: 0,
			keyboardAnswers: 0,
			disclaimerSeen: false
		};
		world.entities.set('food maps', data);
		page.on('pageerror', (error) => data.errors.push(error.message));
		page.on('console', (message) => {
			if (message.type() === 'error') data.errors.push(message.text());
		});
	}
);

Given('I use the food map on a {string} screen', async ({ page, world }, viewport: string) => {
	expect(['desktop', 'mobile']).toContain(viewport);
	state(world).viewport = viewport;
	await page.setViewportSize(
		viewport === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 1000 }
	);
});

When('I reach the farm-origin game', async ({ page, world }) => {
	state(world).scene = 'farm-origins';
	await localUntil(page, game(page).getByLabel('Round 1 of 12', { exact: true }), 75);
});
When('I reach the animal-identification game', async ({ page, world }) => {
	state(world).scene = 'animals';
	await localUntil(page, game(page).getByLabel('Round 1 of 10', { exact: true }), 75);
});

async function inspectScene(
	page: Page,
	world: ScenarioWorld,
	testInfo: TestInfo,
	expected: number
) {
	const current = state(world);
	const category = current.taxonomy.categories.find((c) => c.map?.scene === current.scene)!;
	expect(category).toBeDefined();
	const response = await page.request.get(category.map!.source.filename);
	expect(response.ok()).toBeTruthy();
	const asset = await response.json();
	const scene = asset.scenes[current.scene];
	const decoded = feature(
		scene.topology,
		scene.topology.objects.regions
	) as unknown as FeatureCollection<Polygon>;
	expect(decoded.features).toHaveLength(expected);
	const refs = current.taxonomy.attributeOfItems.filter(
		(v) => typeof v.value === 'object' && v.value !== null && 'ref' in v.value
	);
	const sceneRefs = new Set(decoded.features.map((f) => f.id));
	const items = refs.filter((v) => sceneRefs.has((v.value as { ref: string }).ref));
	expect(items).toHaveLength(expected);
	const paths = map(page).locator('path[data-map-item-id]:not(.helper)');
	await expect(paths).toHaveCount(expected);
	expect(
		new Set(
			await paths.evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-map-item-id')))
		)
	).toEqual(new Set(items.map((v) => v.itemId)));
	for (const region of decoded.features) {
		expect(kinks(region).features, `Non-self-intersecting ${region.id}`).toHaveLength(0);
		const item = items.find((v) => (v.value as { ref: string }).ref === region.id)!;
		const centerId = current.taxonomy.attributes.find((a) => a.slug === 'center')!.id;
		const center = current.taxonomy.attributeOfItems.find(
			(v) => v.itemId === item.itemId && v.attributeId === centerId
		)!.value as number[];
		if (current.scene === 'cuts')
			expect(
				booleanPointInPolygon(point(center), region),
				`Interior center ${region.id}`
			).toBeTruthy();
		await expect(
			map(page).locator(`path[data-map-item-id="${item.itemId}"]`).first()
		).toHaveAttribute('aria-disabled', 'false');
		if (current.scene === 'cuts') {
			const target = map(page).locator(`path[data-map-item-id="${item.itemId}"]:not(.helper)`);
			await target.focus();
			await expect(target).toBeFocused();
		}
	}
	world.entities.set('food map anchor', {
		coordinate: decoded.features[0].geometry.coordinates[0][0],
		itemId: items.find((v) => (v.value as { ref: string }).ref === decoded.features[0].id)!.itemId
	});
	await expect(map(page).locator('image')).toHaveCount(2);
	for (const layer of ['underlay', 'overlay']) {
		const filename = scene.artwork[layer].filename;
		const artwork = await page.request.get(filename);
		expect(artwork.ok()).toBeTruthy();
		const svg = await artwork.text();
		expect(svg).toContain(`viewBox="${scene.viewBox.join(' ')}"`);
		expect(svg).not.toMatch(/<text\b/);
		if (layer === 'overlay')
			expect((svg.match(/<(?:path|ellipse)\b/g) ?? []).length).toBeGreaterThan(expected);
		if (layer === 'overlay' && current.scene === 'cuts') {
			const centers = decoded.features.map((f) => ({
				animal: String(f.id).split('.')[0],
				center: f.properties!.center as number[]
			}));
			expect(
				await page.evaluate(
					({ svg, centers }) => {
						const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
						const canvas = window.document.createElement('canvas').getContext('2d')!;
						return centers.every(({ animal, center }) =>
							canvas.isPointInPath(
								new Path2D(
									document.querySelector(`[data-silhouette="${animal}"]`)!.getAttribute('d')!
								),
								center[0],
								center[1]
							)
						);
					},
					{ svg, centers }
				)
			).toBeTruthy();
		}
		expect(
			await page.evaluate(
				(url) =>
					new Promise<boolean>((resolve) => {
						const image = new Image();
						image.onload = () => resolve(image.naturalWidth > 0);
						image.onerror = () => resolve(false);
						image.src = url;
					}),
				filename
			)
		).toBeTruthy();
	}
	await page.clock.runFor(1000);
	await page.mouse.move(0, 0);
	await page.evaluate(() => (document.activeElement as HTMLElement | SVGElement)?.blur());
	const hideRandomQuestion = await page.addStyleTag({
		content: '[data-taxonomy-game] > section { visibility: hidden !important; }'
	});
	try {
		await expect(map(page)).toHaveScreenshot(`${current.scene}-${current.viewport}.png`, {
			animations: 'disabled',
			maxDiffPixelRatio: 0.005
		});
	} finally {
		await hideRandomQuestion.evaluate((element) => element.parentNode?.removeChild(element));
	}
	await testInfo.attach(`${current.scene}-${current.viewport}`, {
		body: await page.screenshot({
			path: testInfo.outputPath(`${current.scene}-${current.viewport}-page.png`)
		}),
		contentType: 'image/png'
	});
}

Then(
	'the landscape shows these eight labelled and individually selectable illustrated farms:',
	async ({ page, world, $testInfo }, table: DataTable) => {
		for (const row of table.hashes())
			await expect(map(page).getByText(row.farm, { exact: true })).toBeVisible();
		await inspectScene(page, world, $testInfo, 8);
	}
);
Then(
	'the animal scene shows these labelled and individually selectable detailed animals:',
	async ({ page, world, $testInfo }, table: DataTable) => {
		for (const row of table.hashes())
			await expect(map(page).getByText(row.animal, { exact: true })).toBeVisible();
		await inspectScene(page, world, $testInfo, 4);
	}
);

async function completeRounds(page: Page, world: ScenarioWorld, rounds: number, attribute: string) {
	const current = state(world),
		taxonomy = current.taxonomy;
	const attributeId = taxonomy.attributes.find((a) => a.slug === attribute)!.id;
	for (let round = 1; round <= rounds; round++) {
		await expect(
			game(page).getByLabel(`Round ${round} of ${rounds}`, { exact: true })
		).toBeVisible();
		const heading = plainItemName(await game(page).getByRole('heading', { level: 1 }).innerText());
		const name = taxonomy.attributeOfItems.find(
			(v) =>
				typeof v.value === 'object' &&
				v.value !== null &&
				'en' in v.value &&
				v.value.en === heading &&
				taxonomy.attributeOfItems.some(
					(answer) => answer.itemId === v.itemId && answer.attributeId === attributeId
				)
		);
		expect(name, heading).toBeDefined();
		const answer = taxonomy.attributeOfItems.find(
			(v) => v.itemId === name!.itemId && v.attributeId === attributeId
		)!;
		const region = map(page).locator(
			`path[data-map-item-id="${answer.referencedItemId}"]:not(.helper)`
		);
		await expect(region).toHaveCount(1);
		if (round % 2 === 0) {
			await region.focus();
			await page.keyboard.press(round % 4 === 0 ? 'Space' : 'Enter');
			current.keyboardAnswers++;
		} else {
			// Find an actual visible interior point, excluding overlapping helper targets.
			const position = await region.evaluate((element) => {
				const path = element as SVGPathElement,
					box = path.getBBox(),
					ctm = path.getScreenCTM()!;
				for (let y = 0.1; y < 1; y += 0.1)
					for (let x = 0.1; x < 1; x += 0.1) {
						const local = new DOMPoint(box.x + box.width * x, box.y + box.height * y);
						if (!path.isPointInFill(local)) continue;
						const screen = local.matrixTransform(ctm),
							hit = document.elementFromPoint(screen.x, screen.y);
						if (hit?.getAttribute('data-map-item-id') === path.getAttribute('data-map-item-id'))
							return { x: screen.x, y: screen.y };
					}
				return null;
			});
			expect(position, `Visible pointer target for ${heading}`).not.toBeNull();
			await page.mouse.click(position!.x, position!.y);
			current.pointerAnswers++;
		}
		await expect(game(page).getByText('Correct location!', { exact: true })).toBeVisible();
		await expect(region).toHaveClass(/found/);
		await expect(game(page).getByText('No playable rounds', { exact: true })).not.toBeVisible();
		await game(page)
			.getByRole('button', { name: round === rounds ? 'Show results' : 'Next round', exact: true })
			.click();
	}
}
When(
	'I complete all 12 farm-origin rounds using the imported ingredient answers',
	async ({ page, world }) => {
		await completeRounds(page, world, 12, 'originFarm');
	}
);
When(
	'I complete all 10 animal-identification rounds using the imported meat answers',
	async ({ page, world }) => {
		await completeRounds(page, world, 10, 'sourceAnimal');
	}
);
When(
	'I complete all 10 butcher-chart rounds using the imported meat answers',
	async ({ page, world }) => {
		await completeRounds(page, world, 10, 'sourceCut');
	}
);

Then(
	'the advanced butcher chart opens without a {string} error',
	async ({ page, world, $testInfo }, error: string) => {
		const disclaimer = page.getByText(
			/This is an educational schematic, not a precise butchery guide/
		);
		await localUntil(page, disclaimer);
		// Let Svelte's delayed browser animation finish before freezing the story clock again.
		await page.clock.resume();
		await expect(disclaimer.locator('..').locator('..')).toHaveCSS('opacity', '1');
		await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 100));
		await expect(disclaimer).toBeVisible();
		await expect(disclaimer).toBeInViewport();
		state(world).disclaimerSeen = true;
		await $testInfo.attach('Educational schematic notice', {
			body: await page.screenshot({
				path: $testInfo.outputPath(`schematic-notice-${state(world).viewport}.png`),
				animations: 'disabled'
			}),
			contentType: 'image/png'
		});
		await localUntil(page, game(page).getByLabel('Round 1 of 10', { exact: true }));
		await expect(game(page).getByText(error, { exact: true })).not.toBeVisible();
		state(world).scene = 'cuts';
	}
);
Then(
	'the chart is identified as an educational schematic rather than a precise butchery guide',
	async ({ world }) => {
		expect(state(world).disclaimerSeen).toBeTruthy();
	}
);
Then(
	'all 44 imported cut regions are individually selectable within the corresponding animal silhouettes',
	async ({ page, world, $testInfo }) => {
		await inspectScene(page, world, $testInfo, 44);
	}
);
Then(
	'the cut boundaries follow plausible body regions with no visible cut-name answer labels',
	async ({ page }) => {
		await expect(map(page).locator('foreignObject')).toHaveCount(0);
		await expect(map(page).locator('path[data-map-item-id]:not(.helper)')).toHaveCount(44);
	}
);
When('I zoom and pan the butcher chart', async ({ page, world }) => {
	const svg = map(page),
		bounds = (await svg.boundingBox())!;
	world.entities.set(
		'food map transform',
		await svg.locator(':scope > g').getAttribute('transform')
	);
	await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
	await page.mouse.wheel(0, -300);
	await page.clock.runFor(500);
	await page.mouse.down();
	await page.mouse.move(bounds.x + bounds.width / 2 + 35, bounds.y + bounds.height / 2 + 25, {
		steps: 5
	});
	await page.mouse.up();
});
Then(
	'the illustrations, cut boundaries and selection targets remain aligned',
	async ({ page, world, $testInfo }) => {
		const svg = map(page);
		await expect(svg.locator(':scope > g')).not.toHaveAttribute(
			'transform',
			world.entities.get('food map transform')
		);
		expect(
			await svg.evaluate((element, anchor) => {
				const image = element.querySelector('image')!,
					path = element.querySelector(
						`path[data-map-item-id="${anchor.itemId}"]:not(.helper)`
					)! as SVGPathElement;
				const artworkPoint = new DOMPoint(...anchor.coordinate).matrixTransform(
					image.getScreenCTM()!
				);
				const first = path.getPointAtLength(0),
					targetPoint = new DOMPoint(first.x, first.y).matrixTransform(path.getScreenCTM()!);
				return Math.hypot(artworkPoint.x - targetPoint.x, artworkPoint.y - targetPoint.y);
			}, world.entities.get('food map anchor'))
		).toBeLessThan(0.1);
		await $testInfo.attach('Zoomed butcher chart', {
			body: await page.screenshot({
				path: $testInfo.outputPath(`cuts-${state(world).viewport}-zoomed.png`)
			}),
			contentType: 'image/png'
		});
		// Restore the fit view by zooming out so every animal remains available for the flow.
		await page.mouse.wheel(0, 2000);
		await page.clock.runFor(500);
	}
);
Then(
	'illustrated map selections show correct feedback without artwork blocking pointer or keyboard input',
	async ({ world }) => {
		expect(state(world).pointerAnswers).toBeGreaterThan(0);
		expect(state(world).keyboardAnswers).toBeGreaterThan(0);
		expect(state(world).errors).toEqual([]);
	}
);
