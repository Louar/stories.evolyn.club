import type { Translatable } from '$lib/db/schemas/0-utils';

export const WheelOfFiveCategory = {
	vegetablesAndFruit: 'Vegetables and fruit',
	breadsGrainsAndPotatoes: 'Breads, grain/cereal products, and potatoes',
	waterTeaAndCoffee: 'Water, tea, and coffee',
	proteinAndDairy: 'Legumes, nuts, fish, eggs, meat, and dairy',
	oilsAndFats: 'Oils and fats',
	none: 'None'
} as const;

export type WheelOfFiveCategory = (typeof WheelOfFiveCategory)[keyof typeof WheelOfFiveCategory];

export const wheelOfFiveCategories = Object.values(WheelOfFiveCategory);

export const wheelOfFiveLabels: Record<WheelOfFiveCategory, Translatable> = {
	[WheelOfFiveCategory.vegetablesAndFruit]: {
		en: 'Vegetables and fruit',
		nl: 'Groente en fruit'
	},
	[WheelOfFiveCategory.breadsGrainsAndPotatoes]: {
		en: 'Breads, grain/cereal products, and potatoes',
		nl: 'Brood, graanproducten en aardappelen'
	},
	[WheelOfFiveCategory.waterTeaAndCoffee]: {
		en: 'Water, tea, and coffee',
		nl: 'Water, thee en koffie'
	},
	[WheelOfFiveCategory.proteinAndDairy]: {
		en: 'Legumes, nuts, fish, eggs, meat, and dairy',
		nl: 'Peulvruchten, noten, vis, ei, vlees en zuivel'
	},
	[WheelOfFiveCategory.oilsAndFats]: {
		en: 'Oils and fats',
		nl: 'Smeer- en bereidingsvetten'
	},
	[WheelOfFiveCategory.none]: {
		en: 'None',
		nl: 'Niet in de Schijf van Vijf'
	}
};

export const wheelOfFiveMapCategories: WheelOfFiveCategory[] = wheelOfFiveCategories.filter(
	(category) => category !== WheelOfFiveCategory.none
);
