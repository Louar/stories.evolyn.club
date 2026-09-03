import { DEFAULT_CLIENT_SLUG } from '$app/env/private';
import worldCountryElements from '$lib/assets/world-countries/elements.json';
import worldCountryMap from '$lib/assets/world-countries/map.json';
import { db } from '$lib/db/database';
import type { Translatable } from '$lib/db/schemas/0-utils';
import { AttributeType } from '$lib/db/schemas/2-story-module';

type WorldCountryGeometry = {
	arcs?: unknown;
	id?: string;
	properties: { name: string };
	type: string;
};

type WorldCountryTopology = {
	arcs: unknown[];
	bbox?: number[];
	objects: { countries: { geometries: WorldCountryGeometry[]; type: string } };
	transform?: unknown;
	type: 'Topology';
};

type WorldCountryElement = {
	color?: number;
};

const rawWorldCountryMap = worldCountryMap as WorldCountryTopology;
const rawWorldCountryElements = worldCountryElements as Record<string, WorldCountryElement>;
const worldCountryGeometriesByName = new Map(
	rawWorldCountryMap.objects.countries.geometries.map((geometry) => [
		geometry.properties.name,
		geometry
	])
);

const countryColors = [
	'var(--game-region-blue)',
	'var(--game-warning)',
	'var(--game-success)',
	'var(--game-danger)'
] as const;

function getCategoryMap(categoryName: string) {
	if (categoryName !== 'Countries') return null;

	return {
		type: 'topojson',
		object: 'countries',
		projection: 'naturalEarth',
		showLabels: false,
		topology: rawWorldCountryMap
	};
}

function getCountryShape(countryName: string) {
	const geometry = worldCountryGeometriesByName.get(countryName);
	if (!geometry) return null;

	return geometry.arcs;
}

function getCountryColor(countryName: string) {
	const color = rawWorldCountryElements[countryName]?.color;
	return typeof color === 'number' ? (countryColors[color] ?? countryColors[0]) : countryColors[0];
}

