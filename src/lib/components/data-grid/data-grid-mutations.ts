export function createKeyedSequencer() {
	const tails = new Map<string, Promise<void>>();

	const sequenceKeys = <T>(keys: readonly string[], mutation: () => Promise<T>): Promise<T> => {
		const uniqueKeys = [...new Set(keys)].sort();
		const previous = uniqueKeys.map((key) => tails.get(key) ?? Promise.resolve());
		const result = Promise.all(previous.map((tail) => tail.catch(() => undefined))).then(mutation);
		const tail = result.then(
			() => undefined,
			() => undefined
		);
		for (const key of uniqueKeys) tails.set(key, tail);
		void tail.finally(() => {
			for (const key of uniqueKeys) {
				if (tails.get(key) === tail) tails.delete(key);
			}
		});
		return result;
	};

	const sequence = <T>(key: string, mutation: () => Promise<T>): Promise<T> =>
		sequenceKeys([key], mutation);
	return Object.assign(sequence, { sequenceKeys });
}

export function createRowIdentityRegistry<T extends object>() {
	const generatedIds = new WeakMap<T, string>();
	const temporaryIds = new WeakMap<T, string>();
	const activeTemporaryIds = new Set<string>();
	const canonicalIds = new Map<string, string>();
	const sequenceKeys = new Map<string, string>();
	let sequenceKey = 0;

	return {
		getGeneratedId: (row: T) => generatedIds.get(row),
		setGeneratedId: (row: T, rowId: string) => generatedIds.set(row, rowId),
		getTemporaryId: (row: T) => temporaryIds.get(row),
		registerTemporary: (row: T, rowId: string) => {
			temporaryIds.set(row, rowId);
			activeTemporaryIds.add(rowId);
			sequenceKeys.set(rowId, `temporary:${++sequenceKey}`);
		},
		carry: (previous: T, next: T) => {
			const generatedId = generatedIds.get(previous);
			if (generatedId) generatedIds.set(next, generatedId);
			const temporaryId = temporaryIds.get(previous);
			if (temporaryId) temporaryIds.set(next, temporaryId);
		},
		isTemporary: (rowId: string) => activeTemporaryIds.has(rowId),
		resolve: (rowId: string) => canonicalIds.get(rowId) ?? rowId,
		getSequenceKey: (rowId: string) => sequenceKeys.get(rowId) ?? `canonical:${rowId}`,
		recordCanonical: (temporaryId: string, canonicalId: string) => {
			canonicalIds.set(temporaryId, canonicalId);
			sequenceKeys.set(canonicalId, sequenceKeys.get(temporaryId) ?? `canonical:${temporaryId}`);
			activeTemporaryIds.delete(temporaryId);
		}
	};
}

export function cloneEditValue<T>(value: T): T {
	if (value instanceof Date) return new Date(value.getTime()) as T;
	if (Array.isArray(value)) return value.map((item) => cloneEditValue(item)) as T;
	if (value && typeof value === 'object') {
		const prototype = Object.getPrototypeOf(value);
		if (prototype === Object.prototype || prototype === null) {
			return Object.fromEntries(
				Object.entries(value).map(([key, item]) => [key, cloneEditValue(item)])
			) as T;
		}
	}
	return value;
}

export function areEditValuesEqual(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;
	if (left instanceof Date || right instanceof Date) {
		return left instanceof Date && right instanceof Date && left.getTime() === right.getTime();
	}
	if (Array.isArray(left) || Array.isArray(right)) {
		return (
			Array.isArray(left) &&
			Array.isArray(right) &&
			left.length === right.length &&
			left.every((item, index) => areEditValuesEqual(item, right[index]))
		);
	}
	if (left && right && typeof left === 'object' && typeof right === 'object') {
		const leftPrototype = Object.getPrototypeOf(left);
		const rightPrototype = Object.getPrototypeOf(right);
		if (
			(leftPrototype !== Object.prototype && leftPrototype !== null) ||
			(rightPrototype !== Object.prototype && rightPrototype !== null)
		)
			return false;
		const leftEntries = Object.entries(left);
		const rightRecord = right as Record<string, unknown>;
		return (
			leftEntries.length === Object.keys(rightRecord).length &&
			leftEntries.every(
				([key, value]) =>
					Object.prototype.hasOwnProperty.call(rightRecord, key) &&
					areEditValuesEqual(value, rightRecord[key])
			)
		);
	}
	return false;
}

export function getEarliestPendingValue(
	pending: { previousValue: unknown } | undefined,
	previousValue: unknown
): unknown {
	return pending ? pending.previousValue : cloneEditValue(previousValue);
}

