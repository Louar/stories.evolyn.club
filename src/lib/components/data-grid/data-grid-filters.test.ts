import type { Row } from '@tanstack/table-core';
import { describe, expect, it } from 'vitest';
import { getFilterFn } from './data-grid-filters.js';

function matches(value: unknown, filter: unknown, variant = 'text-short'): boolean {
	const row = {
		getValue: () => value,
		getAllCells: () => [{ column: { id: 'value', columnDef: { meta: { cell: { variant } } } } }]
	} as unknown as Row<unknown>;
	return getFilterFn<unknown>()(row, 'value', filter, () => {});
}

describe('data grid filters', () => {
	it('treats isFalse as strictly false', () => {
		expect(matches(false, { operator: 'isFalse' })).toBe(true);
		expect(matches(null, { operator: 'isFalse' })).toBe(false);
		expect(matches('', { operator: 'isFalse' })).toBe(false);
	});

	it('normalizes reversed numeric and date bounds', () => {
		expect(matches(5, { operator: 'between', value: 10, value2: 1 })).toBe(true);
		expect(
			matches(
				'2026-06-15T00:00:00.000Z',
				{
					operator: 'between',
					value: '2026-12-31T00:00:00.000Z',
					value2: '2026-01-01T00:00:00.000Z'
				},
				'date-time'
			)
		).toBe(true);
	});

	it('compares date and date-time values by calendar date', () => {
		expect(
			matches('2026-06-15T23:59:59+02:00', { operator: 'equals', value: '2026-06-15' }, 'date-time')
		).toBe(true);
		expect(
			matches(new Date(2026, 5, 15, 23, 30), { operator: 'notEquals', value: '2026-06-15' }, 'date')
		).toBe(false);
		expect(
			matches('2026-06-15T23:59:59Z', { operator: 'onOrBefore', value: '2026-06-15' }, 'date-time')
		).toBe(true);
		expect(
			matches(
				'2026-06-15',
				{
					operator: 'between',
					value: '2026-06-15T08:00:00Z',
					value2: '2026-06-15T18:00:00Z'
				},
				'date'
			)
		).toBe(true);
	});

	it('keeps date-like text equality textual', () => {
		expect(matches('2026', { operator: 'equals', value: '2026-01-01' })).toBe(false);
		expect(matches('2026', { operator: 'notEquals', value: '2026-01-01' })).toBe(true);
	});
});
