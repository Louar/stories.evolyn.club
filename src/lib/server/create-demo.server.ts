import YAML from 'yaml';
import { demos, type DemoKind } from '$lib/demos/catalog';

const bundles = import.meta.glob('../demos/*/*.yaml', { query: '?raw', import: 'default' });
type Story = {
	slug: string;
	isPublished: boolean;
	parts: { taxonomyDraftForPart?: { taxonomySlug: string } | null }[];
};
type Bundle = {
	slug: string;
	isPublished?: boolean;
	parts?: Story['parts'];
	stories?: Story[];
	positions?: { storySlug: string }[];
};

export async function createDemo(kind: DemoKind, slug: string, request: typeof fetch) {
	if (!demos[kind].some((demo) => demo.slug === slug)) throw new Error('Unknown demo');
	const load = async (kind: DemoKind, slug: string): Promise<Bundle> => {
		const loader = bundles[`../demos/${kind}/${slug}.yaml`];
		if (!loader) throw new Error(`Missing demo bundle: ${slug}`);
		return YAML.parse((await loader()) as string);
	};
	const suffix = crypto.randomUUID();
	let importsStarted = 0;
	const upload = async (kind: DemoKind, bundle: Bundle): Promise<{ id: string; slug: string }> => {
		importsStarted += 1;
		const response = await request(`/api/${kind}/io`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(bundle)
		});
		const payload = await response.json().catch(() => null);
		if (!response.ok)
			throw new Error(payload?.message ?? `Could not import ${bundle.slug} (${response.status})`);
		if (typeof payload?.id !== 'string' || typeof payload?.slug !== 'string') {
			throw new Error('The import response did not include an ID and slug');
		}
		return { id: payload.id, slug: payload.slug };
	};
	try {
		const bundle = await load(kind, slug);
		const stories = kind === 'stories' ? [bundle as Story] : (bundle.stories ?? []);
		const dependencies = new Set(
			stories.flatMap((story) =>
				story.parts.flatMap((part) =>
					part.taxonomyDraftForPart ? [part.taxonomyDraftForPart.taxonomySlug] : []
				)
			)
		);
		const taxonomySlugs = new Map<string, string>();
		for (const dependency of dependencies) {
			const taxonomy = await load('taxonomies', dependency);
			taxonomy.slug = `${taxonomy.slug}-${suffix}`;
			const created = await upload('taxonomies', taxonomy);
			taxonomySlugs.set(dependency, created.slug);
		}
		for (const story of stories) {
			const originalSlug = story.slug;
			story.slug = `${originalSlug}-${suffix}`;
			story.isPublished = true;
			for (const position of bundle.positions ?? []) {
				if (position.storySlug === originalSlug) position.storySlug = story.slug;
			}
			for (const part of story.parts) {
				if (part.taxonomyDraftForPart) {
					part.taxonomyDraftForPart.taxonomySlug = taxonomySlugs.get(
						part.taxonomyDraftForPart.taxonomySlug
					)!;
				}
			}
		}
		if (kind !== 'stories') bundle.slug = `${bundle.slug}-${suffix}`;
		if (kind !== 'taxonomies') bundle.isPublished = true;
		return await upload(kind, bundle);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Demo creation failed';
		throw new Error(
			`${message}.${importsStarted ? ' Some demo records may already have been created; check the lists before retrying. Existing records were not changed.' : ''}`,
			{ cause: error }
		);
	}
}
