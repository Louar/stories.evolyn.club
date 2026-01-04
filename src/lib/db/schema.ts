import type { ClientUserModuleSchema } from './schemas/1-client-user-module';
import type { StoryModuleSchema } from './schemas/2-story-module';

export type Schema = ClientUserModuleSchema
  & StoryModuleSchema;