export function getDraftValidationDisposition(
	submittedColumnIds: readonly string[],
	matchedErrorColumnIds: ReadonlySet<string>
): { validColumnIds: string[]; invalidColumnIds: string[]; errorColumnIds: string[] } {
	const validColumnIds: string[] = [];
	const invalidColumnIds: string[] = [];
	for (const columnId of submittedColumnIds) {
		(matchedErrorColumnIds.has(columnId) ? invalidColumnIds : validColumnIds).push(columnId);
	}
	return { validColumnIds, invalidColumnIds, errorColumnIds: Array.from(matchedErrorColumnIds) };
}

type CellPatchUpdate = {
	rowId: string;
	rowIndex: number;
	columnId: string;
	value: unknown;
};

export type VersionedCellUpdate<T extends CellPatchUpdate = CellPatchUpdate> = {
	generation: number;
	previousValue: unknown;
	update: T;
};

export type AccumulatedValidationUpdates<T extends CellPatchUpdate = CellPatchUpdate> = ReadonlyMap<
	string,
	ReadonlyMap<string, VersionedCellUpdate<T>>
>;

export function mergeVersionedCellUpdates<T extends CellPatchUpdate>(
	current: ReadonlyMap<string, VersionedCellUpdate<T>> | undefined,
	updates: readonly VersionedCellUpdate<T>[]
): Map<string, VersionedCellUpdate<T>> {
	const next = new Map(current);
	for (const entry of updates) {
		const existing = next.get(entry.update.columnId);
		if (!existing || entry.generation >= existing.generation)
			next.set(entry.update.columnId, entry);
	}
	return next;
}

export function resolveVersionedCellUpdatesRowId<T extends CellPatchUpdate>(
	updates: readonly VersionedCellUpdate<T>[],
	rowId: string
): VersionedCellUpdate<T>[] {
	return updates.map((entry) => ({
		...entry,
		update: { ...entry.update, rowId }
	}));
}

export function mergeVersionedCellUpdatesForRow<T extends CellPatchUpdate>(
	current: AccumulatedValidationUpdates<T>,
	rowIds: readonly string[],
	direct: readonly VersionedCellUpdate<T>[],
	canonicalRowId: string
): VersionedCellUpdate<T>[] {
	let merged: Map<string, VersionedCellUpdate<T>> | undefined;
	for (const rowId of new Set(rowIds)) {
		merged = mergeVersionedCellUpdates(merged, Array.from(current.get(rowId)?.values() ?? []));
	}
	merged = mergeVersionedCellUpdates(merged, direct);
	return resolveVersionedCellUpdatesRowId(Array.from(merged.values()), canonicalRowId);
}

export function mergeAccumulatedValidationUpdates<T extends CellPatchUpdate>(
	current: AccumulatedValidationUpdates<T>,
	updates: readonly VersionedCellUpdate<T>[]
): Map<string, Map<string, VersionedCellUpdate<T>>> {
	const next = new Map(
		Array.from(current, ([rowId, rowUpdates]) => [rowId, new Map(rowUpdates)] as const)
	);
	for (const entry of updates) {
		const rowId = entry.update.rowId;
		next.set(rowId, mergeVersionedCellUpdates(next.get(rowId), [entry]));
	}
	return next;
}

export function clearAccumulatedValidationUpdates<T extends CellPatchUpdate>(
	current: AccumulatedValidationUpdates<T>,
	submitted: readonly VersionedCellUpdate<T>[]
): Map<string, Map<string, VersionedCellUpdate<T>>> {
	const next = new Map(
		Array.from(current, ([rowId, rowUpdates]) => [rowId, new Map(rowUpdates)] as const)
	);
	for (const entry of submitted) {
		const rowId = entry.update.rowId;
		const rowUpdates = next.get(rowId);
		if (rowUpdates?.get(entry.update.columnId)?.generation !== entry.generation) continue;
		rowUpdates.delete(entry.update.columnId);
		if (rowUpdates.size === 0) next.delete(rowId);
	}
	return next;
}

export function removeAccumulatedValidationRows<T extends CellPatchUpdate>(
	current: AccumulatedValidationUpdates<T>,
	rowIds: ReadonlySet<string>
): Map<string, Map<string, VersionedCellUpdate<T>>> {
	return new Map(
		Array.from(current)
			.filter(([rowId]) => !rowIds.has(rowId))
			.map(([rowId, rowUpdates]) => [rowId, new Map(rowUpdates)] as const)
	);
}

