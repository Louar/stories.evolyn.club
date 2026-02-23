<script lang="ts" generics="TData">
	import highlighter from '$lib/client/shiki';
	import { PopoverContent } from '$lib/components/ui/popover/index.js';
	import TranslatableTextarea from '$lib/components/ui/translatable-textarea/translatable-textarea.svelte';
	import {
		areTranslatablesEqual,
		Language,
		translateLocalizedField,
		type Translatable
	} from '$lib/db/schemas/0-utils';
	import { UI } from '$lib/states/ui.svelte';
	import type { CellVariantProps } from '$lib/components/data-grid/types/data-grid.js';
	import { cn } from '$lib/utils.js';
	import { Popover as PopoverPrimitive } from 'bits-ui';
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

	let wrapperRef = $state<HTMLDivElement | null>(null);
	let textareaRef = $state<HTMLTextAreaElement | null>(null);

	const sideOffset = $derived(-(wrapperRef?.clientHeight ?? 0));
	const meta = $derived(table.options.meta);
	const ismarkdown = $derived(
		(
			cell.column.columnDef.meta?.cell as
				| Extract<
						NonNullable<CellVariantProps<TData>['cell']['column']['columnDef']['meta']>['cell'],
						{ variant: 'text-translated-long' }
				  >
				| undefined
		)?.markdown ?? false
	);

	// svelte-ignore state_referenced_locally
	let initalValue: Translatable | null = $state((cellValue as Translatable) ?? null);
	// svelte-ignore state_referenced_locally
	let previousValue: Translatable | null = $state((cellValue as Translatable) ?? null);
	// svelte-ignore state_referenced_locally
	let nextValue: Translatable | null = $state((cellValue as Translatable) ?? null);

	let saveTimeoutId: ReturnType<typeof setTimeout> | null = null;

	function clearDebounce() {
		if (saveTimeoutId) {
			clearTimeout(saveTimeoutId);
			saveTimeoutId = null;
		}
	}

	function commit() {
		if (readOnly) return;

		if (!areTranslatablesEqual(previousValue, nextValue)) {
			meta?.onDataUpdate?.({ rowIndex, columnId, value: nextValue });
			previousValue = nextValue ? { ...nextValue } : null;
		}
	}

	function debouncedCommit(delay = 5000) {
		if (readOnly) return;

		clearDebounce();
		saveTimeoutId = setTimeout(() => {
			commit();
		}, delay);
	}

	function saveAndClose() {
		clearDebounce();
		commit();
		initalValue = nextValue ? { ...nextValue } : null;
		meta?.onCellEditingStop?.();
	}

	function getNextLanguage(selected?: Language | 'default' | null): Language | 'default' {
		const languages = ['default', ...Object.values(Language)] as const;
		const currentIndex = selected ? languages.indexOf(selected) : -1;
		return languages[(currentIndex + 1) % languages.length];
	}

	function handleOpenChange(isOpen: boolean) {
		if (isOpen && !readOnly) {
			// Snapshot when entering edit mode
			previousValue = nextValue ? { ...nextValue } : null;
			meta?.onCellEditingStart?.(rowIndex, columnId);
			return;
		}
		saveAndClose();
	}

	function handleOpenAutoFocus(event: Event) {
		event.preventDefault();
		if (!textareaRef) return;

		textareaRef.focus();
		const length = textareaRef.value.length;
		textareaRef.setSelectionRange(length, length);
	}

	function handleBlur() {
		if (!isEditing) return;
		saveAndClose();
	}

	function handleTextareaKeyDown(event: KeyboardEvent) {
		if (!isEditing) return;

		if (event.key === 'Escape') {
			event.preventDefault();
			if (!readOnly) clearDebounce();

			if (!areTranslatablesEqual(initalValue, nextValue)) {
				meta?.onDataUpdate?.({ rowIndex, columnId, value: initalValue });
				nextValue = initalValue ? { ...initalValue } : null;
			}
			meta?.onCellEditingStop?.();
			return;
		}

		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			saveAndClose();
			return;
		}

		if (event.key === 'Tab') {
			event.preventDefault();
			clearDebounce();
			commit();
			meta?.onCellEditingStop?.({ direction: event.shiftKey ? 'left' : 'right' });
			return;
		}

		if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
			event.preventDefault();
			clearDebounce();
			commit();
			UI.language = getNextLanguage(UI.language);
			return;
		}

		event.stopPropagation();
	}

	// When leaving edit mode externally, stop pending autosaves (and don’t keep stale timers around)
	$effect(() => {
		if (!isEditing) clearDebounce();
	});

	let preview: HTMLDivElement | null = $state(null);
	const localize = (text?: string) => {
		if (ismarkdown) {
			return highlighter.codeToHtml(text ?? '', {
				lang: 'markdown',
				themes: {
					light: 'snazzy-light',
					dark: 'aurora-x'
				},
				defaultColor: 'light-dark()'
			});
		}
	};
	const previewHtml = $derived.by(() =>
		ismarkdown ? (localize(translateLocalizedField(nextValue, UI.language)) ?? '') : ''
	);

	const previewAttachment = (node: HTMLDivElement) => {
		preview = node;
		$effect(() => {
			node.innerHTML = previewHtml;
		});
		return () => {
			if (preview === node) preview = null;
		};
	};
</script>

<DataGridCellWrapper
	bind:wrapperRef
	{cell}
	{table}
	{rowIndex}
	{columnId}
	{isEditing}
	{isFocused}
	{isSelected}
>
	<div
		data-slot="grid-cell-content"
		class={cn(
			'size-full overflow-hidden wrap-anywhere break-all whitespace-pre-line outline-none',
			{
				'text-muted-foreground': !nextValue?.[UI.language]
			}
		)}
	>
		{#if ismarkdown}
			<div
				{@attach previewAttachment}
				class={cn(
					'shiki-bg-transparent [&>pre]:size-full [&>pre]:font-mono! [&>pre]:text-sm! [&>pre]:wrap-break-word [&>pre]:whitespace-pre-wrap',
					{
						'opacity-50': !nextValue?.[UI.language]
					}
				)}
			></div>
		{:else}
			{translateLocalizedField(nextValue, UI.language)}
		{/if}
	</div>
</DataGridCellWrapper>

{#if isEditing}
	<PopoverPrimitive.Root open={isEditing} onOpenChange={handleOpenChange}>
		<PopoverContent
			data-grid-cell-editor=""
			align="start"
			side="bottom"
			{sideOffset}
			class="shiki-bg-transparent w-100 rounded-none bg-transparent p-0"
			onOpenAutoFocus={handleOpenAutoFocus}
			customAnchor={wrapperRef}
		>
			<div class="absolute inset-0 -z-10 bg-popover ring-1 ring-ring ring-inset"></div>
			<TranslatableTextarea
				bind:ref={textareaRef}
				placeholder={ismarkdown ? 'Enter markdown...' : 'Enter text...'}
				class="min-h-37.5 resize-none rounded-none border-0 text-sm shadow-none focus-visible:ring-0"
				bind:value={nextValue}
				{ismarkdown}
				onblur={handleBlur}
				oninput={() => debouncedCommit()}
				onkeydown={handleTextareaKeyDown}
			/>
		</PopoverContent>
	</PopoverPrimitive.Root>
{/if}
