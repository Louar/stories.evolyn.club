// Data Grid Filter Utilities
// Exact port of TableCN filter utilities

import type {
	BooleanFilterOperator,
	DateFilterOperator,
	FilterOperator,
	FilterValue,
	NumberFilterOperator,
	SelectFilterOperator,
	TextFilterOperator
} from '$lib/components/data-grid/types/data-grid.js';
import { Language, translateLocalizedField, type Translatable } from '$lib/db/schemas/0-utils';
import { UI } from '$lib/states/ui.svelte';
import type { FilterFn, Row } from '@tanstack/table-core';

export const TEXT_FILTER_OPERATORS: ReadonlyArray<{
	label: string;
	value: TextFilterOperator;
}> = [
	{ label: 'Contains', value: 'contains' },
	{ label: 'Does not contain', value: 'notContains' },
	{ label: 'Is', value: 'equals' },
	{ label: 'Is not', value: 'notEquals' },
	{ label: 'Starts with', value: 'startsWith' },
	{ label: 'Ends with', value: 'endsWith' },
	{ label: 'Is empty', value: 'isEmpty' },
	{ label: 'Is not empty', value: 'isNotEmpty' }
];

export const NUMBER_FILTER_OPERATORS: ReadonlyArray<{
	label: string;
	value: NumberFilterOperator;
}> = [
	{ label: 'Is', value: 'equals' },
	{ label: 'Is not', value: 'notEquals' },
	{ label: 'Is less than', value: 'lessThan' },
	{ label: 'Is less than or equal to', value: 'lessThanOrEqual' },
	{ label: 'Is greater than', value: 'greaterThan' },
	{ label: 'Is greater than or equal to', value: 'greaterThanOrEqual' },
	{ label: 'Is between', value: 'between' },
	{ label: 'Is empty', value: 'isEmpty' },
	{ label: 'Is not empty', value: 'isNotEmpty' }
];

export const DATE_FILTER_OPERATORS: ReadonlyArray<{
	label: string;
	value: DateFilterOperator;
}> = [
	{ label: 'Is', value: 'equals' },
	{ label: 'Is not', value: 'notEquals' },
	{ label: 'Is before', value: 'before' },
	{ label: 'Is after', value: 'after' },
	{ label: 'Is on or before', value: 'onOrBefore' },
	{ label: 'Is on or after', value: 'onOrAfter' },
	{ label: 'Is between', value: 'between' },
	{ label: 'Is empty', value: 'isEmpty' },
	{ label: 'Is not empty', value: 'isNotEmpty' }
];

export const SELECT_FILTER_OPERATORS: ReadonlyArray<{
	label: string;
	value: SelectFilterOperator;
}> = [
	{ label: 'Is', value: 'is' },
	{ label: 'Is not', value: 'isNot' },
	{ label: 'Has any of', value: 'isAnyOf' },
	{ label: 'Has none of', value: 'isNoneOf' },
	{ label: 'Is empty', value: 'isEmpty' },
	{ label: 'Is not empty', value: 'isNotEmpty' }
];

export const BOOLEAN_FILTER_OPERATORS: ReadonlyArray<{
	label: string;
	value: BooleanFilterOperator;
}> = [
	{ label: 'Is', value: 'isTrue' },
	{ label: 'Is not', value: 'isFalse' }
];

export function getDefaultOperator(variant: string): FilterOperator {
	switch (variant) {
		case 'number':
			return 'equals';
		case 'date':
		case 'date-time':
			return 'equals';
		case 'select-single':
		case 'select-multiple':
			return 'is';
		case 'checkbox':
			return 'isTrue';
		default:
			return 'contains';
	}
}

export function getOperatorsForVariant(variant: string): ReadonlyArray<{
	label: string;
	value: FilterOperator;
}> {
	switch (variant) {
		case 'number':
			return NUMBER_FILTER_OPERATORS;
		case 'date':
		case 'date-time':
			return DATE_FILTER_OPERATORS;
		case 'select-single':
		case 'select-multiple':
			return SELECT_FILTER_OPERATORS;
		case 'checkbox':
			return BOOLEAN_FILTER_OPERATORS;
		default:
			return TEXT_FILTER_OPERATORS;
	}
}