export function migrateAccumulatedValidationRow<T extends CellPatchUpdate>(
	current: AccumulatedValidationUpdates<T>,
	temporaryRowId: string,
	canonicalRowId: string
): Map<string, Map<string, VersionedCellUpdate<T>>> {
	const temporaryUpdates = current.get(temporaryRowId);
	if (!temporaryUpdates) {
		return new Map(
			Array.from(current, ([rowId, rowUpdates]) => [rowId, new Map(rowUpdates)] as const)
		);
	}
	const migrated = Array.from(temporaryUpdates.values(), (entry) => ({
		...entry,
		update: { ...entry.update, rowId: canonicalRowId }
	}));
	const next = removeAccumulatedValidationRows(current, new Set([temporaryRowId]));
	next.set(canonicalRowId, mergeVersionedCellUpdates(next.get(canonicalRowId), migrated));
	return next;
}

export function groupCellUpdates<T extends CellPatchUpdate>(
	updates: readonly T[],
	getPatchData: (update: T) => Record<string, unknown> = (update) => ({
		[update.columnId]: update.value
	})
) {
	type PatchMap = Record<
		string,
		{ index: number; data: Record<string, unknown>; columnIds: string[] }
	>;
	const patches: PatchMap = Object.create(null) as PatchMap;
	return updates.reduce<PatchMap>((acc, item) => {
		const patch = (acc[item.rowId] ??= { index: item.rowIndex, data: {}, columnIds: [] });
		mergePatchData(patch.data, getPatchData(item));
		if (!patch.columnIds.includes(item.columnId)) patch.columnIds.push(item.columnId);
		return acc;
	}, patches);
}

type PatchColumn = {
	id: string;
	valuePath?: string | readonly string[];
};

type ValidationColumn = {
	id: string;
	validationDependencies?: readonly string[];
};

export function expandValidationColumnIds(
	columnIds: readonly string[],
	columns: readonly ValidationColumn[]
): string[] {
	const availableColumnIds = new Set(columns.map(({ id }) => id));
	const dependencies = new Map(
		columns.map(({ id, validationDependencies }) => [id, validationDependencies ?? []])
	);
	const expanded = new Set(columnIds);
	for (const columnId of columnIds) {
		for (const dependency of dependencies.get(columnId) ?? []) {
			if (availableColumnIds.has(dependency)) expanded.add(dependency);
		}
	}
	return Array.from(expanded);
}

export function getColumnIdsForPatchError(
	errorColumn: string,
	columns: readonly PatchColumn[]
): string[] {
	const direct = columns.find((column) => column.id === errorColumn);
	if (direct) return [direct.id];

	const topLevelErrorColumn = errorColumn.split('.')[0];
	const topLevelDirect = columns.find((column) => column.id === topLevelErrorColumn);
	if (topLevelDirect) return [topLevelDirect.id];

	return columns.flatMap((column) => {
		const path = getValuePath(column.id, column.valuePath);
		const aliases = new Set([path.join('.'), path[0], path.at(-1), column.id.split('_').at(-1)]);
		return aliases.has(errorColumn) ? [column.id] : [];
	});
}

export function migrateCellKeyRowId(
	cellKey: string,
	temporaryRowId: string,
	canonicalRowId: string
): string {
	try {
		const parsed = JSON.parse(cellKey) as unknown;
		if (Array.isArray(parsed) && parsed.length === 2 && parsed[0] === temporaryRowId) {
			return JSON.stringify([canonicalRowId, parsed[1]]);
		}
	} catch {
		// Preserve unknown and legacy keys unchanged.
	}
	return cellKey;
}

export function migrateCellPositionRowId<T extends { rowId?: string }>(
	position: T | null,
	temporaryRowId: string,
	canonicalRowId: string
): T | null {
	return position?.rowId === temporaryRowId ? { ...position, rowId: canonicalRowId } : position;
}

export function partitionTemporaryRows<T extends { rowId: string }>(
	rows: readonly T[],
	isTemporary: (rowId: string) => boolean
): { temporary: T[]; persisted: T[] } {
	const temporary: T[] = [];
	const persisted: T[] = [];
	for (const row of rows) (isTemporary(row.rowId) ? temporary : persisted).push(row);
	return { temporary, persisted };
}

