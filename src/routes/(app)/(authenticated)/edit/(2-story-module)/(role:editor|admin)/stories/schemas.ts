import { BYTE, MEGABYTE } from '$lib/components/ui/file-drop-zone';
import { z } from 'zod/v4';

export const schemaOfAttachments = z.object({
	attachments: z.file()
		.refine(
			file => /\.(ya?ml)$/i.test(file.name),
			'Only .yml or .yaml files are allowed'
		)
		.min(5 * BYTE)
		.max(50 * MEGABYTE)
		.array()
});
