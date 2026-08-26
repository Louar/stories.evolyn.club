import type { Row, RowSelectionState } from '@tanstack/table-core';
import { areEditValuesEqual } from './data-grid-mutations.js';
import {
	deduplicateDeletableMedia,
	getFileCellItems,
	mediaDeleteKey,
	type FileCellItemLike
} from './data-grid-media.js';

export interface MediaClearCell<TContext> {
	key: string;
	value: unknown;
	context: TContext;
}

export interface MediaClearResult {
	successfulCellKeys: Set<string>;
	failedCellKeys: Set<string>;
	deletedMediaCount: number;
	retainedMediaCount: number;
	failedMediaCount: number;
}

export interface PersistedMediaClear {
	success: boolean;
	generation: number;
}

export type MediaDeletionOutcome = 'deleted' | 'retained';

export function hasFileUploadHandler(handler: unknown): handler is (...args: never[]) => unknown {
	return typeof handler === 'function';
}

export function getSelectedRows<TData>(
	rows: Row<TData>[],
	rowSelection: RowSelectionState
): Array<{ row: Row<TData>; rowIndex: number }> {
	return rows.flatMap((row, rowIndex) => (rowSelection[row.id] ? [{ row, rowIndex }] : []));
}

export async function clearCellMedia<TContext>(
	cells: readonly MediaClearCell<TContext>[],
	persistClear: (cell: MediaClearCell<TContext>) => Promise<PersistedMediaClear>,
	isAcknowledgedClearCurrent: (cell: MediaClearCell<TContext>, generation: number) => boolean,
	deleteMedia: (file: FileCellItemLike, context: TContext) => Promise<MediaDeletionOutcome>
): Promise<MediaClearResult> {
	const deletionByKey = new Map<string, { file: FileCellItemLike; context: TContext }>();
	const dependentCellsByMedia = new Map<string, Set<string>>();

	for (const cell of cells) {
		const files = deduplicateDeletableMedia(getFileCellItems(cell.value));
		for (const file of files) {
			const key = mediaDeleteKey(file);
			if (!deletionByKey.has(key)) deletionByKey.set(key, { file, context: cell.context });
			const dependents = dependentCellsByMedia.get(key) ?? new Set<string>();
			dependents.add(cell.key);
			dependentCellsByMedia.set(key, dependents);
		}
	}

	const persistence = await Promise.allSettled(cells.map((cell) => persistClear(cell)));
	const successfulCellKeys = new Set(
		cells.flatMap((cell, index) =>
			persistence[index]?.status === 'fulfilled' && persistence[index].value.success
				? [cell.key]
				: []
		)
	);
	const failedCellKeys = new Set(
		cells.map((cell) => cell.key).filter((key) => !successfulCellKeys.has(key))
	);
	const deletions: Array<[string, { file: FileCellItemLike; context: TContext }]> = [];
	let retainedMediaCount = 0;
	for (const entry of deletionByKey.entries()) {
		const dependents = dependentCellsByMedia.get(entry[0]);
		const areDependentsCurrent =
			dependents &&
			[...dependents].every((cellKey) => {
				const cellIndex = cells.findIndex((cell) => cell.key === cellKey);
				const cell = cells[cellIndex];
				const result = persistence[cellIndex];
				return (
					cell &&
					result?.status === 'fulfilled' &&
					result.value.success
					// && isAcknowledgedClearCurrent(cell, result.value.generation)
				);
			});
		if (areDependentsCurrent) {
			deletions.push(entry);
		} else if (dependents && [...dependents].every((key) => successfulCellKeys.has(key))) {
			retainedMediaCount++;
		}
	}
	const deleted = await Promise.allSettled(
		deletions.map(([, { file, context }]) => deleteMedia(file, context))
	);

	return {
		successfulCellKeys,
		failedCellKeys,
		deletedMediaCount: deleted.filter(
			(result) => result.status === 'fulfilled' && result.value === 'deleted'
		).length,
		retainedMediaCount:
			retainedMediaCount +
			deleted.filter((result) => result.status === 'fulfilled' && result.value === 'retained')
				.length,
		failedMediaCount: deleted.filter((result) => result.status === 'rejected').length
	};
}

export function snapshotCellKeys(cellKeys: ReadonlySet<string>): Set<string> {
	return new Set(cellKeys);
}

export function snapshotCellMutations(
	cellKeys: ReadonlySet<string>,
	getSnapshot: (cellKey: string) => { generation: number; value: unknown } | undefined
): Map<string, { generation: number; value: unknown }> {
	return new Map(
		[...cellKeys].flatMap((cellKey) => {
			const snapshot = getSnapshot(cellKey);
			return snapshot ? [[cellKey, snapshot] as const] : [];
		})
	);
}

export function isCellMutationSnapshotCurrent(
	snapshot: { generation: number; value: unknown },
	currentGeneration: number,
	currentValue: unknown,
	equals: (left: unknown, right: unknown) => boolean
): boolean {
	return snapshot.generation === currentGeneration && equals(snapshot.value, currentValue);
}

export function isAcknowledgedNullClearCurrent(
	acknowledgedGeneration: number,
	current: { generation: number; value: unknown } | undefined
): boolean {
	return isAcknowledgedCellValueCurrent(acknowledgedGeneration, current, null);
}

export function isAcknowledgedCellValueCurrent(
	acknowledgedGeneration: number,
	current: { generation: number; value: unknown } | undefined,
	expectedValue: unknown
): boolean {
	return (
		current?.generation === acknowledgedGeneration &&
		areEditValuesEqual(current.value, expectedValue)
	);
}

export function shouldRestoreCellMutation(
	mutationGeneration: number,
	currentGeneration: number
): boolean {
	return mutationGeneration === currentGeneration;
}