export const DummyDataGeneralTaxonomy = async (
	taxonomySlug = 'general-taxonomy',
	taxonomyName = 'General taxonomy',
	clientId?: string
) => {
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
				type: AttributeType.itemReference,
				referencedCategoryReference: 'Countries'
			},
			population: {
				name: { en: 'Population', nl: 'Bevolking' },
				description: {
					en: 'Population count',
					nl: 'Aantal inwoners'
				},
				type: AttributeType.number
			},
			continent: {
				name: { en: 'Continent', nl: 'Continent' },
				description: {
					en: 'Continent the country belongs to',
					nl: 'Continent waartoe het land behoort'
				},
				type: AttributeType.translatable
			},
			center: {
				name: { en: 'Center', nl: 'Middelpunt' },
				description: {
					en: 'Map center formatted as longitude, latitude',
					nl: 'Kaartmiddelpunt geformatteerd als lengtegraad, breedtegraad'
				},
				type: AttributeType.translatable
			},
			color: {
				name: { en: 'Color', nl: 'Kleur' },
				description: {
					en: 'CSS color used to fill this item on a map',
					nl: 'CSS-kleur waarmee dit item op een kaart wordt gevuld'
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
			}
		} as const;

		const categoryDefinitions = [
			{
				name: { en: 'Countries', nl: 'Landen' },
				description: {
					en: 'Countries and territories from the map dataset',
					nl: 'Landen en gebieden uit de kaartdataset'
				},
				attributes: ['name', 'emoji', 'population', 'continent', 'center', 'color', 'shape'],
				items: [
					{
						name: { en: 'Andorra', nl: 'Andorra' },
						emoji: { default: '🇦🇩' },
						population: 88306,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'United Arab Emirates', nl: 'Verenigde Arabische Emiraten' },
						emoji: { default: '🇦🇪' },
						population: 10678556,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Afghanistan', nl: 'Afghanistan' },
						emoji: { default: '🇦🇫' },
						population: 43844000,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Antigua and Barbuda', nl: 'Antigua en Barbuda' },
						emoji: { default: '🇦🇬' },
						population: 103603,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Anguilla', nl: 'Anguilla' },
						emoji: { default: '🇦🇮' },
						population: 16010,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Albania', nl: 'Albanië' },
						emoji: { default: '🇦🇱' },
						population: 2363314,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Armenia', nl: 'Armenië' },
						emoji: { default: '🇦🇲' },
						population: 3081100,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Angola', nl: 'Angola' },
						emoji: { default: '🇦🇴' },
						population: 36170961,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Argentina', nl: 'Argentinië' },
						emoji: { default: '🇦🇷' },
						population: 46735004,
						continent: { en: 'South America', nl: 'Zuid-Amerika' }
					},
					{
						name: { en: 'American Samoa', nl: 'Amerikaans-Samoa' },
						emoji: { default: '🇦🇸' },
						population: 49710,
						continent: { en: 'Oceania', nl: 'Oceanië' }
					},
					{
						name: { en: 'Austria', nl: 'Oostenrijk' },
						emoji: { default: '🇦🇹' },
						population: 9200931,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Australia', nl: 'Australië' },
						emoji: { default: '🇦🇺' },
						population: 27400013,
						continent: { en: 'Oceania', nl: 'Oceanië' },
						center: [133.47670515346655, -23.802641786690405]
					},
					{
						name: { en: 'Aruba', nl: 'Aruba' },
						emoji: { default: '🇦🇼' },
						population: 107566,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Azerbaijan', nl: 'Azerbeidzjan' },
						emoji: { default: '🇦🇿' },
						population: 10241722,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Bosnia and Herzegovina', nl: 'Bosnië en Herzegovina' },
						emoji: { default: '🇧🇦' },
						population: 3422000,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Barbados', nl: 'Barbados' },
						emoji: { default: '🇧🇧' },
						population: 267800,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Bangladesh', nl: 'Bangladesh' },
						emoji: { default: '🇧🇩' },
						population: 169828911,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Belgium', nl: 'België' },
						emoji: { default: '🇧🇪' },
						population: 11825551,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Burkina Faso', nl: 'Burkina Faso' },
						emoji: { default: '🇧🇫' },
						population: 24070553,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Bulgaria', nl: 'Bulgarije' },
						emoji: { default: '🇧🇬' },
						population: 6437360,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Bahrain', nl: 'Bahrein' },
						emoji: { default: '🇧🇭' },
						population: 1594654,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Burundi', nl: 'Burundi' },
						emoji: { default: '🇧🇮' },
						population: 12332788,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Benin', nl: 'Benin' },
						emoji: { default: '🇧🇯' },
						population: 13224860,
						continent: { en: 'Africa', nl: 'Afrika' },
						center: [2.172378097907435, 8.85544250828145]
					},
					{
						name: { en: 'Bermuda', nl: 'Bermuda' },
						emoji: { default: '🇧🇲' },
						population: 64055,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Bolivia', nl: 'Bolivia' },
						emoji: { default: '🇧🇴' },
						population: 11312620,
						continent: { en: 'South America', nl: 'Zuid-Amerika' }
					},
					{
						name: { en: 'Brazil', nl: 'Brazilië' },
						emoji: { default: '🇧🇷' },
						population: 213421037,
						continent: { en: 'South America', nl: 'Zuid-Amerika' }
					},
					{
						name: { en: 'Bhutan', nl: 'Bhutan' },
						emoji: { default: '🇧🇹' },
						population: 784043,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Botswana', nl: 'Botswana' },
						emoji: { default: '🇧🇼' },
						population: 2359609,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Belarus', nl: 'Belarus' },
						emoji: { default: '🇧🇾' },
						population: 9109280,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Belize', nl: 'Belize' },
						emoji: { default: '🇧🇿' },
						population: 417634,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Canada', nl: 'Canada' },
						emoji: { default: '🇨🇦' },
						population: 41548787,
						continent: { en: 'North America', nl: 'Noord-Amerika' },
						center: [-105.70728654359463, 58.48437067755612]
					},
					{
						name: { en: 'Central African Republic', nl: 'Centraal-Afrikaanse Republiek' },
						emoji: { default: '🇨🇫' },
						population: 6470307,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Switzerland', nl: 'Zwitserland' },
						emoji: { default: '🇨🇭' },
						population: 9082848,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Cook Islands', nl: 'Cookeilanden' },
						emoji: { default: '🇨🇰' },
						population: 15040,
						continent: { en: 'Oceania', nl: 'Oceanië' }
					},
					{
						name: { en: 'Chile', nl: 'Chili' },
						emoji: { default: '🇨🇱' },
						population: 20206953,
						continent: { en: 'South America', nl: 'Zuid-Amerika' },
						center: [-70.76867620861314, -28.81400028445949]
					},
					{
						name: { en: 'Cameroon', nl: 'Kameroen' },
						emoji: { default: '🇨🇲' },
						population: 29442327,
						continent: { en: 'Africa', nl: 'Afrika' },
						center: [12.401950934239693, 4.997120863908812]
					},
					{
						name: { en: 'China', nl: 'China' },
						emoji: { default: '🇨🇳' },
						population: 1408280000,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Colombia', nl: 'Colombia' },
						emoji: { default: '🇨🇴' },
						population: 53057212,
						continent: { en: 'South America', nl: 'Zuid-Amerika' }
					},
					{
						name: { en: 'Costa Rica', nl: 'Costa Rica' },
						emoji: { default: '🇨🇷' },
						population: 5309625,
						continent: { en: 'North America', nl: 'Noord-Amerika' },
						center: [-83.9941012302606, 9.99734217084615]
					},
					{
						name: { en: 'Cuba', nl: 'Cuba' },
						emoji: { default: '🇨🇺' },
						population: 9748007,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Cape Verde', nl: 'Kaapverdië' },
						emoji: { default: '🇨🇻' },
						population: 491233,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Curaçao', nl: 'Curaçao' },
						emoji: { default: '🇨🇼' },
						population: 156115,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Cyprus', nl: 'Cyprus' },
						emoji: { default: '🇨🇾' },
						population: 966400,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Czech Republic', nl: 'Tsjechië' },
						emoji: { default: '🇨🇿' },
						population: 10876875,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Germany', nl: 'Duitsland' },
						emoji: { default: '🇩🇪' },
						population: 83517030,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Djibouti', nl: 'Djibouti' },
						emoji: { default: '🇩🇯' },
						population: 1066809,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Denmark', nl: 'Denemarken' },
						emoji: { default: '🇩🇰' },
						population: 6004342,
						continent: { en: 'Europe', nl: 'Europa' },
						center: [9.335752921550553, 55.97380721039201]
					},
					{
						name: { en: 'Dominica', nl: 'Dominica' },
						emoji: { default: '🇩🇲' },
						population: 67408,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Dominican Republic', nl: 'Dominicaanse Republiek' },
						emoji: { default: '🇩🇴' },
						population: 10771504,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Algeria', nl: 'Algerije' },
						emoji: { default: '🇩🇿' },
						population: 47400000,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Ecuador', nl: 'Ecuador' },
						emoji: { default: '🇪🇨' },
						population: 18103660,
						continent: { en: 'South America', nl: 'Zuid-Amerika' },
						center: [-78.62946370514271, -1.214686887656204]
					},
					{
						name: { en: 'Estonia', nl: 'Estland' },
						emoji: { default: '🇪🇪' },
						population: 1369995,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Egypt', nl: 'Egypte' },
						emoji: { default: '🇪🇬' },
						population: 107271260,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Western Sahara', nl: 'Westelijke Sahara' },
						emoji: { default: '🇪🇭' },
						population: 600904,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Eritrea', nl: 'Eritrea' },
						emoji: { default: '🇪🇷' },
						population: 3607000,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Spain', nl: 'Spanje' },
						emoji: { default: '🇪🇸' },
						population: 49315949,
						continent: { en: 'Europe', nl: 'Europa' },
						center: [-3.0717044174509396, 40.424401294661195]
					},
					{
						name: { en: 'Ethiopia', nl: 'Ethiopië' },
						emoji: { default: '🇪🇹' },
						population: 111652998,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Finland', nl: 'Finland' },
						emoji: { default: '🇫🇮' },
						population: 5645651,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Fiji', nl: 'Fiji' },
						emoji: { default: '🇫🇯' },
						population: 900869,
						continent: { en: 'Oceania', nl: 'Oceanië' },
						center: [177.99382674530062, -17.79562720702393]
					},
					{
						name: { en: 'Faeroe Islands', nl: 'Faeröer' },
						emoji: { default: '🇫🇴' },
						population: 55146,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'France', nl: 'Frankrijk' },
						emoji: { default: '🇫🇷' },
						population: 68688000,
						continent: { en: 'Europe', nl: 'Europa' },
						center: [2.66231112736339, 47.03617643043381]
					},
					{
						name: { en: 'Gabon', nl: 'Gabon' },
						emoji: { default: '🇬🇦' },
						population: 2469296,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'United Kingdom', nl: 'Verenigd Koninkrijk' },
						emoji: { default: '🇬🇧' },
						population: 68265209,
						continent: { en: 'Europe', nl: 'Europa' },
						center: [-1.7925572146753699, 53.47866617698413]
					},
					{
						name: { en: 'Grenada', nl: 'Grenada' },
						emoji: { default: '🇬🇩' },
						population: 109021,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Georgia', nl: 'Georgië' },
						emoji: { default: '🇬🇪' },
						population: 3704500,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Guernsey', nl: 'Guernsey' },
						emoji: { default: '🇬🇬' },
						population: 64781,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Ghana', nl: 'Ghana' },
						emoji: { default: '🇬🇭' },
						population: 33742380,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Gibraltar', nl: 'Gibraltar' },
						emoji: { default: '🇬🇮' },
						population: 38000,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Greenland', nl: 'Groenland' },
						emoji: { default: '🇬🇱' },
						population: 56542,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Gambia', nl: 'Gambia' },
						emoji: { default: '🇬🇲' },
						population: 2422712,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Guinea', nl: 'Guinee' },
						emoji: { default: '🇬🇳' },
						population: 14363931,
						continent: { en: 'Africa', nl: 'Afrika' },
						center: [-10.717036643858407, 10.905978767176759]
					},
					{
						name: { en: 'Equatorial Guinea', nl: 'Equatoriaal-Guinea' },
						emoji: { default: '🇬🇶' },
						population: 1668768,
						continent: { en: 'Africa', nl: 'Afrika' },
						center: [10.439171327788834, 1.6017293986379673]
					},
					{
						name: { en: 'Greece', nl: 'Griekenland' },
						emoji: { default: '🇬🇷' },
						population: 10400720,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Guatemala', nl: 'Guatemala' },
						emoji: { default: '🇬🇹' },
						population: 18079810,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Guam', nl: 'Guam' },
						emoji: { default: '🇬🇺' },
						population: 153836,
						continent: { en: 'Oceania', nl: 'Oceanië' }
					},
					{
						name: { en: 'Guinea-Bissau', nl: 'Guinee-Bissau' },
						emoji: { default: '🇬🇼' },
						population: 1781308,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Guyana', nl: 'Guyana' },
						emoji: { default: '🇬🇾' },
						population: 772975,
						continent: { en: 'South America', nl: 'Zuid-Amerika' }
					},
					{
						name: { en: 'Hong Kong', nl: 'Hongkong SAR van China' },
						emoji: { default: '🇭🇰' },
						population: 7527500,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Honduras', nl: 'Honduras' },
						emoji: { default: '🇭🇳' },
						population: 9892632,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Croatia', nl: 'Kroatië' },
						emoji: { default: '🇭🇷' },
						population: 3866233,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Haiti', nl: 'Haïti' },
						emoji: { default: '🇭🇹' },
						population: 11867032,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Hungary', nl: 'Hongarije' },
						emoji: { default: '🇭🇺' },
						population: 9539502,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Indonesia', nl: 'Indonesië' },
						emoji: { default: '🇮🇩' },
						population: 284438782,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Ireland', nl: 'Ierland' },
						emoji: { default: '🇮🇪' },
						population: 5458600,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Israel', nl: 'Israël' },
						emoji: { default: '🇮🇱' },
						population: 10119400,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Isle of Man', nl: 'Isle of Man' },
						emoji: { default: '🇮🇲' },
						population: 84530,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'India', nl: 'India' },
						emoji: { default: '🇮🇳' },
						population: 1417492000,
						continent: { en: 'Asia', nl: 'Azië' },
						center: [79.21957187989874, 22.726114056408363]
					},
					{
						name: { en: 'British Indian Ocean Territory', nl: 'Brits Indische Oceaanterritorium' },
						emoji: { default: '🇮🇴' },
						population: 0,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Iraq', nl: 'Irak' },
						emoji: { default: '🇮🇶' },
						population: 46118793,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Iran', nl: 'Iran' },
						emoji: { default: '🇮🇷' },
						population: 85961000,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Iceland', nl: 'IJsland' },
						emoji: { default: '🇮🇸' },
						population: 391810,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Italy', nl: 'Italië' },
						emoji: { default: '🇮🇹' },
						population: 58919230,
						continent: { en: 'Europe', nl: 'Europa' },
						center: [12.275743711963917, 43.06343709650746]
					},
					{
						name: { en: 'Jersey', nl: 'Jersey' },
						emoji: { default: '🇯🇪' },
						population: 103267,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Jamaica', nl: 'Jamaica' },
						emoji: { default: '🇯🇲' },
						population: 2825544,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Jordan', nl: 'Jordanië' },
						emoji: { default: '🇯🇴' },
						population: 11734000,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Japan', nl: 'Japan' },
						emoji: { default: '🇯🇵' },
						population: 123300000,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Kenya', nl: 'Kenia' },
						emoji: { default: '🇰🇪' },
						population: 53330978,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Kyrgyzstan', nl: 'Kirgizië' },
						emoji: { default: '🇰🇬' },
						population: 7281800,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Cambodia', nl: 'Cambodja' },
						emoji: { default: '🇰🇭' },
						population: 17577760,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Kiribati', nl: 'Kiribati' },
						emoji: { default: '🇰🇮' },
						population: 120740,
						continent: { en: 'Oceania', nl: 'Oceanië' },
						center: [-171.79135921304464, -3.394810671139621]
					},
					{
						name: { en: 'Comoros', nl: 'Comoren' },
						emoji: { default: '🇰🇲' },
						population: 870038,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Saint Kitts and Nevis', nl: 'Saint Kitts en Nevis' },
						emoji: { default: '🇰🇳' },
						population: 51320,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'North Korea', nl: 'Noord-Korea' },
						emoji: { default: '🇰🇵' },
						population: 25950000,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'South Korea', nl: 'Zuid-Korea' },
						emoji: { default: '🇰🇷' },
						population: 51159889,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Kuwait', nl: 'Koeweit' },
						emoji: { default: '🇰🇼' },
						population: 4881254,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Cayman Islands', nl: 'Kaaimaneilanden' },
						emoji: { default: '🇰🇾' },
						population: 84738,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Kazakhstan', nl: 'Kazachstan' },
						emoji: { default: '🇰🇿' },
						population: 20407844,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Lebanon', nl: 'Libanon' },
						emoji: { default: '🇱🇧' },
						population: 5490000,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Saint Lucia', nl: 'Saint Lucia' },
						emoji: { default: '🇱🇨' },
						population: 184100,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Liechtenstein', nl: 'Liechtenstein' },
						emoji: { default: '🇱🇮' },
						population: 40900,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Sri Lanka', nl: 'Sri Lanka' },
						emoji: { default: '🇱🇰' },
						population: 21763170,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Liberia', nl: 'Liberia' },
						emoji: { default: '🇱🇷' },
						population: 5248621,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Lesotho', nl: 'Lesotho' },
						emoji: { default: '🇱🇸' },
						population: 2116427,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Lithuania', nl: 'Litouwen' },
						emoji: { default: '🇱🇹' },
						population: 2894548,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Luxembourg', nl: 'Luxemburg' },
						emoji: { default: '🇱🇺' },
						population: 681973,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Latvia', nl: 'Letland' },
						emoji: { default: '🇱🇻' },
						population: 1830400,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Libya', nl: 'Libië' },
						emoji: { default: '🇱🇾' },
						population: 7459000,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Morocco', nl: 'Marokko' },
						emoji: { default: '🇲🇦' },
						population: 36828330,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Monaco', nl: 'Monaco' },
						emoji: { default: '🇲🇨' },
						population: 38423,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Moldova', nl: 'Moldavië' },
						emoji: { default: '🇲🇩' },
						population: 2381300,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Montenegro', nl: 'Montenegro' },
						emoji: { default: '🇲🇪' },
						population: 623327,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Madagascar', nl: 'Madagaskar' },
						emoji: { default: '🇲🇬' },
						population: 31727042,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Marshall Islands', nl: 'Marshalleilanden' },
						emoji: { default: '🇲🇭' },
						population: 42418,
						continent: { en: 'Oceania', nl: 'Oceanië' }
					},
					{
						name: { en: 'North Macedonia', nl: 'Noord-Macedonië' },
						emoji: { default: '🇲🇰' },
						population: 1826247,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Mali', nl: 'Mali' },
						emoji: { default: '🇲🇱' },
						population: 22395489,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Myanmar', nl: 'Myanmar (Birma)' },
						emoji: { default: '🇲🇲' },
						population: 51316756,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Mongolia', nl: 'Mongolië' },
						emoji: { default: '🇲🇳' },
						population: 3544835,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Macao', nl: 'Macau SAR van China' },
						emoji: { default: '🇲🇴' },
						population: 685900,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Northern Mariana Islands', nl: 'Noordelijke Marianen' },
						emoji: { default: '🇲🇵' },
						population: 47329,
						continent: { en: 'Oceania', nl: 'Oceanië' }
					},
					{
						name: { en: 'Mauritania', nl: 'Mauritanië' },
						emoji: { default: '🇲🇷' },
						population: 4927532,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Montserrat', nl: 'Montserrat' },
						emoji: { default: '🇲🇸' },
						population: 4386,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Malta', nl: 'Malta' },
						emoji: { default: '🇲🇹' },
						population: 574250,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Mauritius', nl: 'Mauritius' },
						emoji: { default: '🇲🇺' },
						population: 1243741,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Maldives', nl: 'Maldiven' },
						emoji: { default: '🇲🇻' },
						population: 515132,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Malawi', nl: 'Malawi' },
						emoji: { default: '🇲🇼' },
						population: 20734262,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Mexico', nl: 'Mexico' },
						emoji: { default: '🇲🇽' },
						population: 130575786,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Malaysia', nl: 'Maleisië' },
						emoji: { default: '🇲🇾' },
						population: 34231700,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Mozambique', nl: 'Mozambique' },
						emoji: { default: '🇲🇿' },
						population: 34090466,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Namibia', nl: 'Namibië' },
						emoji: { default: '🇳🇦' },
						population: 3022401,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'New Caledonia', nl: 'Nieuw-Caledonië' },
						emoji: { default: '🇳🇨' },
						population: 264596,
						continent: { en: 'Oceania', nl: 'Oceanië' }
					},
					{
						name: { en: 'Niger', nl: 'Niger' },
						emoji: { default: '🇳🇪' },
						population: 26312034,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Norfolk Island', nl: 'Norfolk' },
						emoji: { default: '🇳🇫' },
						population: 2188,
						continent: { en: 'Oceania', nl: 'Oceanië' }
					},
					{
						name: { en: 'Nigeria', nl: 'Nigeria' },
						emoji: { default: '🇳🇬' },
						population: 223800000,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Nicaragua', nl: 'Nicaragua' },
						emoji: { default: '🇳🇮' },
						population: 6803886,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Netherlands', nl: 'Nederland' },
						emoji: { default: '🇳🇱' },
						population: 18080943,
						continent: { en: 'Europe', nl: 'Europa' },
						center: [5.509617166307586, 52.18745956172407]
					},
					{
						name: { en: 'Norway', nl: 'Noorwegen' },
						emoji: { default: '🇳🇴' },
						population: 5606944,
						continent: { en: 'Europe', nl: 'Europa' },
						center: [8.67580392555911, 61.13375262526373]
					},
					{
						name: { en: 'Nepal', nl: 'Nepal' },
						emoji: { default: '🇳🇵' },
						population: 29911840,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Nauru', nl: 'Nauru' },
						emoji: { default: '🇳🇷' },
						population: 11680,
						continent: { en: 'Oceania', nl: 'Oceanië' }
					},
					{
						name: { en: 'Niue', nl: 'Niue' },
						emoji: { default: '🇳🇺' },
						population: 1681,
						continent: { en: 'Oceania', nl: 'Oceanië' }
					},
					{
						name: { en: 'New Zealand', nl: 'Nieuw-Zeeland' },
						emoji: { default: '🇳🇿' },
						population: 5324700,
						continent: { en: 'Oceania', nl: 'Oceanië' },
						center: [172.6616426092364, -41.99853425216095]
					},
					{
						name: { en: 'Oman', nl: 'Oman' },
						emoji: { default: '🇴🇲' },
						population: 5306976,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Panama', nl: 'Panama' },
						emoji: { default: '🇵🇦' },
						population: 4064780,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Peru', nl: 'Peru' },
						emoji: { default: '🇵🇪' },
						population: 34350244,
						continent: { en: 'South America', nl: 'Zuid-Amerika' }
					},
					{
						name: { en: 'French Polynesia', nl: 'Frans-Polynesië' },
						emoji: { default: '🇵🇫' },
						population: 279500,
						continent: { en: 'Oceania', nl: 'Oceanië' }
					},
					{
						name: { en: 'Papua New Guinea', nl: 'Papoea-Nieuw-Guinea' },
						emoji: { default: '🇵🇬' },
						population: 11781559,
						continent: { en: 'Oceania', nl: 'Oceanië' }
					},
					{
						name: { en: 'Philippines', nl: 'Filipijnen' },
						emoji: { default: '🇵🇭' },
						population: 114123600,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Pakistan', nl: 'Pakistan' },
						emoji: { default: '🇵🇰' },
						population: 241499431,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Poland', nl: 'Polen' },
						emoji: { default: '🇵🇱' },
						population: 37401000,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Saint Pierre and Miquelon', nl: 'Saint-Pierre en Miquelon' },
						emoji: { default: '🇵🇲' },
						population: 5819,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Puerto Rico', nl: 'Puerto Rico' },
						emoji: { default: '🇵🇷' },
						population: 3203295,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Portugal', nl: 'Portugal' },
						emoji: { default: '🇵🇹' },
						population: 10749635,
						continent: { en: 'Europe', nl: 'Europa' },
						center: [-8.166088176121546, 39.855589136969044]
					},
					{
						name: { en: 'Palau', nl: 'Palau' },
						emoji: { default: '🇵🇼' },
						population: 16733,
						continent: { en: 'Oceania', nl: 'Oceanië' }
					},
					{
						name: { en: 'Paraguay', nl: 'Paraguay' },
						emoji: { default: '🇵🇾' },
						population: 6109644,
						continent: { en: 'South America', nl: 'Zuid-Amerika' }
					},
					{
						name: { en: 'Qatar', nl: 'Qatar' },
						emoji: { default: '🇶🇦' },
						population: 3173024,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Romania', nl: 'Roemenië' },
						emoji: { default: '🇷🇴' },
						population: 19036031,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Serbia', nl: 'Servië' },
						emoji: { default: '🇷🇸' },
						population: 6567783,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Russia', nl: 'Rusland' },
						emoji: { default: '🇷🇺' },
						population: 146028325,
						continent: { en: 'Europe', nl: 'Europa' },
						center: [90.05634453708623, 62.61934523897718]
					},
					{
						name: { en: 'Rwanda', nl: 'Rwanda' },
						emoji: { default: '🇷🇼' },
						population: 14104969,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Saudi Arabia', nl: 'Saoedi-Arabië' },
						emoji: { default: '🇸🇦' },
						population: 35300280,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Solomon Islands', nl: 'Salomonseilanden' },
						emoji: { default: '🇸🇧' },
						population: 750325,
						continent: { en: 'Oceania', nl: 'Oceanië' }
					},
					{
						name: { en: 'Seychelles', nl: 'Seychellen' },
						emoji: { default: '🇸🇨' },
						population: 122729,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Sudan', nl: 'Soedan' },
						emoji: { default: '🇸🇩' },
						population: 51662000,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Sweden', nl: 'Zweden' },
						emoji: { default: '🇸🇪' },
						population: 10596652,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Singapore', nl: 'Singapore' },
						emoji: { default: '🇸🇬' },
						population: 6036900,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Slovenia', nl: 'Slovenië' },
						emoji: { default: '🇸🇮' },
						population: 2130638,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Slovakia', nl: 'Slowakije' },
						emoji: { default: '🇸🇰' },
						population: 5413813,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Sierra Leone', nl: 'Sierra Leone' },
						emoji: { default: '🇸🇱' },
						population: 9077691,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'San Marino', nl: 'San Marino' },
						emoji: { default: '🇸🇲' },
						population: 34132,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Senegal', nl: 'Senegal' },
						emoji: { default: '🇸🇳' },
						population: 18593258,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Somalia', nl: 'Somalië' },
						emoji: { default: '🇸🇴' },
						population: 19655000,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Suriname', nl: 'Suriname' },
						emoji: { default: '🇸🇷' },
						population: 616500,
						continent: { en: 'South America', nl: 'Zuid-Amerika' }
					},
					{
						name: { en: 'South Sudan', nl: 'Zuid-Soedan' },
						emoji: { default: '🇸🇸' },
						population: 15786898,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'São Tomé and Principe', nl: 'Sao Tomé en Principe' },
						emoji: { default: '🇸🇹' },
						population: 209607,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'El Salvador', nl: 'El Salvador' },
						emoji: { default: '🇸🇻' },
						population: 6029976,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Turks and Caicos Islands', nl: 'Turks- en Caicoseilanden' },
						emoji: { default: '🇹🇨' },
						population: 50894,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Chad', nl: 'Tsjaad' },
						emoji: { default: '🇹🇩' },
						population: 19340757,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Togo', nl: 'Togo' },
						emoji: { default: '🇹🇬' },
						population: 8095498,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Thailand', nl: 'Thailand' },
						emoji: { default: '🇹🇭' },
						population: 65859640,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Tajikistan', nl: 'Tadzjikistan' },
						emoji: { default: '🇹🇯' },
						population: 10499000,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Turkmenistan', nl: 'Turkmenistan' },
						emoji: { default: '🇹🇲' },
						population: 7057841,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Tunisia', nl: 'Tunesië' },
						emoji: { default: '🇹🇳' },
						population: 11972169,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Tonga', nl: 'Tonga' },
						emoji: { default: '🇹🇴' },
						population: 100179,
						continent: { en: 'Oceania', nl: 'Oceanië' }
					},
					{
						name: { en: 'Turkey', nl: 'Turkije' },
						emoji: { default: '🇹🇷' },
						population: 85664944,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Trinidad and Tobago', nl: 'Trinidad en Tobago' },
						emoji: { default: '🇹🇹' },
						population: 1368333,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Tuvalu', nl: 'Tuvalu' },
						emoji: { default: '🇹🇻' },
						population: 10643,
						continent: { en: 'Oceania', nl: 'Oceanië' }
					},
					{
						name: { en: 'Taiwan', nl: 'Taiwan' },
						emoji: { default: '🇹🇼' },
						population: 23337936,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Tanzania', nl: 'Tanzania' },
						emoji: { default: '🇹🇿' },
						population: 68153004,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Ukraine', nl: 'Oekraïne' },
						emoji: { default: '🇺🇦' },
						population: 32862000,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Uganda', nl: 'Oeganda' },
						emoji: { default: '🇺🇬' },
						population: 45905417,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: {
							en: 'United States Minor Outlying Islands',
							nl: 'Kleine afgelegen eilanden van de Verenigde Staten'
						},
						emoji: { default: '🇺🇲' },
						population: 0,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Uruguay', nl: 'Uruguay' },
						emoji: { default: '🇺🇾' },
						population: 3499451,
						continent: { en: 'South America', nl: 'Zuid-Amerika' }
					},
					{
						name: { en: 'Uzbekistan', nl: 'Oezbekistan' },
						emoji: { default: '🇺🇿' },
						population: 37859698,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Venezuela', nl: 'Venezuela' },
						emoji: { default: '🇻🇪' },
						population: 28517000,
						continent: { en: 'South America', nl: 'Zuid-Amerika' }
					},
					{
						name: { en: 'Vanuatu', nl: 'Vanuatu' },
						emoji: { default: '🇻🇺' },
						population: 321409,
						continent: { en: 'Oceania', nl: 'Oceanië' }
					},
					{
						name: { en: 'Wallis and Futuna', nl: 'Wallis en Futuna' },
						emoji: { default: '🇼🇫' },
						population: 11620,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Samoa', nl: 'Samoa' },
						emoji: { default: '🇼🇸' },
						population: 205557,
						continent: { en: 'Oceania', nl: 'Oceanië' }
					},
					{
						name: { en: 'Kosovo', nl: 'Kosovo' },
						emoji: { default: '🇽🇰' },
						population: 1585566,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Yemen', nl: 'Jemen' },
						emoji: { default: '🇾🇪' },
						population: 32684503,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'South Africa', nl: 'Zuid-Afrika' },
						emoji: { default: '🇿🇦' },
						population: 63100945,
						continent: { en: 'Africa', nl: 'Afrika' },
						center: [25.595185174592803, -28.73348553536983]
					},
					{
						name: { en: 'Zambia', nl: 'Zambia' },
						emoji: { default: '🇿🇲' },
						population: 19693423,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Zimbabwe', nl: 'Zimbabwe' },
						emoji: { default: '🇿🇼' },
						population: 17073087,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Åland', nl: 'Åland' },
						emoji: { default: '🇦🇽' },
						population: 30654,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'The Bahamas', nl: 'Bahama’s' },
						emoji: { default: '🇧🇸' },
						population: 398165,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Brunei', nl: 'Brunei' },
						emoji: { default: '🇧🇳' },
						population: 455500,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: "Côte d'Ivoire", nl: 'Ivoorkust' },
						emoji: { default: '🇨🇮' },
						population: 29389150,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Democratic Republic of the Congo', nl: 'Congo-Kinshasa' },
						emoji: { default: '🇨🇩' },
						population: 112832000,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Republic of the Congo', nl: 'Congo-Brazzaville' },
						emoji: { default: '🇨🇬' },
						population: 6142180,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Eswatini', nl: 'Eswatini' },
						emoji: { default: '🇸🇿' },
						population: 1235549,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Falkland Islands', nl: 'Falklandeilanden' },
						emoji: { default: '🇫🇰' },
						population: 3662,
						continent: { en: 'South America', nl: 'Zuid-Amerika' }
					},
					{
						name: {
							en: 'French Southern and Antarctic Lands',
							nl: 'Franse Gebieden in de zuidelijke Indische Oceaan'
						},
						emoji: { default: '🇹🇫' },
						population: 0,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Federated States of Micronesia', nl: 'Micronesia' },
						emoji: { default: '🇫🇲' },
						population: 105564,
						continent: { en: 'Oceania', nl: 'Oceanië' }
					},
					{
						name: { en: 'Heard Island and McDonald Islands', nl: 'Heard en McDonaldeilanden' },
						emoji: { default: '🇭🇲' },
						population: 0,
						continent: { en: 'Oceania', nl: 'Oceanië' }
					},
					{
						name: { en: 'Laos', nl: 'Laos' },
						emoji: { default: '🇱🇦' },
						population: 7647000,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Saint-Martin', nl: 'Saint-Martin' },
						emoji: { default: '🇲🇫' },
						population: 31496,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Pitcairn Islands', nl: 'Pitcairneilanden' },
						emoji: { default: '🇵🇳' },
						population: 35,
						continent: { en: 'Oceania', nl: 'Oceanië' }
					},
					{
						name: { en: 'Palestine', nl: 'Palestijnse gebieden' },
						emoji: { default: '🇵🇸' },
						population: 5483450,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'Saint Helena', nl: 'Sint-Helena' },
						emoji: { default: '🇸🇭' },
						population: 5651,
						continent: { en: 'Africa', nl: 'Afrika' }
					},
					{
						name: { en: 'Sint Maarten', nl: 'Sint-Maarten' },
						emoji: { default: '🇸🇽' },
						population: 41349,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Syria', nl: 'Syrië' },
						emoji: { default: '🇸🇾' },
						population: 25620000,
						continent: { en: 'Asia', nl: 'Azië' }
					},
					{
						name: { en: 'East Timor', nl: 'Oost-Timor' },
						emoji: { default: '🇹🇱' },
						population: 1391221,
						continent: { en: 'Oceania', nl: 'Oceanië' }
					},
					{
						name: { en: 'United States of America', nl: 'Verenigde Staten' },
						emoji: { default: '🇺🇸' },
						population: 340110988,
						continent: { en: 'North America', nl: 'Noord-Amerika' },
						center: [-99.59960333023501, 39.17941584039857]
					},
					{
						name: { en: 'Vatican', nl: 'Vaticaanstad' },
						emoji: { default: '🇻🇦' },
						population: 882,
						continent: { en: 'Europe', nl: 'Europa' }
					},
					{
						name: { en: 'Saint Vincent and the Grenadines', nl: 'Saint Vincent en de Grenadines' },
						emoji: { default: '🇻🇨' },
						population: 110872,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'British Virgin Islands', nl: 'Britse Maagdeneilanden' },
						emoji: { default: '🇻🇬' },
						population: 39471,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'United States Virgin Islands', nl: 'Amerikaanse Maagdeneilanden' },
						emoji: { default: '🇻🇮' },
						population: 87146,
						continent: { en: 'North America', nl: 'Noord-Amerika' }
					},
					{
						name: { en: 'Vietnam', nl: 'Vietnam' },
						emoji: { default: '🇻🇳' },
						population: 101343800,
						continent: { en: 'Asia', nl: 'Azië' },
						center: [107.57079944802854, 16.251859352109328]
					}
				]
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
					'countryOfOrigin'
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
						countryOfOrigin: { en: 'Switzerland', nl: 'Zwitserland' }
					}
				]
			}
		] as const;

		// Get the default Client
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
				slug: taxonomySlug,
				name: JSON.stringify({ en: taxonomyName } as Translatable),
				description: JSON.stringify({
					en: 'Demo taxonomy with countries and foods'
				} as Translatable)
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
			itemIdsByCategoryAndName[category.name.en] = {};

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

				itemIdsByCategoryAndName[category.name.en][itemDefinition.name.en] = item.id;
			}
		}

		for (const category of categoryDefinitions) {
			for (const itemDefinition of category.items) {
				const itemId = itemIdsByCategoryAndName[category.name.en][itemDefinition.name.en];

				const itemAttributeEntries = Object.entries(itemDefinition);
				if (category.name.en === 'Countries') {
					const shape = getCountryShape(itemDefinition.name.en);
					if (!shape) throw new Error(`Missing country shape: ${itemDefinition.name.en}`);
					itemAttributeEntries.push(['color', getCountryColor(itemDefinition.name.en)]);
					itemAttributeEntries.push(['shape', shape]);
				}

				for (const [reference, value] of itemAttributeEntries) {
					const attribute = attributes[reference as keyof typeof attributes];
					if (!attribute) throw new Error(`Unknown attribute reference: ${reference}`);
					let referencedItemId: string | null = null;

					if (attribute.type === AttributeType.itemReference) {
						if (!value || typeof value !== 'object' || !('en' in value)) {
							throw new Error(`Missing reference value for ${reference}`);
						}

						referencedItemId = itemIdsByCategoryAndName.Countries[value.en as string] ?? null;
						if (!referencedItemId) throw new Error(`Unknown reference: ${value.en as string}`);
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
