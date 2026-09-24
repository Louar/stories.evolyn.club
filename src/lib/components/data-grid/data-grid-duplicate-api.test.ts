import { describe, expect, it } from 'vitest';
import { getDuplicateSlug, requireDataGridJsonResponse } from './data-grid-duplicate-api.js';

describe('data grid duplicate API helpers', () => {
	it('creates the next available copy slug', () => {
		expect(getDuplicateSlug('task', [])).toBe('task-copy');
		expect(getDuplicateSlug('task', ['task-copy'])).toBe('task-copy-2');
		expect(getDuplicateSlug('task', ['task-copy', 'task-copy-2', 'task-copy-3'])).toBe(
			'task-copy-4'
		);
	});

	it('returns JSON responses and preserves structured API errors', async () => {
		await expect(
			requireDataGridJsonResponse<{ id: string }>(
				new Response(JSON.stringify({ id: 'created' }), {
					status: 201,
					headers: { 'content-type': 'application/json' }
				}),
				'create row'
			)
		).resolves.toEqual({ id: 'created' });

		const failure = requireDataGridJsonResponse(
			new Response(JSON.stringify({ errors: { slug: ['Already used'] } }), {
				status: 422,
				headers: { 'content-type': 'application/json' }
			}),
			'duplicate row'
		);
		await expect(failure).rejects.toMatchObject({
			message: 'Failed to duplicate row',
			status: 422,
			body: { errors: { slug: ['Already used'] } }
		});
	});
});
