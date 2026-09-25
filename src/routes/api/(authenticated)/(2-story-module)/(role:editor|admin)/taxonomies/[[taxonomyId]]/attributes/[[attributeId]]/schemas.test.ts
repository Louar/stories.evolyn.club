import { describe, expect, it } from 'vitest';
import { attributeCreateSchema, attributePatchSchema } from './schemas';

describe('attribute questions', () => {
	it.each([attributeCreateSchema, attributePatchSchema])(
		'accepts optional translated questions',
		(schema) => {
			const question = { en: 'Where is it?', nl: 'Waar is het?' };
			expect(schema.parse({ question }).question).toBe(JSON.stringify(question));
			expect(schema.parse({ question: null }).question).toBe('null');
			expect(schema.parse({ question: { en: '' } }).question).toBe('null');
			expect(schema.parse({})).not.toHaveProperty('question');
		}
	);

	it.each(['Question', { en: ' ' }, { nl: 'Waar?' }, 42])(
		'rejects invalid question %j',
		(question) => {
			expect(attributePatchSchema.safeParse({ question }).success).toBe(false);
		}
	);
});
