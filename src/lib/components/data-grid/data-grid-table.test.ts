import { constructTable, tableFeatures } from '@tanstack/svelte-table';
import { storeReactivityBindings } from '@tanstack/table-core/store-reactivity-bindings';
import { describe, expect, it } from 'vitest';
import { getFilterFn } from './data-grid-filters.js';
import { dataGridFeatures, type ColumnDef, type Table } from './data-grid-table.js';

type Person = {
	id: string;
	name: string;
	age: number;
	active: boolean;
};

const people: Person[] = [
	{ id: 'a', name: 'Charlie', age: 30, active: true },
	{ id: 'b', name: 'Alice', age: 20, active: false },
	{ id: 'c', name: 'Bob', age: 40, active: true }
];

const columns: ColumnDef<Person>[] = [
	{ accessorKey: 'name', header: 'Name', filterFn: getFilterFn<Person>(), size: 180 },
	{ accessorKey: 'age', header: 'Age', filterFn: getFilterFn<Person>(), size: 100 },
	{ accessorKey: 'active', header: 'Active', filterFn: getFilterFn<Person>(), size: 80 }
];

const testFeatures = tableFeatures({
	coreReactivityFeature: storeReactivityBindings(),
	...dataGridFeatures
});

function createGridTable(data = people): Table<Person> {
	return constructTable({
		features: testFeatures,
		data,
		columns: columns as never,
		getRowId: (row) => row.id
	}) as unknown as Table<Person>;
}

describe('data grid TanStack Table v9 integration', () => {
	it('builds rows and preserves instance methods on their prototypes', () => {
		const table = createGridTable();
		const row = table.getRowModel().rows[0]!;

		expect(table.getRowModel().rows.map((item) => item.id)).toEqual(['a', 'b', 'c']);
		expect(row.getValue('name')).toBe('Charlie');
		expect(Object.hasOwn(row, 'getValue')).toBe(false);
	});

	it('sorts and filters through the registered client-side row models', () => {
		const table = createGridTable();

		table.setSorting([{ id: 'name', desc: false }]);
		expect(table.atoms.sorting.get()).toEqual([{ id: 'name', desc: false }]);
		expect(table.getRowModel().rows.map((row) => row.original.name)).toEqual([
			'Alice',
			'Bob',
			'Charlie'
		]);

		table.setColumnFilters([{ id: 'age', value: { operator: 'greaterThan', value: 25 } }]);
		expect(table.getRowModel().rows.map((row) => row.id)).toEqual(['c', 'a']);
	});

	it('orders, hides, and logically pins columns', () => {
		const table = createGridTable();

		table.setColumnOrder(['active', 'name', 'age']);
		table.setColumnVisibility({ age: false });
		table.setColumnPinning({ start: ['active'], end: ['name'] });

		expect(table.getStartLeafColumns().map((column) => column.id)).toEqual(['active']);
		expect(table.getCenterVisibleLeafColumns()).toEqual([]);
		expect(table.getEndVisibleLeafColumns().map((column) => column.id)).toEqual(['name']);
		expect(table.atoms.columnPinning.get()).toEqual({ start: ['active'], end: ['name'] });
	});

	it('tracks committed sizing and transient resizing independently', () => {
		const table = createGridTable();

		table.setColumnSizing({ name: 240 });
		table.setColumnResizing({
			columnSizingStart: [['name', 240]],
			deltaOffset: 20,
			deltaPercentage: null,
			isResizingColumn: 'name',
			startOffset: 0,
			startSize: 240
		});

		expect(table.getColumn('name')?.getSize()).toBe(240);
		expect(table.atoms.columnResizing.get().isResizingColumn).toBe('name');
		expect(table.atoms.columnSizing.get()).toEqual({ name: 240 });
	});

	it('selects rows with the v9 true-only selection state', () => {
		const table = createGridTable();

		table.getRow('a').toggleSelected(true);
		expect(table.atoms.rowSelection.get()).toEqual({ a: true });
		expect(table.getIsSomeRowsSelected()).toBe(true);
		expect(table.getIsAllRowsSelected()).toBe(false);

		table.toggleAllRowsSelected(true);
		expect(table.getIsAllRowsSelected()).toBe(true);
		expect(table.getIsSomeRowsSelected()).toBe(true);
	});

	it('rebuilds the row model when data options change', () => {
		const table = createGridTable();
		const next = [...people, { id: 'd', name: 'Dana', age: 50, active: false }];

		table.setOptions((previous) => ({ ...previous, data: next }));

		expect(table.getRowModel().rows.map((row) => row.id)).toEqual(['a', 'b', 'c', 'd']);
	});
});
