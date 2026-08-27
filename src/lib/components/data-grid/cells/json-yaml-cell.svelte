<script lang="ts" generics="TData">
	import highlighter from '$lib/client/shiki';
	import { getCellKey, type CellVariantProps } from '$lib/components/data-grid/types/data-grid.js';
	import { Button } from '$lib/components/ui/button/index.js';
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
	let previousValue = $state(cellValue ?? null);
	// svelte-ignore state_referenced_locally
	let nextValue = $state(cellValue ?? null);
	let yamlText = $state('');
	let parseError = $state<string | null>(null);
	let showSchemaPreview = $state(false);
	let saveTimeoutId: ReturnType<typeof setTimeout> | null = null;
	let editingSessionActive = false;
	const cellOptions = $derived(cell.column.columnDef.meta?.cell);
	const currentRow = $derived.by(() => {
		const row = { ...(cell.row.original as Record<string, unknown>) };
		const map = meta?.cellValueMap;
		if (!map) return row;

		for (const column of table.getAllLeafColumns()) {
			const key = getCellKey(cell.row.id, column.id);
			if (map.has(key)) row[column.id] = map.get(key);
		}

		return row;
	});
	const schemaPreview = $derived.by(() => {
		if (cellOptions?.variant !== 'json-yaml') return null;
		const preview = cellOptions.schemaPreview;
		if (!preview) return null;
		const value = typeof preview === 'function' ? preview(currentRow) : preview;
		if (value == null) return null;
		return typeof value === 'string' ? value : toYaml(value);
	});

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
			meta?.onDataUpdate?.({ rowIndex, rowId: cell.row.id, columnId, value: nextValue });
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
		textareaRef.focus({ preventScroll: true });
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
			meta?.onCellEditingCancel?.();
			return;
		}

		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			saveAndClose();
			return;
		}

		if (event.key === 'Tab') {
			const direction = event.shiftKey ? 'left' : 'right';
			const canNavigate = meta?.canNavigateToCell?.(rowIndex, columnId, direction) ?? false;
			if (!canNavigate) {
				saveAndClose();
				return;
			}
			event.preventDefault();
			clearDebounce();
			commit();
			meta?.onCellEditingStop?.({ direction });
			return;
		}

		event.stopPropagation();
	}

	function toggleSchemaPreview(event: MouseEvent) {
		event.preventDefault();
		showSchemaPreview = !showSchemaPreview;
	}

	$effect(() => {
		const current = cellValue ?? null;
		if (isEditing && !editingSessionActive) {
			editingSessionActive = true;
			previousValue = current;
			nextValue = current;
			yamlText = toYaml(current);
			parseError = null;
			return;
		}
		if (isEditing) return;

		editingSessionActive = false;
		clearDebounce();
		previousValue = current;
		nextValue = current;
		yamlText = toYaml(current);
		parseError = null;
		return clearDebounce;
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
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
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
			{#if schemaPreview}
				<div class="flex items-center justify-between gap-2 border-b bg-muted p-2">
					<p class="text-sm font-medium">Configuration example</p>
					<Button
						variant="outline"
						size="sm"
						onpointerdown={(event) => event.preventDefault()}
						onclick={toggleSchemaPreview}
					>
						{showSchemaPreview ? 'Hide example' : 'Show example'}
					</Button>
				</div>
				{#if showSchemaPreview}
					<pre
						class="max-h-52 overflow-auto border-b bg-muted/60 p-2 font-mono text-xs whitespace-pre-wrap text-muted-foreground muted-scrollbar">{schemaPreview}</pre>
				{/if}
			{/if}
			<div class="relative h-52 w-full rounded-none">
				<div
					bind:this={previewScrollRef}
					class="pointer-events-none absolute inset-0 z-0 overflow-hidden p-2 font-mono text-sm leading-5 tracking-normal wrap-break-word whitespace-pre-wrap [scrollbar-gutter:stable] [tab-size:2] [&>pre]:m-0 [&>pre]:min-h-full [&>pre]:bg-transparent! [&>pre]:font-mono! [&>pre]:text-sm! [&>pre]:leading-5! [&>pre]:tracking-normal [&>pre]:wrap-break-word [&>pre]:whitespace-pre-wrap"
				>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html previewHtml}
				</div>
				<textarea
					bind:this={textareaRef}
					placeholder="Enter YAML..."
					spellcheck="false"
					wrap="soft"
					class="relative z-10 h-full w-full resize-none overflow-auto border-0 bg-transparent p-2 font-mono text-sm leading-5 tracking-normal wrap-break-word whitespace-pre-wrap text-transparent caret-foreground shadow-none muted-scrollbar [scrollbar-gutter:stable] [tab-size:2] focus-visible:outline-none"
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
