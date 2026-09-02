import { DEFAULT_CLIENT_SLUG } from '$app/env/private';
import { db } from '$lib/db/database';
import type { Translatable } from '$lib/db/schemas/0-utils';
import { AttributeType } from '$lib/db/schemas/2-story-module';
import {
	WheelOfFiveCategory,
	wheelOfFiveLabels,
	wheelOfFiveMapCategories
} from '$lib/models/wheel-of-five';

const wheelOfFiveColors: Record<WheelOfFiveCategory, string> = {
	[WheelOfFiveCategory.vegetablesAndFruit]: '#2f9567',
	[WheelOfFiveCategory.breadsGrainsAndPotatoes]: '#f2b93f',
	[WheelOfFiveCategory.waterTeaAndCoffee]: '#3e91ad',
	[WheelOfFiveCategory.proteinAndDairy]: '#e5533f',
	[WheelOfFiveCategory.oilsAndFats]: '#197f7d',
	[WheelOfFiveCategory.none]: 'var(--map-helper-fill)'
};

const wheelOfFiveAngles: Record<WheelOfFiveCategory, readonly [number, number]> = {
	[WheelOfFiveCategory.vegetablesAndFruit]: [90, 170],
	[WheelOfFiveCategory.breadsGrainsAndPotatoes]: [0, 90],
	[WheelOfFiveCategory.waterTeaAndCoffee]: [225, 300],
	[WheelOfFiveCategory.proteinAndDairy]: [300, 360],
	[WheelOfFiveCategory.oilsAndFats]: [170, 225],
	[WheelOfFiveCategory.none]: [0, 0]
};

const wheelOfFiveIcons: Record<WheelOfFiveCategory, string[]> = {
	[WheelOfFiveCategory.vegetablesAndFruit]: ['🥦', '🍎', '🥕'],
	[WheelOfFiveCategory.breadsGrainsAndPotatoes]: ['🍞', '🌾', '🥔'],
	[WheelOfFiveCategory.waterTeaAndCoffee]: ['💧', '🍵', '☕'],
	[WheelOfFiveCategory.proteinAndDairy]: ['🫘', '🐟', '🥚', '🥛'],
	[WheelOfFiveCategory.oilsAndFats]: ['🫒', '🥜', '🧈'],
	[WheelOfFiveCategory.none]: ['🍟', '🍪', '🍫']
};

const wheelOfFiveRadius = 0.9;
const noneCircleCenter: [number, number] = [1.5, 0];
const noneCircleRadius = 0.18;

function getCategoryMap(categoryName: string) {
	if (categoryName !== 'Schijf van Vijf') return null;

	return {
		type: 'topojson',
		object: 'items',
		projection: 'identity',
		showLabels: true,
		topology: {
			type: 'Topology',
			arcs: [
				...wheelOfFiveMapCategories.map((category) => createWheelOfFiveArc(category)),
				createCircleArc(noneCircleCenter, noneCircleRadius)
			],
			objects: { items: { type: 'GeometryCollection', geometries: [] } }
		}
	};
}

function createWheelOfFiveArc(category: WheelOfFiveCategory) {
	const [startDegrees, endDegrees] = wheelOfFiveAngles[category];
	const startAngle = (startDegrees * Math.PI) / 180;
	const endAngle = (endDegrees * Math.PI) / 180;
	const steps = 48;
	const points: number[][] = [[0, 0]];

	for (let step = 0; step <= steps; step += 1) {
		const angle = endAngle - ((endAngle - startAngle) * step) / steps;
		points.push([Math.cos(angle) * wheelOfFiveRadius, Math.sin(angle) * wheelOfFiveRadius]);
	}
	points.push([0, 0]);
	return points;
}

function createCircleArc([centerX, centerY]: [number, number], radius: number) {
	const steps = 64;
	const points: number[][] = [];

	for (let step = 0; step <= steps; step += 1) {
		const angle = Math.PI / 2 - (step * Math.PI * 2) / steps;
		points.push([centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius]);
	}
	return points;
}

function getWheelOfFiveShape(category: WheelOfFiveCategory) {
	if (category === WheelOfFiveCategory.none) return [[wheelOfFiveMapCategories.length]];

	const index = wheelOfFiveMapCategories.indexOf(category);
	return index === -1 ? null : [[index]];
}

function getWheelOfFiveCenter(category: WheelOfFiveCategory) {
	if (category === WheelOfFiveCategory.none) return noneCircleCenter;

	const [startDegrees, endDegrees] = wheelOfFiveAngles[category];
	const angle = (((startDegrees + endDegrees) / 2) * Math.PI) / 180;
	return [Math.cos(angle) * 0.58 * wheelOfFiveRadius, Math.sin(angle) * 0.58 * wheelOfFiveRadius];
}

function getWheelOfFiveColor(category: WheelOfFiveCategory) {
	return wheelOfFiveColors[category];
}