export async function deleteRowsByPersistence<T extends { rowId: string }>(
	rows: readonly T[],
	isTemporary: (rowId: string) => boolean,
	resolveRowId: (rowId: string) => string,
	getSequenceKey: (rowId: string) => string,
	sequenceMutation: <R>(key: string, mutation: () => Promise<R>) => Promise<R>,
	deletePersisted: ((row: T, rowId: string) => Promise<boolean>) | undefined,
	removeTemporary: (rows: readonly T[]) => void,
	onPersistedDeleteFailure?: (row: T, rowId: string) => void
): Promise<{ deletedRowIds: string[]; failedRowIds: string[]; deletedPersistedRowIds: string[] }> {
	const { temporary } = partitionTemporaryRows(rows, isTemporary);
	removeTemporary(temporary);
	const temporarySet = new Set(temporary);
	const results = await Promise.all(
		rows.map(async (row) => {
			const wasTemporary = temporarySet.has(row);
			let resolvedRowId: string | undefined;
			try {
				return await sequenceMutation(getSequenceKey(row.rowId), async () => {
					resolvedRowId = resolveRowId(row.rowId);
					if (wasTemporary && resolvedRowId === row.rowId) return { deleted: true };
					if (!deletePersisted) {
						onPersistedDeleteFailure?.(row, resolvedRowId);
						return { deleted: false, failedRowId: resolvedRowId };
					}
					const deleted = await deletePersisted(row, resolvedRowId);
					if (!deleted) onPersistedDeleteFailure?.(row, resolvedRowId);
					return {
						deleted,
						failedRowId: deleted ? undefined : resolvedRowId,
						persistedRowId: deleted ? resolvedRowId : undefined
					};
				});
			} catch {
				if (resolvedRowId !== undefined) onPersistedDeleteFailure?.(row, resolvedRowId);
				return { deleted: false, failedRowId: resolvedRowId ?? row.rowId };
			}
		})
	);
	const deletedRowIds = rows.flatMap((row, index) => (results[index]?.deleted ? [row.rowId] : []));
	return {
		deletedRowIds,
		failedRowIds: results.flatMap(({ failedRowId }) => (failedRowId ? [failedRowId] : [])),
		deletedPersistedRowIds: results.flatMap(({ persistedRowId }) =>
			persistedRowId ? [persistedRowId] : []
		)
	};
}

export function appendLocalDraftRows<T>(
	rows: readonly T[],
	count: number,
	resolveDraft: (draft: Partial<T>, rowIndex: number, rows: readonly T[]) => Partial<T>,
	registerDraft: (draft: T, rowIndex: number, rows: readonly T[]) => string
): { rows: T[]; drafts: T[]; rowIds: string[] } {
	const nextRows = [...rows];
	const drafts: T[] = [];
	const rowIds: string[] = [];
	for (let offset = 0; offset < count; offset++) {
		const rowIndex = nextRows.length;
		const draft = { ...resolveDraft({}, rowIndex, nextRows) } as T;
		const rowId = registerDraft(draft, rowIndex, nextRows);
		drafts.push(draft);
		rowIds.push(rowId);
		nextRows.push(draft);
	}
	return { rows: nextRows, drafts, rowIds };
}

type MutationOptions<T> = {
	valuePath?: string | readonly string[];
	setValue?: (row: T, value: unknown) => T;
	serializePatch?: (row: T, value: unknown) => Partial<T>;
};

function getValuePath(columnId: string, valuePath?: string | readonly string[]): readonly string[] {
	const configuredPath = valuePath ?? columnId;
	return typeof configuredPath === 'string'
		? configuredPath.split('.').filter(Boolean)
		: configuredPath;
}

function setNestedValue(target: Record<string, unknown>, path: readonly string[], value: unknown) {
	let current = target;
	for (const segment of path.slice(0, -1)) {
		const child = current[segment];
		const next =
			child && typeof child === 'object' && !Array.isArray(child)
				? { ...(child as Record<string, unknown>) }
				: {};
		current[segment] = next;
		current = next;
	}
	if (path.length) current[path.at(-1)!] = value;
}

export function buildPatchData<T>(
	row: T,
	columnId: string,
	value: unknown,
	options?: MutationOptions<T>
): Record<string, unknown> {
	if (options?.serializePatch) return options.serializePatch(row, value) as Record<string, unknown>;
	const patch: Record<string, unknown> = {};
	setNestedValue(patch, getValuePath(columnId, options?.valuePath), value);
	return patch;
}

export function mergePatchData(
	target: Record<string, unknown>,
	patch: Record<string, unknown>
): Record<string, unknown> {
	for (const [key, value] of Object.entries(patch)) {
		const existing = target[key];
		target[key] =
			value &&
			typeof value === 'object' &&
			!Array.isArray(value) &&
			existing &&
			typeof existing === 'object' &&
			!Array.isArray(existing)
				? mergePatchData(
						{ ...(existing as Record<string, unknown>) },
						value as Record<string, unknown>
					)
				: value;
	}
	return target;
}

export function setImmutableValue<T>(
	row: T,
	columnId: string,
	value: unknown,
	options?: MutationOptions<T>
): T {
	if (options?.setValue) return options.setValue(row, value);
	const path = getValuePath(columnId, options?.valuePath);
	if (path.length === 0) return row;

	const root = { ...(row as Record<string, unknown>) };
	setNestedValue(root, path, value);
	return root as T;
}
