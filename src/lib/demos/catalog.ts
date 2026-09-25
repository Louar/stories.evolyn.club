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
				'Guide a stranded hiker through a survival conversation with two-response choices, brief busy pauses, animated tension, and a second chance after lost contact.'
		},
		{
			slug: 'world-food-expedition',
			name: 'World Food Expedition',
			description:
				'Five taxonomy challenges with animated backgrounds: countries, populations, food origins, nutrition, and the Wheel of Five. Includes both taxonomies.'
		},
		{
			slug: 'home-workout',
			name: 'Home Workout',
			description:
				'Four 10-second YouTube excerpts, including two genuine Shorts, with workout tips, two knowledge checks with retries, and a gentle stretching completion.'
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
				'An ordered anthology containing Quiz of Cities, Trail Decisions, and World Food Expedition with their taxonomy dependencies and a performance overview.'
		}
	]
} satisfies Record<DemoKind, { slug: string; name: string; description: string }[]>;
