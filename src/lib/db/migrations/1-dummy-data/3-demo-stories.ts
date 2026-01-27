import { db } from '$lib/db/database';
import { DummyDataStoryQuizOfCities } from './3a-story-quiz-of-cities';


export const DEMO_CAMPAIGNS = {
  'quiz-of-cities': DummyDataStoryQuizOfCities,
};

export const createDemoStories = async (clientId: string) => {

  for (const [reference, fun] of Object.entries(DEMO_CAMPAIGNS)) {
    const existing = await db.selectFrom('story').where('reference', '=', reference).where('clientId', '=', clientId).select('id').executeTakeFirst();
    if (!existing) {
      try {
        await fun(reference);
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`Failed to create story ${reference}.`);
          console.log(e);
        }
      }
    }
  }

};