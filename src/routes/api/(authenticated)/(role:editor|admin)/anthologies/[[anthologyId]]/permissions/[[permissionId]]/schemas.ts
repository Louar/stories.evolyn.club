import { AnthologyPermissionRole } from '$lib/db/schemas/2-story-module';
import { z } from 'zod/v4';

const anthologyPermissionSchema = z.object({
	userId: z.uuid(),
	role: z.enum(AnthologyPermissionRole).default(AnthologyPermissionRole.editor)
});

export const anthologyPermissionCreateSchema = anthologyPermissionSchema.extend({});

export const anthologyPermissionPatchSchema = anthologyPermissionSchema.partial();
