import { describe, expect, it, vi } from 'vitest';
import {
	clearCellMedia,
	getSelectedRows,
	hasFileUploadHandler,
	isAcknowledgedCellValueCurrent,
	isAcknowledgedNullClearCurrent,
	isCellMutationSnapshotCurrent,
	shouldRestoreCellMutation,
	snapshotCellMutations,
	snapshotCellKeys
} from './data-grid-actions.js';
import {
	deduplicateDeletableMedia,
	getFileCellItems,
	isDeletableUploadedMedia,
	isExternalMedia,
	normalizeFiles
} from './data-grid-media.js';

describe('data grid actions', () => {
	it('only enables local uploads when an upload handler exists', () => {
		expect(hasFileUploadHandler(undefined)).toBe(false);
		expect(hasFileUploadHandler(true)).toBe(false);
		expect(hasFileUploadHandler(vi.fn())).toBe(true);
	});

	it('returns only checkbox-selected rows with their stable indices', () => {
		const rows = [{ id: 'first' }, { id: 'second' }, { id: 'third' }];
		expect(getSelectedRows(rows as never[], { first: false, second: true, third: true })).toEqual([
			{ row: rows[1], rowIndex: 1 },
			{ row: rows[2], rowIndex: 2 }
		]);
	});

	it('normalizes empty file lists to null and accepts object or array values', () => {
		const file = { id: 'a', collection: 'clients' as const, filename: 'a.png' };
		expect(normalizeFiles([])).toBeNull();
		expect(normalizeFiles([file])).toEqual([file]);
		expect(getFileCellItems(file)).toEqual([file]);
		expect(getFileCellItems([file])).toEqual([file]);
		expect(getFileCellItems({ collection: 'clients', filename: 'without-id.png' })).toEqual([
			{ id: 'without-id.png', collection: 'clients', filename: 'without-id.png' }
		]);
	});

	it('classifies and deduplicates only deletable uploaded media', () => {
		const clientFile = { id: 'a', collection: 'clients' as const, filename: 'same.png' };
		const duplicate = { ...clientFile, id: 'b' };
		const external = {
			id: 'url',
			collection: 'externals' as const,
			filename: 'https://example.com/a.png'
		};
		const internal = { id: 'internal', collection: 'internals' as const, filename: 'logo.svg' };

		expect(isDeletableUploadedMedia(clientFile)).toBe(true);
		expect(isExternalMedia(external)).toBe(true);
		expect(isDeletableUploadedMedia(external)).toBe(false);
		expect(isDeletableUploadedMedia(internal)).toBe(false);
		expect(deduplicateDeletableMedia([clientFile, duplicate, external, internal])).toEqual([
			clientFile
		]);
	});

	it('does not delete media when its cell fails to persist null', async () => {
		const file = { id: 'a', collection: 'clients' as const, filename: 'failed.png' };
		const deleteMedia = vi.fn();
		const result = await clearCellMedia(
			[{ key: 'failed-cell', value: [file], context: 1 }],
			async () => ({ success: false, generation: 1 }),
			() => false,
			deleteMedia
		);

		expect(deleteMedia).not.toHaveBeenCalled();
		expect(result.successfulCellKeys).toEqual(new Set());
		expect(result.failedCellKeys).toEqual(new Set(['failed-cell']));
	});

	it('keeps shared media when any dependent cell fails to persist null', async () => {
		const shared = { id: 'a', collection: 'clients' as const, filename: 'shared.png' };
		const deleteMedia = vi.fn(async () => 'deleted' as const);

		const result = await clearCellMedia(
			[
				{ key: 'first', value: [shared], context: 1 },
				{ key: 'second', value: [shared], context: 2 }
			],
			async (cell) => ({ success: cell.key === 'first', generation: 1 }),
			() => true,
			deleteMedia
		);

		expect(deleteMedia).not.toHaveBeenCalled();
		expect(result.successfulCellKeys).toEqual(new Set(['first']));
		expect(result.failedCellKeys).toEqual(new Set(['second']));
	});

	it('persists null before deleting and deduplicates successful deletes', async () => {
		const shared = { id: 'a', collection: 'clients' as const, filename: 'shared.png' };
		const calls: string[] = [];
		const result = await clearCellMedia(
			[
				{ key: 'first', value: [shared], context: 1 },
				{ key: 'second', value: [{ ...shared, id: 'b' }], context: 2 }
			],
			async (cell) => {
				calls.push(`patch:${cell.key}`);
				return { success: true, generation: 1 };
			},
			() => true,
			async (file) => {
				calls.push(`delete:${file.filename}`);
				return 'deleted';
			}
		);

		expect(calls).toEqual(['patch:first', 'patch:second', 'delete:shared.png']);
		expect(result.deletedMediaCount).toBe(1);
		expect(result.failedMediaCount).toBe(0);
	});

	it('rechecks every acknowledged dependent before deleting shared media', async () => {
		const shared = { id: 'a', collection: 'clients' as const, filename: 'shared.png' };
		const deleteMedia = vi.fn(async () => 'deleted' as const);
		const result = await clearCellMedia(
			[
				{ key: 'first', value: [shared], context: 1 },
				{ key: 'second', value: [shared], context: 2 }
			],
			async () => ({ success: true, generation: 2 }),
			(cell) => cell.key === 'first',
			deleteMedia
		);

		expect(deleteMedia).not.toHaveBeenCalled();
		expect(result.successfulCellKeys).toEqual(new Set(['first', 'second']));
		expect(result.retainedMediaCount).toBe(1);
	});

	it('distinguishes server-retained shared media from deletion failures', async () => {
		const file = { id: 'a', collection: 'clients' as const, filename: 'shared.png' };
		const result = await clearCellMedia(
			[{ key: 'cell', value: [file], context: 1 }],
			async () => ({ success: true, generation: 1 }),
			() => true,
			async () => 'retained'
		);

		expect(result.deletedMediaCount).toBe(0);
		expect(result.retainedMediaCount).toBe(1);
		expect(result.failedMediaCount).toBe(0);
	});

	it('snapshots cut cell keys independently from later selection changes', () => {
		const selection = new Set(['first', 'second']);
		const snapshot = snapshotCellKeys(selection);
		selection.clear();
		selection.add('third');

		expect(snapshot).toEqual(new Set(['first', 'second']));
	});

	it('snapshots each editable cut value and generation before asynchronous work', () => {
		const state = new Map([
			['first', { generation: 2, value: ['captured'] }],
			['second', { generation: 4, value: 'read-only' }]
		]);
		const snapshot = snapshotCellMutations(new Set(state.keys()), (key) =>
			key === 'second' ? undefined : state.get(key)
		);
		state.set('first', { generation: 3, value: ['newer'] });

		expect(snapshot).toEqual(new Map([['first', { generation: 2, value: ['captured'] }]]));
	});

	it('rejects stale clear snapshots without applying over a newer edit', () => {
		const equals = (left: unknown, right: unknown) => left === right;
		expect(isCellMutationSnapshotCurrent({ generation: 2, value: 'old' }, 3, 'new', equals)).toBe(
			false
		);
		expect(isCellMutationSnapshotCurrent({ generation: 2, value: 'old' }, 2, 'old', equals)).toBe(
			true
		);
	});

	it('requires both the acknowledged generation and null value before deletion', () => {
		expect(isAcknowledgedNullClearCurrent(3, { generation: 3, value: null })).toBe(true);
		expect(isAcknowledgedNullClearCurrent(3, { generation: 4, value: null })).toBe(false);
		expect(isAcknowledgedNullClearCurrent(3, { generation: 3, value: ['restored'] })).toBe(false);
	});

	it('requires the acknowledged generation and remaining file value before deletion', () => {
		const remaining = [{ id: 'b', collection: 'clients', filename: 'remaining.png' }];
		expect(
			isAcknowledgedCellValueCurrent(
				3,
				{ generation: 3, value: remaining.map((file) => ({ ...file })) },
				remaining
			)
		).toBe(true);
		expect(isAcknowledgedCellValueCurrent(3, { generation: 4, value: remaining }, remaining)).toBe(
			false
		);
		expect(isAcknowledgedCellValueCurrent(3, { generation: 3, value: null }, remaining)).toBe(
			false
		);
	});

	it('restores a failed clear snapshot only while its generation is current', () => {
		expect(shouldRestoreCellMutation(2, 2)).toBe(true);
		expect(shouldRestoreCellMutation(2, 3)).toBe(false);
	});
});
