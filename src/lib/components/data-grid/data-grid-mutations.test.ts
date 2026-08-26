import { describe, expect, it, vi } from 'vitest';
import {
	appendLocalDraftRows,
	areEditValuesEqual,
	buildPatchData,
	clearAccumulatedValidationUpdates,
	cloneEditValue,
	createKeyedSequencer,
	createRowIdentityRegistry,
	deleteRowsByPersistence,
	expandValidationColumnIds,
	getColumnIdsForPatchError,
	getDraftValidationDisposition,
	getEarliestPendingValue,
	groupCellUpdates,
	mergeAccumulatedValidationUpdates,
	mergeVersionedCellUpdates,
	mergeVersionedCellUpdatesForRow,
	migrateAccumulatedValidationRow,
	migrateCellKeyRowId,
	migrateCellPositionRowId,
	mergePatchData,
	partitionTemporaryRows,
	removeAccumulatedValidationRows,
	setImmutableValue
} from './data-grid-mutations.js';

describe('data grid mutations', () => {
	it('serializes mutations for a row without blocking other rows', async () => {
		const sequence = createKeyedSequencer();
		const events: string[] = [];
		let releaseFirst!: () => void;
		const gate = new Promise<void>((resolve) => (releaseFirst = resolve));

		const first = sequence('a', async () => {
			events.push('a1:start');
			await gate;
			events.push('a1:end');
		});
		const second = sequence('a', async () => events.push('a2'));
		await sequence('b', async () => events.push('b'));
		expect(events).toEqual(['a1:start', 'b']);
		releaseFirst();
		await Promise.all([first, second]);
		expect(events).toEqual(['a1:start', 'b', 'a1:end', 'a2']);
	});

	it('continues a row queue after a failed mutation', async () => {
		const sequence = createKeyedSequencer();
		await expect(sequence('a', async () => Promise.reject(new Error('no')))).rejects.toThrow('no');
		await expect(sequence('a', async () => 'yes')).resolves.toBe('yes');
	});

	it('serializes overlapping multi-row mutations in deterministic order', async () => {
		const sequence = createKeyedSequencer();
		const events: string[] = [];
		let releaseFirst!: () => void;
		const gate = new Promise<void>((resolve) => (releaseFirst = resolve));
		const first = sequence.sequenceKeys(['b', 'a'], async () => {
			events.push('first:start');
			await gate;
			events.push('first:end');
		});
		const second = sequence.sequenceKeys(['c', 'b'], async () => events.push('second'));
		await sequence('d', async () => events.push('independent'));
		expect(events).toEqual(['first:start', 'independent']);
		releaseFirst();
		await Promise.all([first, second]);
		expect(events).toEqual(['first:start', 'independent', 'first:end', 'second']);
	});

	it('writes nested values immutably', () => {
		const row = { details: { name: 'old' }, untouched: true };
		const next = setImmutableValue(row, 'displayName', 'new', { valuePath: 'details.name' });
		expect(next).toEqual({ details: { name: 'new' }, untouched: true });
		expect(row.details.name).toBe('old');
	});

	it('builds nested adapter patches compatible with optimistic writes', () => {
		const row = { details: { name: 'old', code: 'A' } };
		const options = { valuePath: 'details.name' } as const;
		expect(buildPatchData(row, 'displayName', 'new', options)).toEqual({
			details: { name: 'new' }
		});
		expect(setImmutableValue(row, 'displayName', 'new', options)).toEqual({
			details: { name: 'new', code: 'A' }
		});
	});

	it('retains submitted grid column IDs separately from nested patch data', () => {
		const updates = [
			{ rowId: '1', rowIndex: 0, columnId: 'displayName', value: 'first' },
			{ rowId: '1', rowIndex: 0, columnId: 'displayName', value: 'second' }
		];
		expect(
			groupCellUpdates(updates, (update) => ({ details: { name: update.value } }))['1']
		).toEqual({
			index: 0,
			data: { details: { name: 'second' } },
			columnIds: ['displayName']
		});
	});

	it('resubmits an unresolved type update with the newly entered embed URL', () => {
		const type = {
			generation: 1,
			previousValue: 'page',
			update: {
				rowId: 'page-1',
				rowIndex: 0,
				columnId: 'type',
				value: 'externalPage'
			}
		};
		const embedUrl = {
			generation: 1,
			previousValue: null,
			update: {
				rowId: 'page-1',
				rowIndex: 0,
				columnId: 'embedUrl',
				value: 'https://example.com/embed'
			}
		};
		const afterValidation = mergeAccumulatedValidationUpdates(new Map(), [type]);
		const submitted = Array.from(
			mergeVersionedCellUpdates(afterValidation.get('page-1'), [embedUrl]).values()
		).map(({ update }) => update);

		expect(groupCellUpdates(submitted)['page-1']).toEqual({
			index: 0,
			data: { type: 'externalPage', embedUrl: 'https://example.com/embed' },
			columnIds: ['type', 'embedUrl']
		});
	});

	it('uses the newest accumulated value for each grid column', () => {
		const update = (generation: number, value: string) => ({
			generation,
			previousValue: 'original',
			update: { rowId: '1', rowIndex: 0, columnId: 'type', value }
		});
		const merged = mergeVersionedCellUpdates(undefined, [update(2, 'newest'), update(1, 'stale')]);

		expect(merged.get('type')?.update.value).toBe('newest');
	});

	it('clears only accumulated generations included in a successful request', () => {
		const oldType = {
			generation: 1,
			previousValue: 'page',
			update: { rowId: '1', rowIndex: 0, columnId: 'type', value: 'externalPage' }
		};
		const newerType = { ...oldType, generation: 2, update: { ...oldType.update, value: 'page' } };
		const embedUrl = {
			generation: 1,
			previousValue: null,
			update: { rowId: '1', rowIndex: 0, columnId: 'embedUrl', value: 'https://example.com' }
		};
		let accumulated = mergeAccumulatedValidationUpdates(new Map(), [newerType, embedUrl]);
		accumulated = clearAccumulatedValidationUpdates(accumulated, [oldType, embedUrl]);

		expect(Array.from(accumulated.get('1')?.values() ?? [])).toEqual([newerType]);
	});

	it('serializes accumulated value-path updates through normal patch construction', () => {
		const row = { details: { name: 'old', url: null as string | null } };
		const updates = [
			{ rowId: '1', rowIndex: 0, columnId: 'displayName', value: 'new' },
			{ rowId: '1', rowIndex: 0, columnId: 'embedUrl', value: 'https://example.com' }
		];
		const patch = groupCellUpdates(updates, (update) =>
			buildPatchData(row, update.columnId, update.value, {
				valuePath: `details.${update.columnId === 'displayName' ? 'name' : 'url'}`
			})
		);

		expect(patch['1']?.data).toEqual({
			details: { name: 'new', url: 'https://example.com' }
		});
	});

	it('migrates and removes accumulated row validation updates by lifecycle identity', () => {
		const entry = {
			generation: 1,
			previousValue: 'page',
			update: { rowId: 'new-1', rowIndex: 0, columnId: 'type', value: 'externalPage' }
		};
		const accumulated = mergeAccumulatedValidationUpdates(new Map(), [entry]);
		const migrated = migrateAccumulatedValidationRow(accumulated, 'new-1', 'page-1');

		expect(migrated.has('new-1')).toBe(false);
		expect(migrated.get('page-1')?.get('type')?.update.rowId).toBe('page-1');
		expect(removeAccumulatedValidationRows(migrated, new Set(['page-1'])).size).toBe(0);
	});

	it('canonicalizes queued updates and merges validation state from temporary and canonical IDs', () => {
		const temporaryType = {
			generation: 1,
			previousValue: 'page',
			update: { rowId: 'new-1', rowIndex: 0, columnId: 'type', value: 'externalPage' }
		};
		const canonicalEmbedUrl = {
			generation: 2,
			previousValue: null,
			update: {
				rowId: 'canonical-1',
				rowIndex: 0,
				columnId: 'embedUrl',
				value: 'https://example.com'
			}
		};
		let accumulated = mergeAccumulatedValidationUpdates(new Map(), [temporaryType]);
		accumulated = mergeAccumulatedValidationUpdates(accumulated, [canonicalEmbedUrl]);

		const submitted = mergeVersionedCellUpdatesForRow(
			accumulated,
			['canonical-1', 'new-1'],
			[],
			'canonical-1'
		);

		expect(submitted.map(({ update }) => update.rowId)).toEqual(['canonical-1', 'canonical-1']);
		expect(submitted.map(({ update }) => update.columnId).sort()).toEqual(['embedUrl', 'type']);
		expect(mergeAccumulatedValidationUpdates(new Map(), submitted).has('canonical-1')).toBe(true);
		expect(mergeAccumulatedValidationUpdates(new Map(), submitted).has('new-1')).toBe(false);
	});

	it('expands successful validation through generic column dependencies', () => {
		expect(
			expandValidationColumnIds(
				['type', 'slug', 'type'],
				[
					{ id: 'type', validationDependencies: ['embedUrl', 'configuration', 'missing'] },
					{ id: 'slug' },
					{ id: 'embedUrl' },
					{ id: 'configuration' }
				]
			)
		).toEqual(['type', 'slug', 'embedUrl', 'configuration']);
	});

	it.each(['details', 'name', 'details.name'])(
		'maps the %s value-path error alias to its grid column ID',
		(errorColumn) => {
			expect(
				getColumnIdsForPatchError(errorColumn, [{ id: 'displayName', valuePath: 'details.name' }])
			).toEqual(['displayName']);
		}
	);

	it('prefers a direct grid column ID over a value-path alias', () => {
		expect(
			getColumnIdsForPatchError('name', [
				{ id: 'name' },
				{ id: 'displayName', valuePath: 'details.name' }
			])
		).toEqual(['name']);
	});

	it('supports explicit serializers for computed setters and merges sibling patches', () => {
		const row = { profile: { first: 'A', last: 'B' } };
		const options = {
			setValue: (current: typeof row, value: unknown) => ({
				...current,
				profile: { ...current.profile, first: String(value) }
			}),
			serializePatch: (_current: typeof row, value: unknown) => ({
				profile: { first: String(value), last: 'B' }
			})
		};
		expect(buildPatchData(row, 'name', 'C', options)).toEqual({
			profile: { first: 'C', last: 'B' }
		});
		expect(mergePatchData({ profile: { first: 'C' } }, { profile: { last: 'D' } })).toEqual({
			profile: { first: 'C', last: 'D' }
		});
	});

	it('clones and compares supported edit snapshot values without sharing mutable data', () => {
		const value = { list: [{ at: new Date('2026-08-21T00:00:00Z') }], enabled: true };
		const snapshot = cloneEditValue(value);
		expect(snapshot).not.toBe(value);
		expect(snapshot.list).not.toBe(value.list);
		expect(snapshot.list[0]?.at).not.toBe(value.list[0]?.at);
		expect(areEditValuesEqual(snapshot, value)).toBe(true);
		snapshot.list[0]!.at.setUTCDate(22);
		expect(areEditValuesEqual(snapshot, value)).toBe(false);
	});

	it('keeps the earliest pending rollback baseline', () => {
		const first = { nested: ['original'] };
		const baseline = getEarliestPendingValue(undefined, first);
		first.nested[0] = 'changed';
		expect(baseline).toEqual({ nested: ['original'] });
		expect(getEarliestPendingValue({ previousValue: baseline }, 'later')).toBe(baseline);
	});

	it('appends distinct immutable local drafts', () => {
		const source = [{ id: 'existing', required: 'ready' }];
		let sequence = 0;
		const result = appendLocalDraftRows(
			source,
			2,
			(_draft, index) => ({ required: `default-${index}` }),
			() => `new-${++sequence}`
		);
		expect(source).toEqual([{ id: 'existing', required: 'ready' }]);
		expect(result.rowIds).toEqual(['new-1', 'new-2']);
		expect(result.drafts).toEqual([{ required: 'default-1' }, { required: 'default-2' }]);
	});

	it('preserves explicit temporary identity across immutable clones', () => {
		const identities = createRowIdentityRegistry<object>();
		const draft = { name: 'draft' };
		const clone = { ...draft, name: 'edited' };
		identities.registerTemporary(draft, 'new-1');
		identities.carry(draft, clone);
		expect(identities.getTemporaryId(clone)).toBe('new-1');
		expect(identities.isTemporary('new-1')).toBe(true);
	});

	it('does not infer temporary status from a persisted new-prefixed ID', () => {
		const identities = createRowIdentityRegistry<object>();
		expect(identities.isTemporary('new-persisted')).toBe(false);
		expect(identities.resolve('new-persisted')).toBe('new-persisted');
	});

	it('keeps one sequence key across temporary and canonical row IDs', () => {
		const identities = createRowIdentityRegistry<object>();
		const draft = {};
		identities.registerTemporary(draft, 'new-1');
		const sequenceKey = identities.getSequenceKey('new-1');

		identities.recordCanonical('new-1', 'canonical-1');

		expect(identities.getSequenceKey('new-1')).toBe(sequenceKey);
		expect(identities.getSequenceKey('canonical-1')).toBe(sequenceKey);
	});

	it('preserves a valid draft value when validation reports a different missing column', () => {
		let draft = {} as { a?: string; b?: string };
		draft = setImmutableValue(draft, 'a', 'value-a');
		const disposition = getDraftValidationDisposition(['a'], new Set(['b']));

		expect(draft).toEqual({ a: 'value-a' });
		expect(disposition).toEqual({
			validColumnIds: ['a'],
			invalidColumnIds: [],
			errorColumnIds: ['b']
		});

		draft = setImmutableValue(draft, 'b', 'value-b');
		const createPayload = { ...draft };
		expect(createPayload).toEqual({ a: 'value-a', b: 'value-b' });
	});

	it('keeps invalid submitted draft values visible and errors only those columns', () => {
		const draft = setImmutableValue({ b: 'valid-b' }, 'a', 'invalid-a');
		const disposition = getDraftValidationDisposition(['a', 'b'], new Set(['a']));

		expect(draft).toEqual({ a: 'invalid-a', b: 'valid-b' });
		expect(disposition).toEqual({
			validColumnIds: ['b'],
			invalidColumnIds: ['a'],
			errorColumnIds: ['a']
		});
	});

	it('creates a concurrently edited draft once and resolves later work to its canonical ID', async () => {
		const identities = createRowIdentityRegistry<object>();
		const sequence = createKeyedSequencer();
		const draft = { name: 'first' };
		identities.registerTemporary(draft, 'new-1');
		let creates = 0;
		const mutations: string[] = [];
		let releaseCreate!: () => void;
		const createGate = new Promise<void>((resolve) => (releaseCreate = resolve));
		const mutate = (rowId: string, patch: string) =>
			sequence(identities.getSequenceKey(rowId), async () => {
				if (identities.isTemporary('new-1')) {
					creates++;
					identities.recordCanonical('new-1', 'canonical-1');
					mutations.push(`create:${patch}`);
					await createGate;
					return;
				}
				mutations.push(`update:${identities.resolve('new-1')}:${patch}`);
			});

		const first = mutate('new-1', 'first');
		await vi.waitFor(() => expect(mutations).toEqual(['create:first']));
		const second = mutate('canonical-1', 'second');
		await Promise.resolve();
		expect(mutations).toEqual(['create:first']);
		releaseCreate();
		await Promise.all([first, second]);
		expect(creates).toBe(1);
		expect(mutations).toEqual(['create:first', 'update:canonical-1:second']);
	});

	it('migrates retained cell keys and positions to a canonical row ID', () => {
		expect(migrateCellKeyRowId('["new-1","name"]', 'new-1', 'canonical-1')).toBe(
			'["canonical-1","name"]'
		);
		expect(
			migrateCellPositionRowId(
				{ rowId: 'new-1', rowIndex: 2, columnId: 'name' },
				'new-1',
				'canonical-1'
			)
		).toEqual({ rowId: 'canonical-1', rowIndex: 2, columnId: 'name' });
	});

	it('partitions explicit temporary rows from persisted rows', () => {
		expect(
			partitionTemporaryRows(
				[
					{ rowId: 'new-1', value: 'draft' },
					{ rowId: 'canonical-1', value: 'saved' }
				],
				(rowId) => rowId === 'new-1'
			)
		).toEqual({
			temporary: [{ rowId: 'new-1', value: 'draft' }],
			persisted: [{ rowId: 'canonical-1', value: 'saved' }]
		});
	});

	it('removes temporary drafts locally before deleting only persisted rows', async () => {
		const sequence = createKeyedSequencer();
		let releaseDelete!: (deleted: boolean) => void;
		const deleteResult = new Promise<boolean>((resolve) => (releaseDelete = resolve));
		const adapterCalls: string[] = [];
		const locallyRemoved: string[] = [];
		const deletion = deleteRowsByPersistence(
			[{ rowId: 'new-1' }, { rowId: 'canonical-1' }, { rowId: 'canonical-2' }],
			(rowId) => rowId === 'new-1',
			(rowId) => rowId,
			(rowId) => rowId,
			(key, mutation) => sequence(key, mutation),
			async (_row, rowId) => {
				adapterCalls.push(rowId);
				return rowId === 'canonical-1' ? deleteResult : false;
			},
			(rows) => locallyRemoved.push(...rows.map(({ rowId }) => rowId))
		);

		expect(locallyRemoved).toEqual(['new-1']);
		await vi.waitFor(() => expect(adapterCalls).toEqual(['canonical-1', 'canonical-2']));
		releaseDelete(true);
		await expect(deletion).resolves.toEqual({
			deletedRowIds: ['new-1', 'canonical-1'],
			failedRowIds: ['canonical-2'],
			deletedPersistedRowIds: ['canonical-1']
		});
	});

	it('deletes a canonical row after an in-flight draft create without calling a temporary ID', async () => {
		const identities = createRowIdentityRegistry<object>();
		const sequence = createKeyedSequencer();
		const draft = { rowId: 'new-1' };
		identities.registerTemporary(draft, draft.rowId);
		let releaseCreate!: () => void;
		const createGate = new Promise<void>((resolve) => (releaseCreate = resolve));
		const events: string[] = [];
		const create = sequence(identities.getSequenceKey(draft.rowId), async () => {
			events.push('create:start');
			await createGate;
			identities.recordCanonical(draft.rowId, 'canonical-1');
			events.push('create:end');
		});
		const locallyRemoved: string[] = [];
		const deletion = deleteRowsByPersistence(
			[draft],
			(rowId) => identities.isTemporary(rowId),
			(rowId) => identities.resolve(rowId),
			(rowId) => identities.getSequenceKey(rowId),
			(key, mutation) => sequence(key, mutation),
			async (_row, rowId) => {
				events.push(`delete:${rowId}`);
				return true;
			},
			(rows) => locallyRemoved.push(...rows.map(({ rowId }) => rowId))
		);

		expect(locallyRemoved).toEqual(['new-1']);
		await vi.waitFor(() => expect(events).toEqual(['create:start']));
		releaseCreate();
		await create;
		await expect(deletion).resolves.toEqual({
			deletedRowIds: ['new-1'],
			failedRowIds: [],
			deletedPersistedRowIds: ['canonical-1']
		});
		expect(events).toEqual(['create:start', 'create:end', 'delete:canonical-1']);
	});

	it.each([false, 'throw'] as const)(
		'restores one canonical created row when subsequent delete returns %s',
		async (failure) => {
			const identities = createRowIdentityRegistry<object>();
			const sequence = createKeyedSequencer();
			const draft = { rowId: 'new-1', value: 'draft' };
			const created = { rowId: 'canonical-1', value: 'created' };
			identities.registerTemporary(draft, draft.rowId);
			const canonicalCreatedRows = new Map([[created.rowId, created]]);
			const localRows: Array<typeof draft | typeof created> = [];
			let releaseCreate!: () => void;
			const createGate = new Promise<void>((resolve) => (releaseCreate = resolve));
			const create = sequence(identities.getSequenceKey(draft.rowId), async () => {
				await createGate;
				identities.recordCanonical(draft.rowId, created.rowId);
			});
			const restored: string[] = [];
			const deletion = deleteRowsByPersistence(
				[draft],
				(rowId) => identities.isTemporary(rowId),
				(rowId) => identities.resolve(rowId),
				(rowId) => identities.getSequenceKey(rowId),
				(key, mutation) => sequence(key, mutation),
				async () => {
					if (failure === 'throw') throw new Error('delete failed');
					return false;
				},
				() => undefined,
				(_row, canonicalId) => {
					const row = canonicalCreatedRows.get(canonicalId);
					if (row && !localRows.some(({ rowId }) => rowId === canonicalId)) localRows.push(row);
					canonicalCreatedRows.delete(canonicalId);
					restored.push(canonicalId);
				}
			);

			releaseCreate();
			await create;
			await expect(deletion).resolves.toEqual({
				deletedRowIds: [],
				failedRowIds: ['canonical-1'],
				deletedPersistedRowIds: []
			});
			expect(localRows).toEqual([created]);
			expect(restored).toEqual(['canonical-1']);
			expect(canonicalCreatedRows.size).toBe(0);
		}
	);

	it('cleans the canonical created-row snapshot after successful queued deletion', async () => {
		const identities = createRowIdentityRegistry<object>();
		const sequence = createKeyedSequencer();
		const draft = { rowId: 'new-1' };
		identities.registerTemporary(draft, draft.rowId);
		identities.recordCanonical(draft.rowId, 'canonical-1');
		const canonicalCreatedRows = new Map([['canonical-1', { rowId: 'canonical-1' }]]);
		const restored: string[] = [];

		const result = await deleteRowsByPersistence(
			[draft],
			(rowId) => identities.isTemporary(rowId),
			(rowId) => identities.resolve(rowId),
			(rowId) => identities.getSequenceKey(rowId),
			(key, mutation) => sequence(key, mutation),
			async () => true,
			() => undefined,
			(_row, canonicalId) => restored.push(canonicalId)
		);
		for (const rowId of result.deletedPersistedRowIds) canonicalCreatedRows.delete(rowId);

		expect(restored).toEqual([]);
		expect(canonicalCreatedRows.size).toBe(0);
	});

	it('removes uncreated drafts locally without delete capability but fails created drafts', async () => {
		const identities = createRowIdentityRegistry<object>();
		const sequence = createKeyedSequencer();
		const localDraft = { rowId: 'new-1' };
		const createdDraft = { rowId: 'new-2' };
		identities.registerTemporary(localDraft, localDraft.rowId);
		identities.registerTemporary(createdDraft, createdDraft.rowId);
		let releaseCreate!: () => void;
		const createGate = new Promise<void>((resolve) => (releaseCreate = resolve));
		const create = sequence(identities.getSequenceKey(createdDraft.rowId), async () => {
			await createGate;
			identities.recordCanonical(createdDraft.rowId, 'canonical-2');
		});
		const locallyRemoved: string[] = [];

		const deletion = deleteRowsByPersistence(
			[localDraft, createdDraft, { rowId: 'canonical-3' }],
			(rowId) => identities.isTemporary(rowId),
			(rowId) => identities.resolve(rowId),
			(rowId) => identities.getSequenceKey(rowId),
			(key, mutation) => sequence(key, mutation),
			undefined,
			(rows) => locallyRemoved.push(...rows.map(({ rowId }) => rowId))
		);
		expect(locallyRemoved).toEqual(['new-1', 'new-2']);
		releaseCreate();
		await create;
		await expect(deletion).resolves.toEqual({
			deletedRowIds: ['new-1'],
			failedRowIds: ['canonical-2', 'canonical-3'],
			deletedPersistedRowIds: []
		});
	});
});
