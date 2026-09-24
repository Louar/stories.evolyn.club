<script lang="ts" generics="TData extends RowData">
	import type { RowData, Table } from '$lib/components/data-grid/data-grid-table.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import TrashIcon from '@lucide/svelte/icons/trash-2';

	interface Props {
		table: Table<TData>;
	}

	let { table }: Props = $props();

	const meta = $derived(table.options.meta);
	const deleteDialog = $derived(meta?.deleteDialog);
	const onOpenChange = $derived(meta?.onDeleteDialogOpenChange);
	const onConfirm = $derived(meta?.onRowsDeleteConfirm);
</script>

{#if deleteDialog}
	<AlertDialog.Root open={deleteDialog.open} {onOpenChange}>
		<AlertDialog.Content data-grid-popover="">
			<AlertDialog.Header>
				<AlertDialog.Media>
					<TrashIcon class="text-destructive" />
				</AlertDialog.Media>
				<AlertDialog.Title>
					Delete {deleteDialog.rowCount === 1 ? 'row' : `${deleteDialog.rowCount} rows`}?
				</AlertDialog.Title>
				<AlertDialog.Description>
					This will permanently delete {deleteDialog.rowCount === 1
						? 'the selected row'
						: `the ${deleteDialog.rowCount} selected rows`}.
				</AlertDialog.Description>
			</AlertDialog.Header>
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
