import { StoryPermissionRole } from '$lib/db/schemas/2-story-module';
import { z } from 'zod/v4';

const storyPermissionSchema = z.object({
	userId: z.uuid(),
	role: z.enum(StoryPermissionRole).default(StoryPermissionRole.editor)
});

export const storyPermissionCreateSchema = storyPermissionSchema.extend({});

export const storyPermissionPatchSchema = storyPermissionSchema.partial();
