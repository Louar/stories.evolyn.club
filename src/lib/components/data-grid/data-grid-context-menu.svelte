<script lang="ts" generics="TData extends RowData">
	import {
		parseCellKey,
		type DataGridDuplicateTarget
	} from '$lib/components/data-grid/types/data-grid.js';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuLabel,
		DropdownMenuSeparator,
		DropdownMenuSub,
		DropdownMenuSubContent,
		DropdownMenuSubTrigger,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu/index.js';
	import Copy from '@lucide/svelte/icons/copy';
	import Eraser from '@lucide/svelte/icons/eraser';
	import FileDownIcon from '@lucide/svelte/icons/file-down';
	// import Scissors from '@lucide/svelte/icons/scissors';
	import type { RowData, Table } from '$lib/components/data-grid/data-grid-table.js';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { toast } from 'svelte-sonner';
	import DataGridDeleteDialog from './data-grid-delete-dialog.svelte';

	interface Props {
		table: Table<TData>;
	}

	let { table }: Props = $props();

	const meta = $derived(table.options.meta);
	const contextMenu = $derived(meta?.contextMenu);
	const onContextMenuOpenChange = $derived(meta?.onContextMenuOpenChange);
	const selectionState = $derived(meta?.selectionState);
	const dataGridRef = $derived(meta?.dataGridRef);
	const onRowsDeleteRequest = $derived(meta?.onRowsDeleteRequest);
	const onDownload = $derived(meta?.onDownload);
	const onRowsDuplicate = $derived(meta?.onRowsDuplicate);
	const rowDuplicateTargets = $derived(meta?.getRowDuplicateTargets?.() ?? []);
	const currentDuplicateTarget = $derived(
		rowDuplicateTargets.find((target) => target.appendToCurrentGrid)
	);
	const otherDuplicateTargets = $derived(
		rowDuplicateTargets.filter((target) => !target.appendToCurrentGrid)
	);
	const groupedDuplicateTargets = $derived.by(() => {
		return otherDuplicateTargets.reduce<
			Array<{ id: string; slug?: string; label: string; targets: DataGridDuplicateTarget[] }>
		>((groups, target) => {
			const group = target.group ?? { id: '', label: '' };
			const existing = groups.find(({ id }) => id === group.id);
			if (!existing) {
				return [
					...groups,
					{ id: group.id, label: group.label, slug: group.slug, targets: [target] }
				];
			}
			return groups.map((item) =>
				item.id === group.id ? { ...item, targets: [...item.targets, target] } : item
			);
		}, []);
	});
	// const onCellsCut = $derived(meta?.onCellsCut);
	const onCellsClear = $derived(meta?.onCellsClear);
	const readOnly = $derived(meta?.readOnly ?? false);

	// Trigger style to position the menu at the context menu coordinates
	const triggerStyle = $derived.by(() => {
		if (!contextMenu) return '';
		return `position: fixed; left: ${contextMenu.x}px; top: ${contextMenu.y}px; width: 1px; height: 1px; padding: 0; margin: 0; border: none; background: transparent; pointer-events: none; opacity: 0;`;
	});

	function onCloseAutoFocus(event: Event) {
		event.preventDefault();
		if (meta?.deleteDialog?.open) return;
		if (dataGridRef instanceof HTMLElement) {
			dataGridRef.focus();
		}
	}

	async function onDuplicate(targetId?: string) {
		await onRowsDuplicate?.(targetId);
	}

	// async function onCut() {
	// 	await onCellsCut?.();
	// }

	function resolveCellPosition(cellKey: string) {
		const position = parseCellKey(cellKey);
		const rowIndex = position.rowId
			? table.getRowModel().rows.findIndex((row) => row.id === position.rowId)
			: position.rowIndex;
		return { ...position, rowIndex };
	}

	async function onClear() {
		const result = await onCellsClear?.();
		if (!result) return;
		const parts = [
			`${result.clearedCellCount} cell${result.clearedCellCount === 1 ? '' : 's'} cleared`
		];
		if (result.failedCellCount) parts.push(`${result.failedCellCount} failed`);
		if (result.deletedMediaCount) parts.push(`${result.deletedMediaCount} media deleted`);
		if (result.retainedMediaCount) parts.push(`${result.retainedMediaCount} shared media retained`);
		if (result.failedMediaCount) parts.push(`${result.failedMediaCount} media deletions failed`);
		const message = parts.join(', ');
		if (result.failedCellCount || result.failedMediaCount) toast.error(message);
		else if (result.clearedCellCount) toast.success(message);
	}

	function onDelete() {
		const rows = table.getRowModel().rows;
		const rowIndices = rows.flatMap((row, rowIndex) => (row.getIsSelected() ? [rowIndex] : []));

		if (rowIndices.length === 0) {
			if (!selectionState?.selectedCells || selectionState.selectedCells.size === 0) return;
			for (const cellKey of selectionState.selectedCells) {
				const { rowIndex } = resolveCellPosition(cellKey);
				if (rowIndex >= 0 && !rowIndices.includes(rowIndex)) rowIndices.push(rowIndex);
			}
		}

		const rowIndicesArray = rowIndices.sort((a, b) => a - b);
		onRowsDeleteRequest?.(rowIndicesArray);
	}

	async function onDownloadRows() {
		await onDownload?.();
	}
