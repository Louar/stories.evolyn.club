<script lang="ts" generics="TData">
	import { browser } from '$app/environment';
	import type { CellVariantProps } from '$lib/components/data-grid/types/data-grid.js';
	import '$lib/components/jdm-expression/jdm-expression.css';
	import { highlightJdm } from '$lib/components/jdm-expression/highlight-jdm';
	import JdmExpressionEditor from '$lib/components/jdm-expression/jdm-expression-editor.svelte';
	import { PopoverContent } from '$lib/components/ui/popover/index.js';
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

	const initialValue = $derived((cellValue as string) ?? '');
	const cellOpts = $derived(cell.column.columnDef.meta?.cell);

	const expressionType = $derived(
		cellOpts?.variant === 'jdm-expression' ? (cellOpts.expressionType ?? 'standard') : 'standard'
	);
	const placeholder = $derived(
		cellOpts?.variant === 'jdm-expression'
			? (cellOpts.placeholder ?? 'Enter expression...')
			: 'Enter expression...'
	);
	const lint = $derived(cellOpts?.variant === 'jdm-expression' ? (cellOpts.lint ?? true) : true);
	const strict = $derived(
		cellOpts?.variant === 'jdm-expression' ? (cellOpts.strict ?? false) : false
	);
	const maxRows = $derived(cellOpts?.variant === 'jdm-expression' ? (cellOpts.maxRows ?? 4) : 4);
	const variableType = $derived(
		cellOpts?.variant === 'jdm-expression' ? cellOpts.variableType : undefined
	);
	const expectedVariableType = $derived(
		cellOpts?.variant === 'jdm-expression' ? cellOpts.expectedVariableType : undefined
	);

	let wrapperRef = $state<HTMLDivElement | null>(null);
	let localEditValue = $state<string | null>(null);
	let previousValue = $state('');

	const sideOffset = $derived(-(wrapperRef?.clientHeight ?? 0));
	const value = $derived(localEditValue ?? initialValue ?? '');
	const previewHtml = $derived.by(() => {
		if (!browser) {
			return value;
		}

		return highlightJdm({
			code: value,
			type: expressionType,
			theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
			placeholder
		});
	});

	const commit = () => {
		const nextValue = value ?? '';
		if (!readOnly && nextValue !== initialValue) {
			table.options.meta?.onDataUpdate?.({
				rowIndex,
				rowId: cell.row.id,
				columnId,
				value: nextValue
			});
		}
		previousValue = nextValue;
	};

	const cancel = () => {
		localEditValue = previousValue;
		table.options.meta?.onCellEditingCancel?.();
	};

	function handleOpenChange(isOpen: boolean) {
		const meta = table.options.meta;
		if (isOpen && !readOnly) {
			previousValue = initialValue;
			localEditValue = initialValue;
			meta?.onCellEditingStart?.(rowIndex, columnId);
			return;
		}

		commit();
		localEditValue = null;
		meta?.onCellEditingStop?.();
	}

	function handleEditorEscape() {
		cancel();
	}

	function handleEditorTab(direction: 'left' | 'right') {
		commit();
		localEditValue = null;
		table.options.meta?.onCellEditingStop?.({ direction });
	}

	function handleEditorCtrlEnter() {
		commit();
		localEditValue = null;
		table.options.meta?.onCellEditingStop?.();
	}

	function handleWrapperKeyDown(event: KeyboardEvent) {
		if (isEditing && event.key === 'Escape') {
			event.preventDefault();
			cancel();
			return;
		}

		if (!isEditing && isFocused && event.key === 'Tab') {
			if (
				!table.options.meta?.canNavigateToCell?.(
					rowIndex,
					columnId,
					event.shiftKey ? 'left' : 'right'
				)
			)
				return;
			event.preventDefault();
			table.options.meta?.onCellEditingStop?.({
				direction: event.shiftKey ? 'left' : 'right'
			});
		}
	}

	$effect(() => {
		if (!isEditing) {
			localEditValue = null;
			previousValue = initialValue;
		}
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
	onkeydown={handleWrapperKeyDown}
>
	<div
		data-slot="grid-cell-content"
		class={cn(
			'jdm-expression-preview shiki-bg-transparent size-full overflow-hidden font-mono text-sm break-all whitespace-pre-wrap',
			{
				'text-muted-foreground': !value?.length
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
			class="jdm-expression-popover w-120 rounded-none p-0"
			customAnchor={wrapperRef}
			onOpenAutoFocus={(event) => event.preventDefault()}
		>
			<div class="relative min-h-40 border-border bg-popover ring-1 ring-ring ring-inset">
				<JdmExpressionEditor
					{value}
					type={expressionType}
					{placeholder}
					{lint}
					{strict}
					maxRows={Math.max(maxRows, 6)}
					{variableType}
					{expectedVariableType}
					onChange={(nextValue) => {
						localEditValue = nextValue;
					}}
					onEscape={handleEditorEscape}
					onTab={handleEditorTab}
					onCtrlEnter={handleEditorCtrlEnter}
					class="no-style full-height max-rows"
				/>
			</div>
		</PopoverContent>
	</PopoverPrimitive.Root>
{/if}
