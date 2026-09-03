import { db } from '$lib/db/database';
import { DummyDataStoryQuizOfCities } from './2a-story-quiz-of-cities';
import { DummyDataGeneralTaxonomy } from './2b-general-taxonomy';
import { DummyDataFoodTaxonomy } from './2c-food-taxonomy';

export const DEMO_STORIES = {
	'quiz-of-cities': DummyDataStoryQuizOfCities
};

export const DEMO_TAXONOMIES = {
	'general-taxonomy': { name: 'General taxonomy', create: DummyDataGeneralTaxonomy },
	'food-taxonomy': { name: 'Food taxonomy', create: DummyDataFoodTaxonomy }
};

export const createDemoStories = async (clientId: string) => {
	for (const [reference, fun] of Object.entries(DEMO_STORIES)) {
		const existing = await db
			.selectFrom('story')
			.where('slug', '=', reference)
			.where('clientId', '=', clientId)
			.select('id')
			.executeTakeFirst();
		if (!existing) {
			try {
				await fun(reference);
			} catch (e) {
				if (process.env.NODE_ENV !== 'production') {
					console.warn(`Failed to create story ${reference}.`);
					console.debug(e);
				}
			}
		}
	}

	for (const [reference, taxonomy] of Object.entries(DEMO_TAXONOMIES)) {
		const existing = await db
			.selectFrom('taxonomy')
			.where('slug', '=', reference)
			.where('clientId', '=', clientId)
			.select('id')
			.executeTakeFirst();
		if (!existing) {
			try {
				await taxonomy.create(taxonomy.name);
			} catch (e) {
				if (process.env.NODE_ENV !== 'production') {
					console.warn(`Failed to create taxonomy ${reference}.`);
					console.debug(e);
				}
			}
		}
	}
};
