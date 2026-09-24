<script lang="ts">
	import { SortableList, sortItems } from '@rodrigodagostino/svelte-sortable-list';
	import SortableCard from './SortableCard.svelte';
	import type { SortableRoundItem } from './types';

	let {
		items = $bindable(),
		correctPositions = null,
		disabled = false,
		showHints = false
	} = $props<{
		items: SortableRoundItem[];
		correctPositions?: boolean[] | null;
		disabled?: boolean;
		showHints?: boolean;
	}>();

	function handleDragEnd(event: SortableList.RootEvents['ondragend']) {
		const { draggedItemIndex, targetItemIndex, isCanceled } = event;
		if (
			disabled ||
			isCanceled ||
			typeof targetItemIndex !== 'number' ||
			draggedItemIndex === targetItemIndex
		)
			return;

		items = sortItems(items, draggedItemIndex, targetItemIndex);
	}
</script>

<SortableList.Root
	gap={12}
	hasLockedAxis
	hasBoundaries
	isDisabled={disabled}
	ondragend={handleDragEnd}
	class="py-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-game-warning sm:py-4"
>
	{#each items as item, index (item.id)}
		<SortableList.Item
			id={item.id}
			{index}
			isDisabled={disabled}
			class="group rounded-2xl px-3 outline-none sm:px-4"
		>
			<SortableCard
				{item}
				position={index}
				correctPosition={correctPositions?.[index] ?? null}
				{showHints}
			/>
		</SortableList.Item>
	{/each}
</SortableList.Root>
