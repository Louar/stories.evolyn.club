import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { AttributeType } from '$lib/db/schemas/2-story-module';
import * as m from '$lib/paraglide/messages';
import Game from './Game.svelte';
import type { TaxonomyRound } from './types';

describe('taxonomy game questions', () => {
	it.each(['map', 'slider', 'sort'] as const)(
		'uses custom questions and fallbacks for %s',
		(kind) => {
			const round: TaxonomyRound = {
				category: { id: 'category', name: 'Category' },
				attribute: {
					id: 'attribute',
					name: 'Attribute',
					question: 'Waar hoort dit voedsel?',
					type: kind === 'map' ? AttributeType.itemReference : AttributeType.number,
					referencedCategoryId: null,
					schema: null
				},
				items: Array.from({ length: kind === 'sort' ? 2 : 1 }, (_, index) => ({
					id: `item-${index}`,
					name: `Item ${index}`,
					value: 100 + index,
					referencedItemId: 'map-item',
					referencedName: 'Map item'
				})),
				map: {
					type: 'topojson',
					projection: 'identity',
					topology: {
						type: 'Topology',
						objects: {},
						arcs: [
							[
								[0, 0],
								[1, 0],
								[1, 1],
								[0, 1],
								[0, 0]
							]
						]
					}
				},
				mapItems: [
					{ id: 'map-item', name: 'Map item', shape: [[0]], center: null, color: null, icons: [] }
				]
			};
			const renderRound = () =>
				render(Game, {
					props: {
						rounds: [round],
						goal: 1,
						maxMistakes: null,
						difficulty: null,
						oncomplete: () => {}
					}
				}).body;
			const custom = renderRound();
			expect(custom).toContain('Waar hoort dit voedsel?');
			if (kind === 'slider')
				expect(custom).toMatch(/<input[^>]*aria-label="Waar hoort dit voedsel\?"/);
			round.attribute.question = null;
			const fallback =
				kind === 'map'
					? m.taxonomy_map_prompt({ attribute: 'Attribute' })
					: kind === 'slider'
						? m.taxonomy_slider_prompt({ attribute: 'Attribute' })
						: m.taxonomy_sort_by({ attribute: 'Attribute' });
			const defaultPrompt = renderRound();
			expect(defaultPrompt).toContain(fallback);
			expect(defaultPrompt).not.toContain('Waar hoort dit voedsel?');
			if (kind === 'slider') expect(defaultPrompt).toContain(`aria-label="${fallback}"`);
		}
	);
});