export function getFilterFn<TData>(): FilterFn<TData> {
	return (row: Row<TData>, columnId: string, filterValue: unknown): boolean => {
		if (!filterValue || typeof filterValue !== 'object') {
			return true;
		}

		const filter = filterValue as FilterValue;
		const { operator, value, value2 } = filter;
		const variant = row.getAllCells().find((cell) => cell.column.id === columnId)?.column.columnDef
			.meta?.cell?.variant;
		const isCalendarColumn = variant === 'date' || variant === 'date-time';

		let cellValue = row.getValue(columnId);
		if (cellValue && typeof cellValue === 'object') {
			if ('label' in cellValue) cellValue = cellValue.label;
			else if ('default' in cellValue || Language.English in cellValue)
				cellValue = translateLocalizedField(cellValue as Translatable, UI.language);
		}

		if (operator === 'isEmpty') {
			return (
				cellValue === null ||
				cellValue === undefined ||
				cellValue === '' ||
				(Array.isArray(cellValue) && cellValue.length === 0)
			);
		}

		if (operator === 'isNotEmpty') {
			return !(
				cellValue === null ||
				cellValue === undefined ||
				cellValue === '' ||
				(Array.isArray(cellValue) && cellValue.length === 0)
			);
		}

		if (operator === 'isTrue') {
			return cellValue === true;
		}

		if (operator === 'isFalse') {
			return cellValue === false;
		}

		if (value === undefined || value === null || value === '') {
			return true;
		}

		const cellValueStr = String(cellValue ?? '').toLowerCase();
		const filterValueStr = typeof value === 'string' ? value.toLowerCase() : String(value);

		if (operator === 'contains') {
			return cellValueStr.includes(filterValueStr);
		}

		if (operator === 'notContains') {
			return !cellValueStr.includes(filterValueStr);
		}

		const cellDate = isCalendarColumn ? normalizeCalendarDate(cellValue) : null;
		const filterDate = isCalendarColumn ? normalizeCalendarDate(value) : null;

		if (operator === 'equals') {
			if (typeof cellValue === 'number' && typeof value === 'number') {
				return cellValue === value;
			}
			if (cellDate !== null && filterDate !== null) return cellDate === filterDate;
			return cellValueStr === filterValueStr;
		}

		if (operator === 'notEquals') {
			if (typeof cellValue === 'number' && typeof value === 'number') {
				return cellValue !== value;
			}
			if (cellDate !== null && filterDate !== null) return cellDate !== filterDate;
			return cellValueStr !== filterValueStr;
		}

		if (operator === 'startsWith') {
			return cellValueStr.startsWith(filterValueStr);
		}

		if (operator === 'endsWith') {
			return cellValueStr.endsWith(filterValueStr);
		}

		if (typeof cellValue === 'number' && typeof value === 'number') {
			if (operator === 'greaterThan') {
				return cellValue > value;
			}

			if (operator === 'greaterThanOrEqual') {
				return cellValue >= value;
			}

			if (operator === 'lessThan') {
				return cellValue < value;
			}

			if (operator === 'lessThanOrEqual') {
				return cellValue <= value;
			}

			if (operator === 'between' && typeof value2 === 'number') {
				const lower = Math.min(value, value2);
				const upper = Math.max(value, value2);
				return cellValue >= lower && cellValue <= upper;
			}
		}

		if (cellDate !== null && filterDate !== null) {
			if (operator === 'before') {
				return cellDate < filterDate;
			}

			if (operator === 'after') {
				return cellDate > filterDate;
			}

			if (operator === 'onOrBefore') {
				return cellDate <= filterDate;
			}

			if (operator === 'onOrAfter') {
				return cellDate >= filterDate;
			}

			if (operator === 'between') {
				const filterDate2 = normalizeCalendarDate(value2);
				if (filterDate2 === null) return true;
				const lower = filterDate <= filterDate2 ? filterDate : filterDate2;
				const upper = filterDate <= filterDate2 ? filterDate2 : filterDate;
				return cellDate >= lower && cellDate <= upper;
			}
		}

		if (operator === 'is') {
			if (Array.isArray(cellValue)) {
				return cellValue.some((v) => String(v) === String(value));
			}
			return String(cellValue) === String(value);
		}

		if (operator === 'isNot') {
			if (Array.isArray(cellValue)) {
				return !cellValue.some((v) => String(v) === String(value));
			}
			return String(cellValue) !== String(value);
		}

		if (operator === 'isAnyOf' && Array.isArray(value)) {
			if (Array.isArray(cellValue)) {
				return cellValue.some((v) => value.some((fv) => String(v) === String(fv)));
			}
			return value.some((fv) => String(cellValue) === String(fv));
		}

		if (operator === 'isNoneOf' && Array.isArray(value)) {
			if (Array.isArray(cellValue)) {
				return !cellValue.some((v) => value.some((fv) => String(v) === String(fv)));
			}
			return !value.some((fv) => String(cellValue) === String(fv));
		}

		return true;
	};
}

export function normalizeCalendarDate(value: unknown): number | null {
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) return null;
		return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
	}
	if (typeof value !== 'string' || !value.trim()) return null;
	const dateOnly = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value);
	if (dateOnly) {
		const [, year, month, day] = dateOnly;
		return Date.UTC(Number(year), Number(month) - 1, Number(day));
	}
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return null;
	return Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}
