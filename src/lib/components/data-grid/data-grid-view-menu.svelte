<script lang="ts" generics="TData">
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Command,
		CommandEmpty,
		CommandGroup,
		CommandInput,
		CommandItem,
		CommandList
	} from '$lib/components/ui/command/index.js';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover/index.js';
	import { cn } from '$lib/utils.js';
	import Check from '@lucide/svelte/icons/check';
	import Settings2 from '@lucide/svelte/icons/settings-2';
	import type { Table } from '@tanstack/table-core';
	import { SvelteMap } from 'svelte/reactivity';

	interface Props {
		table: Table<TData>;
		align?: 'start' | 'center' | 'end';
		class?: string;
	}

	let { table, align = 'start', class: className }: Props = $props();

	const { columnLabels, columns } = $derived.by(() => {
		const labels = new SvelteMap<string, string>();
		const visibleColumns = table
			.getAllColumns()
			.filter((column) => typeof column.accessorFn !== 'undefined' && column.getCanHide());

		for (const column of visibleColumns) {
			const header = typeof column.columnDef.header === 'string' ? column.columnDef.header : null;
			const label = column.columnDef.meta?.label ?? header ?? column.id;
			labels.set(column.id, label);
		}

		return {
			columnLabels: labels,
			columns: visibleColumns
		};
	});

	// Get visibility state reactively
	const columnVisibility = $derived(table.getState().columnVisibility);
	const preferences = $derived(table.options.meta?.preferences);

	// Helper to check if column is visible - reads from reactive state
	function isColumnVisible(columnId: string): boolean {
		// If not in visibility state, default to visible (true)
		return columnVisibility[columnId] !== false;
	}
</script>

<Popover>
	<PopoverTrigger>
		{#snippet child({ props })}
			<Button
				{...props}
				aria-label="View settings"
				role="combobox"
				variant="outline"
				size="sm"
				class={cn('flex h-8 font-normal', className)}
				disabled={preferences?.enabled && !preferences.ready}
			>
				<Settings2 class="text-muted-foreground" />
				View
			</Button>
		{/snippet}
	</PopoverTrigger>
	<PopoverContent {align} class="w-44 p-0">
		<Command>
			<CommandInput placeholder="Search columns..." />
			<CommandList>
				<CommandEmpty>No columns found.</CommandEmpty>
				<CommandGroup>
					{#each columns as column (column.id)}
						{@const isVisible = isColumnVisible(column.id)}
						<CommandItem value={column.id} onSelect={() => column.toggleVisibility(!isVisible)}>
							<span class="truncate">
								{columnLabels.get(column.id)}
							</span>
							<Check
								class={cn('ml-auto size-4 shrink-0', isVisible ? 'opacity-100' : 'opacity-0')}
							/>
						</CommandItem>
					{/each}
				</CommandGroup>
			</CommandList>
		</Command>
	</PopoverContent>
</Popover>
