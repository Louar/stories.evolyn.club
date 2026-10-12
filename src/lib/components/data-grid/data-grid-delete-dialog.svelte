<script lang="ts" generics="TData extends RowData">
	import type { RowData, Table } from '$lib/components/data-grid/data-grid-table.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import TrashIcon from '@lucide/svelte/icons/trash-2';

	interface Props {
		table: Table<TData>;
	}

	let { table }: Props = $props();

	const meta = $derived(table.options.meta);
	const deleteDialog = $derived(meta?.deleteDialog);
	const confirmation = $derived(meta?.deleteConfirmation);
	const onOpenChange = $derived(meta?.onDeleteDialogOpenChange);
	const onForceChange = $derived(meta?.onDeleteDialogForceChange);
	const onConfirm = $derived(meta?.onRowsDeleteConfirm);
	const itemLabel = $derived(
		deleteDialog?.rowCount === 1
			? (confirmation?.itemLabel?.singular ?? 'row')
			: (confirmation?.itemLabel?.plural ?? 'rows')
	);
	const description = $derived.by(() => {
		if (!deleteDialog) return '';
		if (typeof confirmation?.description === 'function') {
			return confirmation.description(deleteDialog.rowCount);
		}
		return (
			confirmation?.description ??
			`This will permanently delete ${deleteDialog.rowCount === 1 ? 'the selected row' : `the ${deleteDialog.rowCount} selected rows`}.`
		);
	});
</script>

{#if deleteDialog}
	<AlertDialog.Root open={deleteDialog.open} {onOpenChange}>
		<AlertDialog.Content data-grid-popover="">
			<AlertDialog.Header>
				<AlertDialog.Media>
					<TrashIcon class="text-destructive" />
				</AlertDialog.Media>
				<AlertDialog.Title>
					Delete {deleteDialog.rowCount === 1
						? itemLabel
						: `${deleteDialog.rowCount} ${itemLabel}`}?
				</AlertDialog.Title>
				<AlertDialog.Description>{description}</AlertDialog.Description>
			</AlertDialog.Header>
			{#if confirmation?.force}
				<div class="flex items-start gap-3 rounded-md border border-destructive/40 p-3">
					<Checkbox
						id="data-grid-force-delete"
						checked={deleteDialog.force}
						disabled={deleteDialog.isDeleting}
						onCheckedChange={(checked) => onForceChange?.(checked === true)}
					/>
					<div class="grid gap-1">
						<label for="data-grid-force-delete" class="text-sm leading-none font-medium">
							{confirmation.force.label}
						</label>
						{#if confirmation.force.description}
							<p class="text-sm text-muted-foreground">{confirmation.force.description}</p>
						{/if}
					</div>
				</div>
			{/if}
			<AlertDialog.Footer>
				<AlertDialog.Cancel disabled={deleteDialog.isDeleting}>Cancel</AlertDialog.Cancel>
				<AlertDialog.Action
					variant="destructive"
					disabled={deleteDialog.isDeleting}
					onclick={(event) => {
						event.preventDefault();
						void onConfirm?.();
					}}
				>
					{deleteDialog.isDeleting ? 'Deleting...' : 'Delete'}
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
{/if}
