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
		},
		{
			slug: 'farm-to-table-pin-game',
			name: 'Farm to table: pin the ingredient',
			description:
				'Detailed farm-to-burger assembly intro with animated journey from farm to fork, showing agricultural origins of ingredients.'
		},
		{
			slug: 'meat-cuts-game',
			name: 'Meat cuts game',
			description:
				'Match each meat to the right animal — or the right cut, with animated butcher chart transitions and interactive matching challenges.'
		},
	],
	taxonomies: [
		{
			slug: 'countries-and-foods',
			name: 'Countries and Foods',
			description:
				'The full general taxonomy: country maps, populations, food nutrition, and food-to-country references, in English and Dutch.'
		},
		{
			slug: 'foods-and-wheel-of-five',
			name: 'Foods and the Wheel of Five',
			description:
				'The full food taxonomy with nutrition, prices, origins, and linked Wheel of Five groups backed by reusable map assets.'
		},
		{
			slug: 'farm-to-table-origins',
			name: 'Farm to table origins',
			description:
				'The full farm-to-table taxonomy with crop origins, supplier networks, and sustainable sourcing practices backed by reusable map assets.'
		},
		{
			slug: 'meat-cuts-and-animals',
			name: 'Meat cuts and animals',
			description:
				'The full meat taxonomy with cuts, animal species, and interactive matching challenges backed by reusable map assets.'
		},
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
