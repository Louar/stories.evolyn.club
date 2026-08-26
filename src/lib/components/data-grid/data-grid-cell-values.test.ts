import { describe, expect, it } from 'vitest';
import {
	getEmptyCellValue,
	normalizeClipboardText,
	parseCellValue,
	parseClipboardRows,
	serializeCellValue
} from './data-grid-cell-values.js';

describe('data grid cell values', () => {
	it('uses variant-aware empty values', () => {
		expect(getEmptyCellValue('file')).toBeNull();
		expect(getEmptyCellValue('file-or-url')).toBeNull();
		expect(getEmptyCellValue('select-multiple')).toEqual([]);
		expect(getEmptyCellValue('checkbox')).toBe(false);
		expect(getEmptyCellValue('number')).toBeNull();
		expect(getEmptyCellValue('text-short')).toBe('');
	});

	it('only coerces clipboard values for matching variants', () => {
		expect(parseCellValue('001', 'text-short')).toBe('001');
		expect(parseCellValue('001', 'number')).toBe(1);
		expect(parseCellValue('false', 'text-short')).toBe('false');
		expect(parseCellValue('false', 'checkbox')).toBe(false);
		expect(parseCellValue('{"enabled":true}', 'text-long')).toBe('{"enabled":true}');
		expect(parseCellValue('{"enabled":true}', 'json-yaml')).toEqual({ enabled: true });
	});

	it('normalizes CRLF and removes terminal clipboard rows', () => {
		expect(normalizeClipboardText('a\r\nb\r\n')).toBe('a\nb');
		expect(parseClipboardRows('a\tb\r\nc\td\n')).toEqual([
			['a', 'b'],
			['c', 'd']
		]);
	});

	it('serializes structured values without changing textual identifiers', () => {
		expect(serializeCellValue(['001', '002'])).toBe('["001","002"]');
		expect(serializeCellValue('001')).toBe('001');
	});
});
