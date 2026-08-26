<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';

	type Item = { value: string; label: string; description?: string };

	let {
		items,
		value,
		placeholder = 'Select an item',
		searchPlaceholder = 'Search...',
		emptyText = 'No results found.',
		onValueChange
	}: {
		items: Item[];
		value?: string | null;
		placeholder?: string;
		searchPlaceholder?: string;
		emptyText?: string;
		onValueChange: (value: string) => void;
	} = $props();

	let open = $state(false);
	let selected = $derived(items.find((item) => item.value === value));

	const select = (nextValue: string) => {
		onValueChange(nextValue);
		open = false;
	};
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="outline"
				role="combobox"
				aria-expanded={open}
				class="w-full justify-between font-normal"
			>
				<span class="min-w-0 truncate">{selected?.label ?? placeholder}</span>
				<ChevronsUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-[var(--bits-popover-anchor-width)] p-0" align="start">
		<Command.Root>
			<Command.Input placeholder={searchPlaceholder} />
			<Command.List class="max-h-72">
				<Command.Empty>{emptyText}</Command.Empty>
				<Command.Group>
					{#each items as item (item.value)}
						<Command.Item
							value={`${item.label} ${item.description ?? ''}`}
							onSelect={() => select(item.value)}
						>
							<CheckIcon class="size-4 {item.value === value ? 'opacity-100' : 'opacity-0'}" />
							<div class="min-w-0">
								<p class="truncate">{item.label}</p>
								{#if item.description}
									<p class="truncate text-xs text-muted-foreground">{item.description}</p>
								{/if}
							</div>
						</Command.Item>
					{/each}
				</Command.Group>
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
