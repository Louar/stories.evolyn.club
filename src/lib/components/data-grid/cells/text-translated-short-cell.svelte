<script lang="ts" generics="TData">
	import {
		areTranslatablesEqual,
		Language,
		LanguageFlag,
		translateLocalizedField,
		type Translatable
	} from '$lib/db/schemas/0-utils';
	import { UI } from '$lib/states/ui.svelte';
	import type { CellVariantProps, RowHeightValue } from '$lib/components/data-grid/types/data-grid.js';
	import { cn } from '$lib/utils.js';
	import DataGridCellWrapper from '../data-grid-cell-wrapper.svelte';

	let {
		cell,
		table,
		rowIndex,
		columnId,
		isEditing,
		isFocused,
		isSelected,
		readOnly = false,
		cellValue
	}: CellVariantProps<TData> = $props();

	const rowHeight = $derived.by<RowHeightValue>(() => {
		const meta = table.options.meta;
		return meta?.rowHeight ?? 'short';
	});

	let cellRef = $state<HTMLDivElement | null>(null);

	// svelte-ignore state_referenced_locally
	let previousValue: Translatable | null = $state((cellValue as Translatable) ?? null);
	// svelte-ignore state_referenced_locally
	let nextValue: Translatable | null = $state((cellValue as Translatable) ?? null);

	const meta = $derived(table.options.meta);

	function commit() {
		if (readOnly) return;

		const text = cellRef?.textContent ?? '';

		if (!nextValue) nextValue = {};
		if (text.length) nextValue[UI.language] = text;
		else nextValue[UI.language] = undefined;

		if (!areTranslatablesEqual(previousValue, nextValue)) {
			meta?.onDataUpdate?.({ rowIndex, columnId, value: nextValue });
			previousValue = { ...nextValue };
		}
	}

	function moveCursorToEnd(node: HTMLDivElement) {
		const range = document.createRange();
		const selection = window.getSelection();
		range.selectNodeContents(node);
		range.collapse(false);
		selection?.removeAllRanges();
		selection?.addRange(range);
	}

	// Focus cell when entering edit mode
	$effect(() => {
		if (cellRef && UI.language) {
			if (isEditing) {
				previousValue = { ...nextValue };
				cellRef.textContent = nextValue?.[UI.language] ?? '';
				cellRef.focus();
				moveCursorToEnd(cellRef);
			} else {
				cellRef.textContent = translateLocalizedField(nextValue, UI.language) ?? '';
			}
		}
	});

	function handleBlur() {
		if (!isEditing) return;
		commit();
		meta?.onCellEditingStop?.();
	}

	function handleWrapperKeyDown(event: KeyboardEvent) {
		if (!isEditing) return;

		if (event.key === 'Enter') {
			event.preventDefault();
			commit();
			meta?.onCellEditingStop?.({ moveToNextRow: true });
			return;
		}

		if (event.key === 'Tab') {
			event.preventDefault();
			commit();
			meta?.onCellEditingStop?.({
				direction: event.shiftKey ? 'left' : 'right'
			});
			return;
		}

		if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
			event.preventDefault();
			commit();
			const getNextLanguage = (selected?: Language | 'default' | null): Language | 'default' => {
				const languages = ['default', ...Object.values(Language)] as const;
				const currentIndex = selected ? languages.indexOf(selected) : -1;
				return languages[(currentIndex + 1) % languages.length];
			};
			UI.language = getNextLanguage(UI.language);
			return;
		}

		// if (event.key === 'Escape') {
		// 	event.preventDefault();
		// 	nextValue = previousValue;
		// 	if (cellRef) cellRef.textContent = nextValue?.[UI.language] ?? '';
		// 	meta?.onCellEditingStop?.();
		// }
	}
</script>

<DataGridCellWrapper
	{cell}
	{table}
	{rowIndex}
	{columnId}
	{isEditing}
	{isFocused}
	{isSelected}
	onkeydown={handleWrapperKeyDown}
>
	{#if !isEditing && nextValue && rowHeight !== 'short'}
		<div class="pointer-events-none line-clamp-1 flex space-x-0.5 text-xs text-foreground">
			{#each Object.entries(LanguageFlag) as [key, flag] (key)}
				{#if nextValue[key as keyof Translatable]}
					<span>{flag}</span>
				{/if}
			{/each}
		</div>
	{/if}
	<div
		role="textbox"
		data-slot="grid-cell-content"
		contenteditable={isEditing}
		tabindex={-1}
		bind:this={cellRef}
		onblur={handleBlur}
		class={cn('size-full overflow-hidden outline-none', {
			'whitespace-nowrap **:inline **:whitespace-nowrap [&_br]:hidden': isEditing,
			'text-muted-foreground': !isEditing && !nextValue?.[UI.language]
		})}
	></div>
</DataGridCellWrapper>
