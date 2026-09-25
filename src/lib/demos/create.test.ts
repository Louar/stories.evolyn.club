import { describe, expect, it, vi } from 'vitest';
import { demos } from './catalog';
import { createDemo } from '$lib/server/create-demo.server';
import { POST } from '../../routes/api/(authenticated)/(2-story-module)/(role:editor|admin)/demos/[kind]/[slug]/+server';
import { schema as storySchema } from '../../routes/api/(authenticated)/(2-story-module)/(role:editor|admin)/stories/[[storyId]]/io/schemas';

type ImportedStory = {
	slug: string;
	isPublished: boolean;
	parts: { taxonomyDraftForPart?: { taxonomySlug: string } | null }[];
};
type ImportedBundle = ImportedStory & {
	positions: { storySlug: string }[];
	stories: ImportedStory[];
	attributeOfItems: unknown[];
};

function mockImporter() {
	const calls: { url: string; body: ImportedBundle }[] = [];
	const request = vi.fn<typeof fetch>(async (url, options) => {
		const body = JSON.parse(options!.body as string);
		calls.push({ url: String(url), body });
		return Response.json({ id: `created-${calls.length}`, slug: `${body.slug}-returned` });
	});
	return { calls, request };
}

describe('demo creation', { timeout: 20000 }, () => {
	it('rejects unknown endpoint parameters without starting imports', async () => {
		const { request } = mockImporter();
		for (const params of [
			{ kind: 'unknown', slug: 'quiz-of-cities' },
			{ kind: 'stories', slug: 'unknown' },
			{ kind: '__proto__', slug: 'quiz-of-cities' }
		]) {
			const response = await POST({ params, fetch: request } as unknown as Parameters<
				typeof POST
			>[0]);
			expect(response.status).toBe(404);
		}
		expect(request).not.toHaveBeenCalled();
	});

	it.each(demos.stories)(
		'publishes $slug and returns a compact creation result',
		async ({ slug }) => {
			const { calls, request } = mockImporter();
			const response = await POST({
				params: { kind: 'stories', slug },
				fetch: request
			} as unknown as Parameters<typeof POST>[0]);
			expect(response.status).toBe(201);
			expect(Object.keys(await response.json())).toEqual(['id', 'slug']);
			expect(calls.at(-1)?.body.isPublished).toBe(true);
		}
	);

	it('imports fresh taxonomy dependencies first and uses returned slugs in drafts', async () => {
		const { calls, request } = mockImporter();
		const result = await createDemo('stories', 'world-food-expedition', request);
		expect(calls.map((call) => call.url)).toEqual([
			'/api/taxonomies/io',
			'/api/taxonomies/io',
			'/api/stories/io'
		]);
		expect(result.id).toBe('created-3');
		const story = calls[2].body;
		expect(story.isPublished).toBe(true);
		const slugs = story.parts.flatMap((part) =>
			part.taxonomyDraftForPart ? [part.taxonomyDraftForPart.taxonomySlug] : []
		);
		expect([...new Set(slugs)]).toEqual(
			calls.slice(0, 2).map((call) => `${call.body.slug}-returned`)
		);
	});

	it('imports the standalone workout through the endpoint without dependencies', async () => {
		const { calls, request } = mockImporter();
		const response = await POST({
			params: { kind: 'stories', slug: 'home-workout' },
			fetch: request
		} as unknown as Parameters<typeof POST>[0]);
		expect(response.status).toBe(201);
		expect(calls.map((call) => call.url)).toEqual(['/api/stories/io']);
		const story = storySchema.parse(calls[0].body);
		expect(story.slug).toMatch(/^home-workout-/);
		expect(story.isPublished).toBe(true);
		expect(story.videos).toHaveLength(4);
		expect(story.announcements).toHaveLength(2);
		expect(story.quizzes).toHaveLength(2);
		expect(
			story.parts.every((part) => part.backgroundConfiguration && part.foregroundConfiguration)
		).toBe(true);
		expect(story.parts[1].quizLogicForPart).toMatchObject({
			quizTemplateId: 'pace-quiz',
			defaultNextPartId: 'low-impact',
			rules: [{ nextPartId: 'full-body' }]
		});
		expect(story.parts.at(-1)?.terminationStrategy).toBe('COMPLETE_STORY');
	});

	it('creates distinct copies on repeated clicks without changing the source bundles', async () => {
		const { calls, request } = mockImporter();
		await Promise.all([
			createDemo('stories', 'quiz-of-cities', request),
			createDemo('stories', 'quiz-of-cities', request)
		]);
		expect(calls).toHaveLength(2);
		expect(calls[0].body.slug).not.toBe(calls[1].body.slug);
		expect(
			calls.every((call) => call.body.slug.startsWith('quiz-of-cities-') && call.body.isPublished)
		).toBe(true);
	});

	it('rewrites anthology positions together with embedded stories and imports each dependency once', async () => {
		const { calls, request } = mockImporter();
		await createDemo('anthologies', 'discovery-collection', request);
		expect(calls.map((call) => call.url)).toEqual([
			'/api/taxonomies/io',
			'/api/taxonomies/io',
			'/api/anthologies/io'
		]);
		const anthology = calls[2].body;
		expect(anthology.positions.map((position) => position.storySlug)).toEqual(
			anthology.stories.map((story) => story.slug)
		);
		expect(anthology.isPublished).toBe(true);
		expect(anthology.stories.length).toBeGreaterThan(0);
		expect(anthology.stories.every((story) => story.isPublished === true)).toBe(true);
	});

	it('creates a standalone taxonomy copy', async () => {
		const { calls, request } = mockImporter();
		await createDemo('taxonomies', 'food-taxonomy', request);
		expect(calls).toHaveLength(1);
		expect(calls[0].body.slug).toMatch(/^food-taxonomy-/);
		expect(calls[0].body.attributeOfItems.length).toBeGreaterThan(100);
	});

	it('stops on failed dependencies and explains partial imports', async () => {
		const { request } = mockImporter();
		request.mockImplementationOnce(async () =>
			Response.json({ id: 'taxonomy', slug: 'general-copy' })
		);
		request.mockImplementationOnce(async () =>
			Response.json({ message: 'Import unavailable' }, { status: 503 })
		);
		await expect(createDemo('stories', 'world-food-expedition', request)).rejects.toThrow(
			'Some demo records may already have been created'
		);
		expect(request).toHaveBeenCalledTimes(2);
	});

	it('reports authentication errors and rejects unknown demos without a request', async () => {
		const request = vi.fn<typeof fetch>(async () => new Response('Unauthorized', { status: 401 }));
		await expect(createDemo('stories', 'missing', request)).rejects.toThrow('Unknown demo');
		expect(request).not.toHaveBeenCalled();
		await expect(createDemo('stories', 'trail-decisions', request)).rejects.toThrow('(401)');
		expect(request).toHaveBeenCalledTimes(1);
	});
});
