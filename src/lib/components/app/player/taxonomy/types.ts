import type { AttributeType } from '$lib/db/schemas/2-story-module';

export type TaxonomyRound = {
	category: {
		id: string;
		name: string | null;
	};
	attribute: {
		id: string;
		name: string | null;
		referencedCategoryId: string | null;
		type: AttributeType;
	};
	items: Array<{
		id: string;
		name: string | null;
		value: unknown;
		referencedItemId: string | null;
		referencedName: string | null;
	}>;
	map: unknown;
	mapItems: Array<{
		id: string;
		name: string | null;
		shape: unknown;
		center: unknown;
		color: unknown;
		icons: unknown;
	}>;
};

export type SortableRoundItem = {
	id: string;
	name: string;
	sortValue: number;
};

export type GamePerformance = {
	nrOfRounds: number;
	score: number;
	mistakes: number;
	duration: number;
};
