import type { CellOpts } from './types/data-grid.js';

export type CellVariant = CellOpts['variant'] | undefined;

export function getEmptyCellValue(variant: CellVariant): unknown {
	switch (variant) {
		case 'file':
		case 'file-or-url':
			return null;
		case 'select-multiple':
			return [];
		case 'checkbox':
			return false;
		case 'date':
		case 'date-time':
		case 'json-yaml':
		case 'number':
			return null;
		default:
			return '';
	}
}

export function serializeCellValue(value: unknown): string {
	if (value === null || value === undefined) return '';
	if (typeof value === 'object') return JSON.stringify(value);
	return String(value);
}

export function parseCellValue(text: string, variant: CellVariant): unknown {
	if (text === '') return getEmptyCellValue(variant);

	if (variant === 'number') {
		const value = Number(text);
		return Number.isFinite(value) ? value : text;
	}

	if (variant === 'checkbox') {
		if (text.toLowerCase() === 'true') return true;
		if (text.toLowerCase() === 'false') return false;
		return text;
	}

	if (
		variant === 'json-yaml' ||
		variant === 'select-multiple' ||
		variant === 'file' ||
		variant === 'file-or-url'
	) {
		try {
			return JSON.parse(text);
		} catch {
			return text;
		}
	}

	return text;
}

export function normalizeClipboardText(text: string): string {
	return text.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
}

export function parseClipboardRows(text: string): string[][] {
	const normalized = normalizeClipboardText(text);
	return normalized.split('\n').map((line) => line.split('\t'));
}

export function getClipboardValueAtOffset(
	rows: readonly (readonly string[])[],
	rowOffset: number,
	columnOffset: number
): string {
	if (rows.length === 0) return '';
	const row = rows[rowOffset % rows.length];
	if (!row || row.length === 0) return '';
	return row[columnOffset % row.length] ?? '';
}
