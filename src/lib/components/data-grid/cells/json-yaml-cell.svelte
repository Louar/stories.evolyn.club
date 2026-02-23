<script lang="ts" generics="TData">
	import highlighter from '$lib/client/shiki';
	import type { CellVariantProps } from '$lib/components/data-grid/types/data-grid.js';
	import { PopoverContent } from '$lib/components/ui/popover/index.js';
	import { cn } from '$lib/utils.js';
	import { Popover as PopoverPrimitive } from 'bits-ui';
	import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
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
	let previewScrollRef = $state<HTMLDivElement | null>(null);

	const sideOffset = $derived(-(wrapperRef?.clientHeight ?? 0));
	const meta = $derived(table.options.meta);

	// svelte-ignore state_referenced_locally
	let initialValue = $state(cellValue ?? null);
	// svelte-ignore state_referenced_locally
	let previousValue = $state(cellValue ?? null);
	// svelte-ignore state_referenced_locally
	let nextValue = $state(cellValue ?? null);
	let yamlText = $state('');
	let parseError = $state<string | null>(null);
	let saveTimeoutId: ReturnType<typeof setTimeout> | null = null;

	const previewHtml = $derived.by(() =>
		highlighter.codeToHtml(yamlText ?? '', {
			lang: 'yaml',
			themes: {
				light: 'snazzy-light',
				dark: 'aurora-x'
			},
			defaultColor: 'light-dark()'
		})
	);

	function toYaml(value: unknown): string {
		try {
			if (value == null) return '';
			return stringifyYaml(value, { indent: 2 }).trimEnd();
		} catch {
			return '';
		}
	}

	function fromYaml(value: string) {
		if (!value?.trim()) return null;
		return parseYaml(value);
	}

	function clearDebounce() {
		if (saveTimeoutId) {
			clearTimeout(saveTimeoutId);
			saveTimeoutId = null;
		}
	}

	function commit() {
		if (readOnly) return;
		if (parseError) return;
		if (stringifyYaml(previousValue) !== stringifyYaml(nextValue)) {
			meta?.onDataUpdate?.({ rowIndex, columnId, value: nextValue });
			previousValue = nextValue;
		}
	}

	function debouncedCommit(delay = 3000) {
		if (readOnly) return;
		clearDebounce();
		saveTimeoutId = setTimeout(() => {
			commit();
		}, delay);
	}

	function saveAndClose() {
		clearDebounce();
		commit();
		initialValue = nextValue;
		meta?.onCellEditingStop?.();
	}

	function handleOpenChange(isOpen: boolean) {
		if (isOpen && !readOnly) {
			previousValue = nextValue;
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

	function handleTextareaInput(event: Event) {
		const value = (event.currentTarget as HTMLTextAreaElement).value;
		yamlText = value;
		try {
			parseError = null;
			nextValue = fromYaml(value);
			debouncedCommit();
		} catch (err) {
			parseError = err instanceof Error ? err.message : 'Invalid YAML';
		}
	}

	function handleTextareaKeyDown(event: KeyboardEvent) {
		if (!isEditing) return;

		if (event.key === 'Escape') {
			event.preventDefault();
			clearDebounce();
			if (previousValue !== nextValue) {
				meta?.onDataUpdate?.({ rowIndex, columnId, value: previousValue });
				nextValue = previousValue;
				yamlText = toYaml(previousValue);
				parseError = null;
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

		event.stopPropagation();
	}

	$effect(() => {
		const current = cellValue ?? null;
		if (isEditing) {
			initialValue = current;
			previousValue = current;
			nextValue = current;
			yamlText = toYaml(current);
			parseError = null;
			return;
		}

		clearDebounce();
		initialValue = current;
		previousValue = current;
		nextValue = current;
		yamlText = toYaml(current);
		parseError = null;
	});
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
			'shiki-bg-transparent size-full overflow-hidden font-mono text-sm break-all whitespace-pre-wrap',
			{
				'text-muted-foreground': !yamlText?.length
			}
		)}
	>
		{@html previewHtml}
	</div>
</DataGridCellWrapper>

{#if isEditing}
	<PopoverPrimitive.Root open={isEditing} onOpenChange={handleOpenChange}>
		<PopoverContent
			data-grid-cell-editor=""
			align="start"
			side="bottom"
			{sideOffset}
			class="shiki-bg-transparent w-120 rounded-none bg-transparent p-0"
			onOpenAutoFocus={handleOpenAutoFocus}
			customAnchor={wrapperRef}
		>
			<div class="absolute inset-0 -z-10 bg-popover ring-1 ring-ring ring-inset"></div>
			{#if parseError}
				<div class="border-b bg-muted p-2">
					<p class="text-sm text-destructive">{parseError}</p>
				</div>
			{/if}
			<div class="relative h-52 w-full rounded-none font-mono text-sm">
				<div
					bind:this={previewScrollRef}
					class="absolute inset-0 -z-10 overflow-hidden rounded-none p-2 [&>pre]:h-full [&>pre]:font-mono! [&>pre]:text-sm! [&>pre]:wrap-break-word [&>pre]:whitespace-pre-wrap"
				>
					{@html previewHtml}
				</div>
				<textarea
					bind:this={textareaRef}
					placeholder="Enter YAML..."
					spellcheck="false"
					class="relative z-10 h-52 w-full resize-none overscroll-none rounded-none border-0 bg-transparent p-2 font-mono text-sm text-transparent caret-foreground shadow-none focus-visible:outline-none"
					value={yamlText}
					onblur={handleBlur}
					oninput={handleTextareaInput}
					onkeydown={handleTextareaKeyDown}
					onscroll={(event) => {
						if (!previewScrollRef) return;
						previewScrollRef.scrollTop = event.currentTarget.scrollTop;
						previewScrollRef.scrollLeft = event.currentTarget.scrollLeft;
					}}
				></textarea>
			</div>
		</PopoverContent>
	</PopoverPrimitive.Root>
{/if}
