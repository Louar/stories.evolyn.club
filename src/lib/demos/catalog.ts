export type DemoKind = 'stories' | 'taxonomies' | 'anthologies';

export const demos = {
	stories: [
		{
			slug: 'quiz-of-cities',
			name: 'Quiz of Cities',
			description:
				'The original video quiz: Barcelona, Luzern, branching answers, retries, and success or failure endings.'
		},
		{
			slug: 'trail-decisions',
			name: 'Trail Decisions',
			description:
				'A short safety scenario with still backgrounds, a route choice, explanatory feedback, and a retry loop.'
		},
		{
			slug: 'world-food-expedition',
			name: 'World Food Expedition',
			description:
				'Five taxonomy challenges with animated backgrounds: countries, populations, food origins, nutrition, and the Wheel of Five. Includes both taxonomies.'
		}
	],
	taxonomies: [
		{
			slug: 'general-taxonomy',
			name: 'Countries and Foods',
			description:
				'The full general taxonomy: country maps, populations, food nutrition, and food-to-country references, in English and Dutch.'
		},
		{
			slug: 'food-taxonomy',
			name: 'Foods and the Wheel of Five',
			description:
				'The full food taxonomy with nutrition, prices, origins, and linked Wheel of Five groups, including their map geometry.'
		}
	],
	anthologies: [
		{
			slug: 'discovery-collection',
			name: 'Discovery Collection',
			description:
				'An ordered anthology containing all three demo stories and their taxonomy dependencies, with a performance overview.'
		}
	]
} satisfies Record<DemoKind, { slug: string; name: string; description: string }[]>;