</script>

{#if contextMenu}
	<DropdownMenu open={contextMenu.open} onOpenChange={onContextMenuOpenChange}>
		<DropdownMenuTrigger style={triggerStyle}></DropdownMenuTrigger>
		<DropdownMenuContent data-grid-popover="" align="start" class="w-48" {onCloseAutoFocus}>
			{#if onRowsDuplicate && (meta?.getSelectedRowCount?.() ?? 0) > 0}
				<DropdownMenuItem
					onSelect={() => onDuplicate(currentDuplicateTarget?.id)}
					disabled={readOnly || meta?.getIsDuplicating?.()}
				>
					<Copy class="mr-2 size-4" />
					Duplicate
				</DropdownMenuItem>
				{#if groupedDuplicateTargets.length}
					<DropdownMenuSub>
						<DropdownMenuSubTrigger disabled={readOnly || meta?.getIsDuplicating?.()}>
							<Copy class="mr-2 size-4" />
							Duplicate to
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent
							align="start"
							sideOffset={4}
							class="max-h-80 w-64 muted-scrollbar overflow-y-auto py-0"
						>
							{#each groupedDuplicateTargets as group (group.id)}
								{#if group.label}
									<DropdownMenuLabel
										class="sticky top-0 z-10 -mx-1 mb-1 border-b bg-popover px-3 py-2 text-xs font-medium"
									>
										<span class="block truncate">{group.label}</span>
										{#if group.slug}
											<span class="block truncate font-normal text-muted-foreground"
												>{group.slug}</span
											>
										{/if}
									</DropdownMenuLabel>
								{/if}
								{#each group.targets as target (target.id)}
									<DropdownMenuItem onSelect={() => onDuplicate(target.id)}>
										<div class="min-w-0">
											<p class="line-clamp-3 text-xs">{target.label}</p>
											{#if target.description}
												<p class="line-clamp-3 text-xs text-muted-foreground">
													{target.description}
												</p>
											{/if}
										</div>
									</DropdownMenuItem>
								{/each}
							{/each}
						</DropdownMenuSubContent>
					</DropdownMenuSub>
				{/if}
				<DropdownMenuSeparator />
			{/if}
			<!-- <DropdownMenuItem onSelect={onCut} disabled={readOnly}>
				<Scissors class="mr-2 size-4" />
				Cut
			</DropdownMenuItem> -->
			<DropdownMenuItem onSelect={onClear} disabled={readOnly}>
				<Eraser class="mr-2 size-4" />
				Clear
			</DropdownMenuItem>
			{#if onDownload && contextMenu.isSelectedRow}
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={onDownloadRows} disabled={meta?.getIsDownloading?.()}>
					<FileDownIcon class="mr-2 size-4" />
					Download
				</DropdownMenuItem>
			{/if}
			{#if onRowsDeleteRequest && contextMenu.isSelectedRow}
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="destructive" onSelect={onDelete}>
					<Trash2 class="mr-2 size-4" />
					Delete rows
				</DropdownMenuItem>
			{/if}
		</DropdownMenuContent>
	</DropdownMenu>
{/if}

<DataGridDeleteDialog {table} />
