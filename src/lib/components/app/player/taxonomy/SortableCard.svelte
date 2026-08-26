<script lang="ts">
	import * as Item from '$lib/components/ui/item';
	import { cn } from '$lib/utils';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import { fly } from 'svelte/transition';
	import type { SortableRoundItem } from './types';

	let {
		item,
		position,
		correctPosition,
		showHints = false
	} = $props<{
		item: SortableRoundItem;
		position: number;
		correctPosition?: boolean | null;
		showHints?: boolean;
	}>();
</script>

<Item.Root
	variant="outline"
	class={cn(
		"border-game-border bg-game-panel text-game-text group-focus-within:ring-game-warning/35 cursor-grab border-2 shadow-[0_4px_0_0_var(--game-border)] transition-[box-shadow,transform] group-focus-within:ring-3 group-data-[drag-state*='kbd-drag']:scale-[1.015] group-data-[drag-state*='kbd-drag']:shadow-[0_8px_0_0_var(--game-border),0_18px_36px_rgba(0,0,0,0.24)] group-data-[drag-state*='ptr-drag']:scale-[1.015] group-data-[drag-state*='ptr-drag']:shadow-[0_8px_0_0_var(--game-border),0_18px_36px_rgba(0,0,0,0.24)] group-[[data-is-ghost='false'][data-drag-state*='ptr']]:opacity-0 active:cursor-grabbing",
		correctPosition === true && 'border-game-success shadow-[0_4px_0_0_var(--game-success)]',
		correctPosition === false && 'border-game-danger shadow-[0_4px_0_0_var(--game-danger)]'
	)}
>
	<div class="text-game-text-muted flex items-center" aria-hidden="true"><GripVerticalIcon /></div>
	<Item.Media
		class="border-game-border bg-game-inverse text-game-inverse-text relative size-11 overflow-hidden rounded-2xl border-2 text-lg font-black shadow-[0_2px_0_0_var(--game-border)]"
		aria-hidden="true"
	>
		{#key position}
			<span
				class="absolute inset-0 flex items-center justify-center"
				in:fly={{ y: -8, duration: 160 }}
				out:fly={{ y: 8, duration: 120 }}
			>
				{position + 1}
			</span>
		{/key}
	</Item.Media>
	<Item.Content class="min-w-0">
		<Item.Title class="truncate text-base font-black">{item.name}</Item.Title>
		{#if showHints}
			<Item.Description class="text-game-text-muted truncate"
				>Value: {item.sortValue}</Item.Description
			>
		{/if}
	</Item.Content>
</Item.Root>