export const DummyDataFoodTaxonomy = async (taxonomyName = 'Food taxonomy', clientId?: string) => {
	await db.transaction().execute(async (trx) => {
		const attributeDefinitions = {
			name: {
				name: { en: 'Name', nl: 'Naam' },
				description: {
					en: 'Name',
					nl: 'Naam'
				},
				type: AttributeType.translatableCategory
			},
			emoji: {
				name: { en: 'Emoji', nl: 'Emoji' },
				description: {
					en: 'Emoji',
					nl: 'Emoji'
				},
				type: AttributeType.translatableCategory
			},
			calories: {
				name: { en: 'Calories', nl: 'Calorieën' },
				description: {
					en: 'Energy per 100 g in kcal',
					nl: 'Energie per 100 g in kcal'
				},
				type: AttributeType.number
			},
			averagePrice: {
				name: { en: 'Average price', nl: 'Gemiddelde prijs' },
				description: {
					en: 'Indicative average supermarket price per 100 g in EUR',
					nl: 'Indicatieve gemiddelde supermarktprijs per 100 g in EUR'
				},
				type: AttributeType.number
			},
			carbs: {
				name: { en: 'Carbohydrates', nl: 'Koolhydraten' },
				description: {
					en: 'Carbohydrates per 100 g in grams',
					nl: 'Koolhydraten per 100 g in gram'
				},
				type: AttributeType.number
			},
			protein: {
				name: { en: 'Protein', nl: 'Eiwit' },
				description: {
					en: 'Protein per 100 g in grams',
					nl: 'Eiwit per 100 g in gram'
				},
				type: AttributeType.number
			},
			fat: {
				name: { en: 'Fat', nl: 'Vet' },
				description: {
					en: 'Fat per 100 g in grams',
					nl: 'Vet per 100 g in gram'
				},
				type: AttributeType.number
			},
			fiber: {
				name: { en: 'Fiber', nl: 'Vezels' },
				description: {
					en: 'Fiber per 100 g in grams',
					nl: 'Vezels per 100 g in gram'
				},
				type: AttributeType.number
			},
			countryOfOrigin: {
				name: { en: 'Country of origin', nl: 'Land van oorsprong' },
				description: {
					en: 'Representative country associated with the food for demo purposes',
					nl: 'Representatief land dat voor demodoeleinden met het voedsel wordt geassocieerd'
				},
				type: AttributeType.translatable
			},
			wheelOfFive: {
				name: { en: 'Wheel of Five', nl: 'Schijf van Vijf' },
				description: {
					en: 'Dutch Wheel of Five product group',
					nl: 'Productgroep uit de Schijf van Vijf'
				},
				type: AttributeType.itemReference,
				referencedCategoryReference: 'Schijf van Vijf'
			},
			color: {
				name: { en: 'Color', nl: 'Kleur' },
				description: {
					en: 'CSS color used to fill this item on a map',
					nl: 'CSS-kleur waarmee dit item op een kaart wordt gevuld'
				},
				type: AttributeType.custom
			},
			icons: {
				name: { en: 'Icons', nl: 'Iconen' },
				description: {
					en: 'Decorative icons displayed on this map item',
					nl: 'Decoratieve iconen die op dit kaartitem worden weergegeven'
				},
				type: AttributeType.custom
			},
			shape: {
				name: { en: 'Shape', nl: 'Vorm' },
				description: {
					en: 'Geometry and map metadata used to visualize this item',
					nl: 'Geometrie en kaartmetadata om dit item te visualiseren'
				},
				type: AttributeType.custom
			},
			center: {
				name: { en: 'Center', nl: 'Middelpunt' },
				description: {
					en: 'Map center formatted as longitude, latitude',
					nl: 'Kaartmiddelpunt geformatteerd als lengtegraad, breedtegraad'
				},
				type: AttributeType.custom
			}
		} as const;

		const categoryDefinitions = [
			{
				name: { en: 'Schijf van Vijf', nl: 'Schijf van Vijf' },
				description: {
					en: 'Dutch Wheel of Five product groups used to classify foods',
					nl: 'Productgroepen uit de Schijf van Vijf waarmee voedsel wordt ingedeeld'
				},
				attributes: ['name', 'color', 'icons', 'shape', 'center'],
				items: wheelOfFiveCategoriesWithLabels()
			},
			{
				name: { en: 'Foods', nl: 'Voedsel' },
				description: {
					en: 'Everyday foods with nutrition values per 100 g',
					nl: 'Dagelijks voedsel met voedingswaarden per 100 g'
				},
				attributes: [
					'name',
					'emoji',
					'calories',
					'averagePrice',
					'carbs',
					'protein',
					'fat',
					'fiber',
					'countryOfOrigin',
					'wheelOfFive'
				],
				items: [
					{
						name: { en: 'Grapes', nl: 'Druiven' },
						emoji: { default: '🍇' },
						calories: 78,
						averagePrice: 0.45,
						carbs: 16.8,
						protein: 0.6,
						fat: 0.2,
						fiber: 1.8,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'Georgia', nl: 'Georgië' }
					},
					{
						name: { en: 'Melon', nl: 'Meloen' },
						emoji: { default: '🍈' },
						calories: 34,
						averagePrice: 0.35,
						carbs: 8.2,
						protein: 0.8,
						fat: 0.2,
						fiber: 0.9,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'Iran', nl: 'Iran' }
					},
					{
						name: { en: 'Watermelon', nl: 'Watermeloen' },
						emoji: { default: '🍉' },
						calories: 30,
						averagePrice: 0.2,
						carbs: 7.6,
						protein: 0.6,
						fat: 0.2,
						fiber: 0.4,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'South Africa', nl: 'Zuid-Afrika' }
					},
					{
						name: { en: 'Orange', nl: 'Sinaasappel' },
						emoji: { default: '🍊' },
						calories: 51,
						averagePrice: 0.3,
						carbs: 7.9,
						protein: 0.8,
						fat: 1,
						fiber: 2,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'China', nl: 'China' }
					},
					{
						name: { en: 'Lemon', nl: 'Citroen' },
						emoji: { default: '🍋' },
						calories: 36,
						averagePrice: 0.45,
						carbs: 3,
						protein: 0.8,
						fat: 0.3,
						fiber: 2,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'India', nl: 'India' }
					},
					{
						name: { en: 'Lime', nl: 'Limoen' },
						emoji: { default: '🍋‍🟩' },
						calories: 30,
						averagePrice: 0.6,
						carbs: 10.5,
						protein: 0.7,
						fat: 0.2,
						fiber: 2.8,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'India', nl: 'India' }
					},
					{
						name: { en: 'Banana', nl: 'Banaan' },
						emoji: { default: '🍌' },
						calories: 95,
						averagePrice: 0.2,
						carbs: 20.6,
						protein: 1.1,
						fat: 0.3,
						fiber: 1.9,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'Papua New Guinea', nl: 'Papoea-Nieuw-Guinea' }
					},
					{
						name: { en: 'Pineapple', nl: 'Ananas' },
						emoji: { default: '🍍' },
						calories: 57,
						averagePrice: 0.35,
						carbs: 12,
						protein: 0.5,
						fat: 0.1,
						fiber: 1.6,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'Brazil', nl: 'Brazilië' }
					},
					{
						name: { en: 'Mango', nl: 'Mango' },
						emoji: { default: '🥭' },
						calories: 66,
						averagePrice: 0.5,
						carbs: 14.3,
						protein: 0.6,
						fat: 0.2,
						fiber: 1.6,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'India', nl: 'India' }
					},
					{
						name: { en: 'Red apple', nl: 'Rode appel' },
						emoji: { default: '🍎' },
						calories: 60,
						averagePrice: 0.3,
						carbs: 13,
						protein: 0.3,
						fat: 0.2,
						fiber: 2,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'Kazakhstan', nl: 'Kazachstan' }
					},
					{
						name: { en: 'Green apple', nl: 'Groene appel' },
						emoji: { default: '🍏' },
						calories: 58,
						averagePrice: 0.3,
						carbs: 12.9,
						protein: 0.2,
						fat: 0.1,
						fiber: 1.6,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'Kazakhstan', nl: 'Kazachstan' }
					},
					{
						name: { en: 'Pear', nl: 'Peer' },
						emoji: { default: '🍐' },
						calories: 55,
						averagePrice: 0.35,
						carbs: 11.7,
						protein: 0.2,
						fat: 0.3,
						fiber: 2.2,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'China', nl: 'China' }
					},
					{
						name: { en: 'Peach', nl: 'Perzik' },
						emoji: { default: '🍑' },
						calories: 41,
						averagePrice: 0.45,
						carbs: 7.9,
						protein: 1,
						fat: 0,
						fiber: 1.4,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'China', nl: 'China' }
					},
					{
						name: { en: 'Cherries', nl: 'Kersen' },
						emoji: { default: '🍒' },
						calories: 54,
						averagePrice: 0.95,
						carbs: 11.5,
						protein: 0.9,
						fat: 0,
						fiber: 0.9,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'Turkey', nl: 'Turkije' }
					},
					{
						name: { en: 'Strawberries', nl: 'Aardbeien' },
						emoji: { default: '🍓' },
						calories: 29,
						averagePrice: 0.85,
						carbs: 5.1,
						protein: 0.7,
						fat: 0,
						fiber: 1.1,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'France', nl: 'Frankrijk' }
					},
					{
						name: { en: 'Blueberries', nl: 'Blauwe bessen' },
						emoji: { default: '🫐' },
						calories: 57,
						averagePrice: 1.2,
						carbs: 14.5,
						protein: 0.7,
						fat: 0.3,
						fiber: 2.4,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'United States of America', nl: 'Verenigde Staten' }
					},
					{
						name: { en: 'Kiwi', nl: 'Kiwi' },
						emoji: { default: '🥝' },
						calories: 61,
						averagePrice: 0.65,
						carbs: 14.7,
						protein: 1.1,
						fat: 0.5,
						fiber: 3,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'China', nl: 'China' }
					},
					{
						name: { en: 'Tomato', nl: 'Tomaat' },
						emoji: { default: '🍅' },
						calories: 23,
						averagePrice: 0.35,
						carbs: 3.1,
						protein: 0.7,
						fat: 0.5,
						fiber: 1.4,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'Mexico', nl: 'Mexico' }
					},
					{
						name: { en: 'Green olives', nl: 'Groene olijven' },
						emoji: { default: '🫒' },
						calories: 113,
						averagePrice: 0.9,
						carbs: 0.5,
						protein: 0.9,
						fat: 11,
						fiber: 4,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'Greece', nl: 'Griekenland' }
					},
					{
						name: { en: 'Coconut', nl: 'Kokosnoot' },
						emoji: { default: '🥥' },
						calories: 415,
						averagePrice: 0.8,
						carbs: 3,
						protein: 4,
						fat: 40,
						fiber: 13.6,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'Indonesia', nl: 'Indonesië' }
					},
					{
						name: { en: 'Mushroom', nl: 'Champignon' },
						emoji: { default: '🍄' },
						calories: 18,
						averagePrice: 0.55,
						carbs: 0.4,
						protein: 2.3,
						fat: 0.5,
						fiber: 1.5,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'France', nl: 'Frankrijk' }
					},
					{
						name: { en: 'Avocado', nl: 'Avocado' },
						emoji: { default: '🥑' },
						calories: 199,
						averagePrice: 0.85,
						carbs: 1.8,
						protein: 1.9,
						fat: 19.5,
						fiber: 4.3,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'Mexico', nl: 'Mexico' }
					},
					{
						name: { en: 'Eggplant', nl: 'Aubergine' },
						emoji: { default: '🍆' },
						calories: 20,
						averagePrice: 0.45,
						carbs: 3,
						protein: 1,
						fat: 0,
						fiber: 2,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'India', nl: 'India' }
					},
					{
						name: { en: 'Potato', nl: 'Aardappel' },
						emoji: { default: '🥔' },
						calories: 88,
						averagePrice: 0.18,
						carbs: 19,
						protein: 2,
						fat: 0,
						fiber: 1.8,
						wheelOfFive: WheelOfFiveCategory.breadsGrainsAndPotatoes,
						countryOfOrigin: { en: 'Peru', nl: 'Peru' }
					},
					{
						name: { en: 'Carrot', nl: 'Wortel' },
						emoji: { default: '🥕' },
						calories: 33,
						averagePrice: 0.2,
						carbs: 5.6,
						protein: 0.7,
						fat: 0.3,
						fiber: 2.8,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'Afghanistan', nl: 'Afghanistan' }
					},
					{
						name: { en: 'Sweet corn', nl: 'Suikermaïs' },
						emoji: { default: '🌽' },
						calories: 74,
						averagePrice: 0.35,
						carbs: 11.6,
						protein: 2.5,
						fat: 1.4,
						fiber: 2.5,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'Mexico', nl: 'Mexico' }
					},
					{
						name: { en: 'Chili pepper', nl: 'Chilipeper' },
						emoji: { default: '🌶️' },
						calories: 30,
						averagePrice: 0.9,
						carbs: 4.2,
						protein: 1.8,
						fat: 0.3,
						fiber: 1.8,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'Mexico', nl: 'Mexico' }
					},
					{
						name: { en: 'Bell pepper', nl: 'Paprika' },
						emoji: { default: '🫑' },
						calories: 24,
						averagePrice: 0.65,
						carbs: 3.8,
						protein: 0.8,
						fat: 0.1,
						fiber: 2.1,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'Mexico', nl: 'Mexico' }
					},
					{
						name: { en: 'Cucumber', nl: 'Komkommer' },
						emoji: { default: '🥒' },
						calories: 13,
						averagePrice: 0.25,
						carbs: 1.3,
						protein: 0.7,
						fat: 0.4,
						fiber: 0.6,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'India', nl: 'India' }
					},
					{
						name: { en: 'Lettuce', nl: 'Sla' },
						emoji: { default: '🥬' },
						calories: 15,
						averagePrice: 0.45,
						carbs: 1.3,
						protein: 1.4,
						fat: 0.2,
						fiber: 1.3,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'Egypt', nl: 'Egypte' }
					},
					{
						name: { en: 'Broccoli', nl: 'Broccoli' },
						emoji: { default: '🥦' },
						calories: 27,
						averagePrice: 0.45,
						carbs: 0.8,
						protein: 2.9,
						fat: 0.7,
						fiber: 3.1,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'Italy', nl: 'Italië' }
					},
					{
						name: { en: 'Garlic', nl: 'Knoflook' },
						emoji: { default: '🧄' },
						calories: 158,
						averagePrice: 0.75,
						carbs: 31,
						protein: 6.4,
						fat: 0.5,
						fiber: 2.1,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'China', nl: 'China' }
					},
					{
						name: { en: 'Onion', nl: 'Ui' },
						emoji: { default: '🧅' },
						calories: 37,
						averagePrice: 0.18,
						carbs: 6.6,
						protein: 1.2,
						fat: 0.1,
						fiber: 2.2,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'Iran', nl: 'Iran' }
					},
					{
						name: { en: 'Peanuts', nl: "Pinda's" },
						emoji: { default: '🥜' },
						calories: 631,
						averagePrice: 0.7,
						carbs: 12.9,
						protein: 25.2,
						fat: 51.7,
						fiber: 6.8,
						wheelOfFive: WheelOfFiveCategory.proteinAndDairy,
						countryOfOrigin: { en: 'Bolivia', nl: 'Bolivia' }
					},
					{
						name: { en: 'Kidney beans', nl: 'Kidneybonen' },
						emoji: { default: '🫘' },
						calories: 127,
						averagePrice: 0.35,
						carbs: 16.3,
						protein: 8.7,
						fat: 0.5,
						fiber: 7.4,
						wheelOfFive: WheelOfFiveCategory.proteinAndDairy,
						countryOfOrigin: { en: 'Peru', nl: 'Peru' }
					},
					{
						name: { en: 'Chestnuts', nl: 'Kastanjes' },
						emoji: { default: '🌰' },
						calories: 213,
						averagePrice: 1.1,
						carbs: 45.5,
						protein: 2.4,
						fat: 2.3,
						fiber: 8.1,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Turkey', nl: 'Turkije' }
					},
					{
						name: { en: 'Ginger', nl: 'Gember' },
						emoji: { default: '🫚' },
						calories: 80,
						averagePrice: 0.95,
						carbs: 17.8,
						protein: 1.8,
						fat: 0.8,
						fiber: 2,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'China', nl: 'China' }
					},
					{
						name: { en: 'Green peas', nl: 'Doperwten' },
						emoji: { default: '🫛' },
						calories: 65,
						averagePrice: 0.35,
						carbs: 10,
						protein: 4,
						fat: 0,
						fiber: 4.7,
						wheelOfFive: WheelOfFiveCategory.proteinAndDairy,
						countryOfOrigin: { en: 'Turkey', nl: 'Turkije' }
					},
					{
						name: { en: 'Brown mushroom', nl: 'Kastanjechampignon' },
						emoji: { default: '🍄‍🟫' },
						calories: 22,
						averagePrice: 0.65,
						carbs: 3.3,
						protein: 3.1,
						fat: 0.3,
						fiber: 1,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'France', nl: 'Frankrijk' }
					},
					{
						name: { en: 'Beetroot', nl: 'Rode biet' },
						emoji: { default: '🫜' },
						calories: 43,
						averagePrice: 0.25,
						carbs: 8,
						protein: 1.6,
						fat: 0.2,
						fiber: 2.8,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'Italy', nl: 'Italië' }
					},
					{
						name: { en: 'Bread', nl: 'Brood' },
						emoji: { default: '🍞' },
						calories: 231,
						averagePrice: 0.3,
						carbs: 35.6,
						protein: 10.6,
						fat: 3,
						fiber: 9.8,
						wheelOfFive: WheelOfFiveCategory.breadsGrainsAndPotatoes,
						countryOfOrigin: { en: 'Egypt', nl: 'Egypte' }
					},
					{
						name: { en: 'Croissant', nl: 'Croissant' },
						emoji: { default: '🥐' },
						calories: 406,
						averagePrice: 0.9,
						carbs: 45.8,
						protein: 8.2,
						fat: 21,
						fiber: 2.6,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Austria', nl: 'Oostenrijk' }
					},
					{
						name: { en: 'Baguette', nl: 'Stokbrood' },
						emoji: { default: '🥖' },
						calories: 274,
						averagePrice: 0.35,
						carbs: 53,
						protein: 8.7,
						fat: 2.4,
						fiber: 2.9,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'France', nl: 'Frankrijk' }
					},
					{
						name: { en: 'Flatbread', nl: 'Platbrood' },
						emoji: { default: '🫓' },
						calories: 275,
						averagePrice: 0.45,
						carbs: 55,
						protein: 9,
						fat: 1.2,
						fiber: 2.2,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Lebanon', nl: 'Libanon' }
					},
					{
						name: { en: 'Pretzel', nl: 'Pretzel' },
						emoji: { default: '🥨' },
						calories: 380,
						averagePrice: 0.7,
						carbs: 74,
						protein: 10,
						fat: 4,
						fiber: 3,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Germany', nl: 'Duitsland' }
					},
					{
						name: { en: 'Bagel', nl: 'Bagel' },
						emoji: { default: '🥯' },
						calories: 250,
						averagePrice: 0.8,
						carbs: 48,
						protein: 10,
						fat: 1.5,
						fiber: 2.3,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Poland', nl: 'Polen' }
					},
					{
						name: { en: 'Pancake', nl: 'Pannenkoek' },
						emoji: { default: '🥞' },
						calories: 227,
						averagePrice: 0.55,
						carbs: 28,
						protein: 6.4,
						fat: 10,
						fiber: 1,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Netherlands', nl: 'Nederland' }
					},
					{
						name: { en: 'Waffle', nl: 'Wafel' },
						emoji: { default: '🧇' },
						calories: 291,
						averagePrice: 0.75,
						carbs: 33,
						protein: 7.9,
						fat: 14,
						fiber: 1.4,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Belgium', nl: 'België' }
					},
					{
						name: { en: 'Gouda cheese', nl: 'Goudse kaas' },
						emoji: { default: '🧀' },
						calories: 369,
						averagePrice: 1.2,
						carbs: 0,
						protein: 22.9,
						fat: 30.5,
						fiber: 0,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Netherlands', nl: 'Nederland' }
					},
					{
						name: { en: 'Pork chop', nl: 'Varkenskotelet' },
						emoji: { default: '🍖' },
						calories: 242,
						averagePrice: 1.1,
						carbs: 0,
						protein: 27,
						fat: 15,
						fiber: 0,
						wheelOfFive: WheelOfFiveCategory.proteinAndDairy,
						countryOfOrigin: { en: 'Germany', nl: 'Duitsland' }
					},
					{
						name: { en: 'Chicken leg', nl: 'Kippenbout' },
						emoji: { default: '🍗' },
						calories: 215,
						averagePrice: 0.85,
						carbs: 0,
						protein: 27,
						fat: 12,
						fiber: 0,
						wheelOfFive: WheelOfFiveCategory.proteinAndDairy,
						countryOfOrigin: { en: 'India', nl: 'India' }
					},
					{
						name: { en: 'Beef steak', nl: 'Biefstuk' },
						emoji: { default: '🥩' },
						calories: 250,
						averagePrice: 2.2,
						carbs: 0,
						protein: 26,
						fat: 17,
						fiber: 0,
						wheelOfFive: WheelOfFiveCategory.proteinAndDairy,
						countryOfOrigin: { en: 'United States of America', nl: 'Verenigde Staten' }
					},
					{
						name: { en: 'Bacon', nl: 'Spek' },
						emoji: { default: '🥓' },
						calories: 541,
						averagePrice: 1.35,
						carbs: 1.4,
						protein: 37,
						fat: 42,
						fiber: 0,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'United Kingdom', nl: 'Verenigd Koninkrijk' }
					},
					{
						name: { en: 'Hamburger', nl: 'Hamburger' },
						emoji: { default: '🍔' },
						calories: 295,
						averagePrice: 1,
						carbs: 24,
						protein: 17,
						fat: 15,
						fiber: 1.3,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'United States of America', nl: 'Verenigde Staten' }
					},
					{
						name: { en: 'French fries', nl: 'Friet' },
						emoji: { default: '🍟' },
						calories: 312,
						averagePrice: 0.55,
						carbs: 41,
						protein: 3.4,
						fat: 15,
						fiber: 3.8,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Belgium', nl: 'België' }
					},
					{
						name: { en: 'Pizza', nl: 'Pizza' },
						emoji: { default: '🍕' },
						calories: 221,
						averagePrice: 0.95,
						carbs: 27.4,
						protein: 8.5,
						fat: 8.2,
						fiber: 1.8,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Italy', nl: 'Italië' }
					},
					{
						name: { en: 'Hot dog', nl: 'Hotdog' },
						emoji: { default: '🌭' },
						calories: 290,
						averagePrice: 0.85,
						carbs: 24,
						protein: 11,
						fat: 17,
						fiber: 1,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Germany', nl: 'Duitsland' }
					},
					{
						name: { en: 'Sandwich', nl: 'Sandwich' },
						emoji: { default: '🥪' },
						calories: 250,
						averagePrice: 0.9,
						carbs: 30,
						protein: 12,
						fat: 9,
						fiber: 2,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'United Kingdom', nl: 'Verenigd Koninkrijk' }
					},
					{
						name: { en: 'Taco', nl: 'Taco' },
						emoji: { default: '🌮' },
						calories: 226,
						averagePrice: 1.1,
						carbs: 20,
						protein: 9,
						fat: 12,
						fiber: 3,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Mexico', nl: 'Mexico' }
					},
					{
						name: { en: 'Burrito', nl: 'Burrito' },
						emoji: { default: '🌯' },
						calories: 206,
						averagePrice: 0.95,
						carbs: 26,
						protein: 8,
						fat: 8,
						fiber: 3,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Mexico', nl: 'Mexico' }
					},
					{
						name: { en: 'Tamale', nl: 'Tamale' },
						emoji: { default: '🫔' },
						calories: 153,
						averagePrice: 0.85,
						carbs: 18,
						protein: 7,
						fat: 6,
						fiber: 2,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Mexico', nl: 'Mexico' }
					},
					{
						name: { en: 'Falafel pita', nl: 'Pitabroodje met falafel' },
						emoji: { default: '🥙' },
						calories: 240,
						averagePrice: 0.85,
						carbs: 35,
						protein: 9,
						fat: 8,
						fiber: 6,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Lebanon', nl: 'Libanon' }
					},
					{
						name: { en: 'Falafel', nl: 'Falafel' },
						emoji: { default: '🧆' },
						calories: 333,
						averagePrice: 0.95,
						carbs: 31.8,
						protein: 13.3,
						fat: 17.8,
						fiber: 4.9,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Egypt', nl: 'Egypte' }
					},
					{
						name: { en: 'Boiled egg', nl: 'Gekookt ei' },
						emoji: { default: '🥚' },
						calories: 155,
						averagePrice: 0.55,
						carbs: 1.1,
						protein: 12.6,
						fat: 10.6,
						fiber: 0,
						wheelOfFive: WheelOfFiveCategory.proteinAndDairy,
						countryOfOrigin: { en: 'India', nl: 'India' }
					},
					{
						name: { en: 'Fried egg', nl: 'Gebakken ei' },
						emoji: { default: '🍳' },
						calories: 196,
						averagePrice: 0.6,
						carbs: 0.8,
						protein: 13.6,
						fat: 15.3,
						fiber: 0,
						wheelOfFive: WheelOfFiveCategory.proteinAndDairy,
						countryOfOrigin: { en: 'United States of America', nl: 'Verenigde Staten' }
					},
					{
						name: { en: 'Paella', nl: 'Paella' },
						emoji: { default: '🥘' },
						calories: 158,
						averagePrice: 1.1,
						carbs: 19,
						protein: 7,
						fat: 5,
						fiber: 1.4,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Spain', nl: 'Spanje' }
					},
					{
						name: { en: 'Beef stew', nl: 'Runderstoofpot' },
						emoji: { default: '🍲' },
						calories: 125,
						averagePrice: 1.05,
						carbs: 8,
						protein: 10,
						fat: 6,
						fiber: 2,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'France', nl: 'Frankrijk' }
					},
					{
						name: { en: 'Cheese fondue', nl: 'Kaasfondue' },
						emoji: { default: '🫕' },
						calories: 229,
						averagePrice: 1.45,
						carbs: 2.5,
						protein: 14,
						fat: 18,
						fiber: 0,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Switzerland', nl: 'Zwitserland' }
					},
					{
						name: { en: 'Breakfast cereal', nl: 'Ontbijtgranen' },
						emoji: { default: '🥣' },
						calories: 370,
						averagePrice: 0.55,
						carbs: 74,
						protein: 8,
						fat: 4,
						fiber: 8,
						wheelOfFive: WheelOfFiveCategory.breadsGrainsAndPotatoes,
						countryOfOrigin: { en: 'United States of America', nl: 'Verenigde Staten' }
					},
					{
						name: { en: 'Mixed salad', nl: 'Gemengde salade' },
						emoji: { default: '🥗' },
						calories: 45,
						averagePrice: 0.8,
						carbs: 6,
						protein: 2,
						fat: 2,
						fiber: 3,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'Italy', nl: 'Italië' }
					},
					{
						name: { en: 'Popcorn', nl: 'Popcorn' },
						emoji: { default: '🍿' },
						calories: 374,
						averagePrice: 0.4,
						carbs: 71,
						protein: 11,
						fat: 4,
						fiber: 5,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Mexico', nl: 'Mexico' }
					},
					{
						name: { en: 'Butter', nl: 'Boter' },
						emoji: { default: '🧈' },
						calories: 717,
						averagePrice: 1.15,
						carbs: 0.1,
						protein: 0.9,
						fat: 81.1,
						fiber: 0,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'France', nl: 'Frankrijk' }
					},
					{
						name: { en: 'Salt', nl: 'Zout' },
						emoji: { default: '🧂' },
						calories: 0,
						averagePrice: 0.08,
						carbs: 0,
						protein: 0,
						fat: 0,
						fiber: 0,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Austria', nl: 'Oostenrijk' }
					},
					{
						name: { en: 'Canned tomatoes', nl: 'Tomaten uit blik' },
						emoji: { default: '🥫' },
						calories: 24,
						averagePrice: 0.2,
						carbs: 3.7,
						protein: 1.1,
						fat: 0.4,
						fiber: 0.7,
						wheelOfFive: WheelOfFiveCategory.vegetablesAndFruit,
						countryOfOrigin: { en: 'Italy', nl: 'Italië' }
					},
					{
						name: { en: 'Bento', nl: 'Bento' },
						emoji: { default: '🍱' },
						calories: 170,
						averagePrice: 1.4,
						carbs: 25,
						protein: 7,
						fat: 5,
						fiber: 2,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Japan', nl: 'Japan' }
					},
					{
						name: { en: 'Rice cracker', nl: 'Rijstcracker' },
						emoji: { default: '🍘' },
						calories: 387,
						averagePrice: 0.85,
						carbs: 82,
						protein: 7,
						fat: 2.8,
						fiber: 2,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Japan', nl: 'Japan' }
					},
					{
						name: { en: 'Rice ball', nl: 'Onigiri' },
						emoji: { default: '🍙' },
						calories: 180,
						averagePrice: 0.9,
						carbs: 37,
						protein: 3.5,
						fat: 1,
						fiber: 1,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Japan', nl: 'Japan' }
					},
					{
						name: { en: 'White rice', nl: 'Witte rijst' },
						emoji: { default: '🍚' },
						calories: 146,
						averagePrice: 0.2,
						carbs: 32.3,
						protein: 3.2,
						fat: 0.3,
						fiber: 0.7,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'China', nl: 'China' }
					},
					{
						name: { en: 'Curry rice', nl: 'Curryrijst' },
						emoji: { default: '🍛' },
						calories: 160,
						averagePrice: 0.75,
						carbs: 24,
						protein: 4,
						fat: 5,
						fiber: 1.5,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Japan', nl: 'Japan' }
					},
					{
						name: { en: 'Ramen', nl: 'Ramen' },
						emoji: { default: '🍜' },
						calories: 188,
						averagePrice: 0.85,
						carbs: 27,
						protein: 5,
						fat: 7,
						fiber: 1.5,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Japan', nl: 'Japan' }
					},
					{
						name: { en: 'Spaghetti', nl: 'Spaghetti' },
						emoji: { default: '🍝' },
						calories: 142,
						averagePrice: 0.35,
						carbs: 27.7,
						protein: 5.1,
						fat: 0.9,
						fiber: 1.4,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Italy', nl: 'Italië' }
					},
					{
						name: { en: 'Sweet potato', nl: 'Zoete aardappel' },
						emoji: { default: '🍠' },
						calories: 94,
						averagePrice: 0.35,
						carbs: 21,
						protein: 1.1,
						fat: 0.3,
						fiber: 3,
						wheelOfFive: WheelOfFiveCategory.breadsGrainsAndPotatoes,
						countryOfOrigin: { en: 'Peru', nl: 'Peru' }
					},
					{
						name: { en: 'Oden', nl: 'Oden' },
						emoji: { default: '🍢' },
						calories: 95,
						averagePrice: 1,
						carbs: 10,
						protein: 7,
						fat: 3,
						fiber: 1,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Japan', nl: 'Japan' }
					},
					{
						name: { en: 'Sushi', nl: 'Sushi' },
						emoji: { default: '🍣' },
						calories: 150,
						averagePrice: 1.8,
						carbs: 28,
						protein: 5,
						fat: 2,
						fiber: 1,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Japan', nl: 'Japan' }
					},
					{
						name: { en: 'Fried shrimp', nl: 'Gefrituurde garnaal' },
						emoji: { default: '🍤' },
						calories: 245,
						averagePrice: 1.8,
						carbs: 20,
						protein: 12,
						fat: 13,
						fiber: 1,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Japan', nl: 'Japan' }
					},
					{
						name: { en: 'Fish cake', nl: 'Viskoekje' },
						emoji: { default: '🍥' },
						calories: 95,
						averagePrice: 1.1,
						carbs: 13,
						protein: 8,
						fat: 0.8,
						fiber: 0.5,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Japan', nl: 'Japan' }
					},
					{
						name: { en: 'Mooncake', nl: 'Maancake' },
						emoji: { default: '🥮' },
						calories: 400,
						averagePrice: 1.6,
						carbs: 58,
						protein: 8,
						fat: 16,
						fiber: 2,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'China', nl: 'China' }
					},
					{
						name: { en: 'Dango', nl: 'Dango' },
						emoji: { default: '🍡' },
						calories: 187,
						averagePrice: 1.1,
						carbs: 44,
						protein: 3,
						fat: 0.5,
						fiber: 1,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Japan', nl: 'Japan' }
					},
					{
						name: { en: 'Dumplings', nl: 'Dumplings' },
						emoji: { default: '🥟' },
						calories: 220,
						averagePrice: 1.2,
						carbs: 30,
						protein: 9,
						fat: 7,
						fiber: 2,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'China', nl: 'China' }
					},
					{
						name: { en: 'Fortune cookie', nl: 'Gelukskoekje' },
						emoji: { default: '🥠' },
						calories: 378,
						averagePrice: 1,
						carbs: 84,
						protein: 4,
						fat: 4,
						fiber: 1,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'United States of America', nl: 'Verenigde Staten' }
					},
					{
						name: { en: 'Chinese takeout noodles', nl: 'Chinese afhaalnoedels' },
						emoji: { default: '🥡' },
						calories: 180,
						averagePrice: 0.95,
						carbs: 27,
						protein: 6,
						fat: 6,
						fiber: 2,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'United States of America', nl: 'Verenigde Staten' }
					},
					{
						name: { en: 'Crab', nl: 'Krab' },
						emoji: { default: '🦀' },
						calories: 97,
						averagePrice: 2.5,
						carbs: 0,
						protein: 19,
						fat: 0.9,
						fiber: 0,
						wheelOfFive: WheelOfFiveCategory.proteinAndDairy,
						countryOfOrigin: { en: 'Japan', nl: 'Japan' }
					},
					{
						name: { en: 'Lobster', nl: 'Kreeft' },
						emoji: { default: '🦞' },
						calories: 89,
						averagePrice: 3.8,
						carbs: 0,
						protein: 19,
						fat: 0.9,
						fiber: 0,
						wheelOfFive: WheelOfFiveCategory.proteinAndDairy,
						countryOfOrigin: { en: 'Canada', nl: 'Canada' }
					},
					{
						name: { en: 'Prawns', nl: 'Garnalen' },
						emoji: { default: '🦐' },
						calories: 99,
						averagePrice: 2.2,
						carbs: 0.2,
						protein: 24,
						fat: 0.3,
						fiber: 0,
						wheelOfFive: WheelOfFiveCategory.proteinAndDairy,
						countryOfOrigin: { en: 'Thailand', nl: 'Thailand' }
					},
					{
						name: { en: 'Squid', nl: 'Inktvis' },
						emoji: { default: '🦑' },
						calories: 92,
						averagePrice: 1.8,
						carbs: 3.1,
						protein: 15.6,
						fat: 1.4,
						fiber: 0,
						wheelOfFive: WheelOfFiveCategory.proteinAndDairy,
						countryOfOrigin: { en: 'Japan', nl: 'Japan' }
					},
					{
						name: { en: 'Oyster', nl: 'Oester' },
						emoji: { default: '🦪' },
						calories: 68,
						averagePrice: 2.7,
						carbs: 3.9,
						protein: 7,
						fat: 2.5,
						fiber: 0,
						wheelOfFive: WheelOfFiveCategory.proteinAndDairy,
						countryOfOrigin: { en: 'France', nl: 'Frankrijk' }
					},
					{
						name: { en: 'Soft serve ice cream', nl: 'Softijs' },
						emoji: { default: '🍦' },
						calories: 207,
						averagePrice: 0.65,
						carbs: 24,
						protein: 3.5,
						fat: 11,
						fiber: 0.7,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'United States of America', nl: 'Verenigde Staten' }
					},
					{
						name: { en: 'Doughnut', nl: 'Donut' },
						emoji: { default: '🍩' },
						calories: 358,
						averagePrice: 0.8,
						carbs: 35.5,
						protein: 6,
						fat: 21.1,
						fiber: 1.1,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'United States of America', nl: 'Verenigde Staten' }
					},
					{
						name: { en: 'Cookie', nl: 'Koekje' },
						emoji: { default: '🍪' },
						calories: 480,
						averagePrice: 0.75,
						carbs: 64,
						protein: 6,
						fat: 22,
						fiber: 2,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'United States of America', nl: 'Verenigde Staten' }
					},
					{
						name: { en: 'Milk chocolate', nl: 'Melkchocolade' },
						emoji: { default: '🍫' },
						calories: 535,
						averagePrice: 1.1,
						carbs: 59,
						protein: 7.3,
						fat: 30,
						fiber: 3.4,
						wheelOfFive: WheelOfFiveCategory.none,
						countryOfOrigin: { en: 'Switzerland', nl: 'Zwitserland' }
					}
				]
			}
		] as const;

		if (!clientId?.length)
			clientId = (
				await trx
					.selectFrom('client')
					.where('client.slug', '=', DEFAULT_CLIENT_SLUG)
					.select('client.id')
					.executeTakeFirstOrThrow()
			).id;

		const taxonomy = await trx
			.insertInto('taxonomy')
			.values({
				clientId,
				name: taxonomyName,
				description: 'Demo taxonomy with foods and Schijf van Vijf classifications'
			})
			.returning('id')
			.executeTakeFirstOrThrow();
		const taxonomyId = taxonomy.id;

		const categories = await trx
			.insertInto('category')
			.values(
				categoryDefinitions.map((category) => {
					const map = getCategoryMap(category.name.en);

					return {
						taxonomyId,
						name: JSON.stringify(category.name),
						description: category.description ? JSON.stringify(category.description) : null,
						map: map ? JSON.stringify(map) : null
					};
				})
			)
			.returning('id')
			.execute();

		const categoryIdsByReference = Object.fromEntries(
			categoryDefinitions.map((category, index) => [category.name.en, categories[index].id])
		);

		const attributes = {} as Record<
			keyof typeof attributeDefinitions,
			{ id: string; type: AttributeType }
		>;
		for (const [slug, attribute] of Object.entries(attributeDefinitions)) {
			const referencedCategoryReference =
				'referencedCategoryReference' in attribute &&
				typeof attribute.referencedCategoryReference === 'string'
					? attribute.referencedCategoryReference
					: null;

			attributes[slug as keyof typeof attributeDefinitions] = await trx
				.insertInto('attribute')
				.values({
					taxonomyId,
					slug,
					name: JSON.stringify(attribute.name as Translatable),
					description: JSON.stringify(attribute.description as Translatable),
					type: attribute.type,
					referencedCategoryId: referencedCategoryReference
						? categoryIdsByReference[referencedCategoryReference]
						: null
				})
				.returning(['id', 'type'])
				.executeTakeFirstOrThrow();
		}

		const itemIdsByCategoryAndName = {} as Record<string, Record<string, string>>;

		for (const [index, category] of categoryDefinitions.entries()) {
			const categoryId = categories[index].id;
			const categoryName = category.name.en;
			if (!categoryName) throw new Error('Category name is required');
			itemIdsByCategoryAndName[categoryName] = {};

			await trx
				.insertInto('attributeOfCategory')
				.values(
					category.attributes.map((attributeReference, order) => ({
						categoryId,
						attributeId: attributes[attributeReference].id,
						order,
						isRequired: true,
						isDefault: attributeReference === 'name' || attributeReference === 'emoji'
					}))
				)
				.execute();

			for (const itemDefinition of category.items) {
				const item = await trx
					.insertInto('item')
					.values({ taxonomyId })
					.returning('id')
					.executeTakeFirstOrThrow();

				await trx.insertInto('itemOfCategory').values({ itemId: item.id, categoryId }).execute();

				const itemName = itemDefinition.name.en;
				if (!itemName) throw new Error('Item name is required');
				itemIdsByCategoryAndName[categoryName][itemName] = item.id;
			}
		}

		for (const category of categoryDefinitions) {
			const categoryName = category.name.en;
			if (!categoryName) throw new Error('Category name is required');

			for (const itemDefinition of category.items) {
				const itemName = itemDefinition.name.en;
				if (!itemName) throw new Error('Item name is required');
				const itemId = itemIdsByCategoryAndName[categoryName][itemName];

				for (const [reference, value] of Object.entries(itemDefinition)) {
					const attribute = attributes[reference as keyof typeof attributes];
					if (!attribute) throw new Error(`Unknown attribute reference: ${reference}`);
					let referencedItemId: string | null = null;

					if (attribute.type === AttributeType.itemReference) {
						if (!value || typeof value !== 'string') {
							throw new Error(`Missing reference value for ${reference}`);
						}

						referencedItemId = itemIdsByCategoryAndName['Schijf van Vijf'][value] ?? null;
						if (!referencedItemId) throw new Error(`Unknown reference: ${value}`);
					}

					await trx
						.insertInto('attributeOfItem')
						.values({
							itemId,
							attributeId: attribute.id,
							value: referencedItemId ? null : JSON.stringify(value),
							referencedItemId
						})
						.execute();
				}
			}
		}
	});
};

function wheelOfFiveCategoriesWithLabels() {
	return Object.values(WheelOfFiveCategory).map((category) => ({
		name: wheelOfFiveLabels[category],
		color: getWheelOfFiveColor(category),
		icons: wheelOfFiveIcons[category],
		shape: getWheelOfFiveShape(category),
		center: getWheelOfFiveCenter(category)
	}));
}
