import { AttributeType } from '$lib/db/schemas/2-story-module';
import type { TaxonomyRound } from './types';

export function filterUniqueTaxonomyRounds<T extends TaxonomyRound>(rounds: T[]) {
	const seen = new Set<string>();
	return rounds.filter((round) => {
		const key = getTaxonomyRoundQuestionKey(round);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export function getTaxonomyRoundQuestionKey(round: TaxonomyRound) {
	return `${round.attribute.id}:${getTaxonomyRoundItemKey(round)}`;
}

function getTaxonomyRoundItemKey(round: TaxonomyRound) {
	if (round.attribute.type === AttributeType.number) {
		return round.items.length === 1
			? (round.items[0]?.id ?? '')
			: round.items
					.map((item) => item.id)
					.sort()
					.join('|');
	}

	const target = round.items.find((item) => {
		const targetItemId =
			round.attribute.type === AttributeType.itemReference ? item.referencedItemId : item.id;
		return targetItemId && round.mapItems.some((mapItem) => mapItem.id === targetItemId);
	});

	return target?.id ?? round.items[0]?.id ?? '';
}
