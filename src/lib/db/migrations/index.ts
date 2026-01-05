import type { Migration } from 'kysely';
import { InitClientUserModule } from './0-init/1-client-user-module';
import { InitStoryModule } from './0-init/2-story-module';
import { DummyDataDefaultClientAndUsers } from './1-dummy-data/1-default-client-and-users';
import { DummyDataDefaultStory } from './1-dummy-data/2-default-story';

export const migrations: Record<string, Migration> = {
  '0-init-1-client-user-module': InitClientUserModule,
  '0-init-2-story-module': InitStoryModule,
  '1-dummy-data-1-default-client-and-users': DummyDataDefaultClientAndUsers,
  '1-dummy-data-2-default-story': DummyDataDefaultStory,
};
