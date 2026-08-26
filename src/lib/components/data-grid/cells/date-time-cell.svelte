<script lang="ts" generics="TData">
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import TimePicker from '$lib/components/ui/date-time-picker/time-picker.svelte';
	import { PopoverContent } from '$lib/components/ui/popover/index.js';
	import type { CellVariantProps } from '$lib/components/data-grid/types/data-grid.js';
	import {
		type DateValue,
		getLocalTimeZone,
		parseDate,
		Time,
		today
	} from '@internationalized/date';
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

	const incomingValue = $derived((cellValue as string) ?? '');
	let containerRef = $state<HTMLDivElement | null>(null);
	let localEditValue = $state('');
	let editStartValue = $state('');
	let editingSessionActive = false;
	const value = $derived(isEditing ? localEditValue : incomingValue);

	// Parse value to DateValue for calendar
	const selectedDate = $derived.by((): DateValue | undefined => {
		if (!value) return undefined;
		try {
			const datePart = value.split('T')[0];
			return parseDate(datePart);
		} catch {
			return undefined;
		}
	});

	function timeFromValue(dateTime: string) {
		if (!dateTime) return new Time(0, 0, 0);
		const parsed = new Date(dateTime);
		if (Number.isNaN(parsed.getTime())) return new Time(0, 0, 0);
		return new Time(parsed.getHours(), parsed.getMinutes(), parsed.getSeconds());
	}

	let time = $state(new Time(0, 0, 0));

	// Default month for calendar (selected date or today)
	const defaultMonth = $derived(selectedDate ?? today(getLocalTimeZone()));

	function formatDateTimeForDisplay(dateStr: string): string {
		if (!dateStr) return '';
		try {
			const date = new Date(dateStr);
			return date.toLocaleString([], {
				year: 'numeric',
				month: 'numeric',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return dateStr;
		}
	}

	function formatDateTime(date: DateValue, nextTime: Time): string {
		const jsDate = new Date(
			date.year,
			date.month - 1,
			date.day,
			nextTime.hour,
			nextTime.minute,
			nextTime.second
		);

		return jsDate.toISOString();
	}

	function applyDateTime(nextDate: DateValue | undefined, nextTime: Time) {
		if (!nextDate || readOnly) return;
		localEditValue = formatDateTime(nextDate, nextTime);
	}

	function handleDateSelect(date: DateValue | undefined) {
		if (!date || readOnly) return;

		applyDateTime(date, time);
	}

	function handleTimeChange(nextTime: Time) {
		if (readOnly) return;
		time = nextTime;
		applyDateTime(selectedDate ?? defaultMonth, nextTime);
	}

	function handleOpenChange(isOpen: boolean) {
		const meta = table.options.meta;
		if (isOpen && !readOnly) {
			meta?.onCellEditingStart?.(rowIndex, columnId);
		} else {
			if (!readOnly && localEditValue !== editStartValue) {
				meta?.onDataUpdate?.({
					rowIndex,
					rowId: cell.row.id,
					columnId,
					value: localEditValue
				});
			}
			meta?.onCellEditingStop?.();
		}
	}

	function handleWrapperKeyDown(event: KeyboardEvent) {
		const meta = table.options.meta;
		if (isEditing && event.key === 'Escape') {
			event.preventDefault();
			localEditValue = editStartValue;
			time = timeFromValue(editStartValue);
			meta?.onCellEditingCancel?.();
		} else if (!isEditing && isFocused && event.key === 'Tab') {
			if (!meta?.canNavigateToCell?.(rowIndex, columnId, event.shiftKey ? 'left' : 'right')) return;
			event.preventDefault();
			meta?.onCellEditingStop?.({
				direction: event.shiftKey ? 'left' : 'right'
			});
		}
	}

	$effect(() => {
		const current = incomingValue;
		if (isEditing && !editingSessionActive) {
			editingSessionActive = true;
			editStartValue = current;
			localEditValue = current;
			time = timeFromValue(current);
		} else if (!isEditing) {
			editingSessionActive = false;
			editStartValue = current;
			localEditValue = current;
			time = timeFromValue(current);
		}
	});

	function handleOpenAutoFocus(e: Event) {
		e.preventDefault();
		// Focus the selected day, or today, or first day of month
		// Use setTimeout to ensure calendar is fully rendered
		setTimeout(() => {
			const popover = document.querySelector('[data-grid-cell-editor]');
			if (!popover) return;
			// Target the Calendar.Day element with data-calendar-day attribute
			const target =
				popover.querySelector<HTMLElement>('[data-calendar-day][data-selected]') ??
				popover.querySelector<HTMLElement>('[data-calendar-day][data-today]') ??
				popover.querySelector<HTMLElement>('[data-calendar-day]');
			target?.focus();
		}, 0);
	}
</script>

<DataGridCellWrapper
	bind:wrapperRef={containerRef}
	{cell}
	{table}
	{rowIndex}
	{columnId}
	{isEditing}
	{isFocused}
	{isSelected}
>
	<span data-slot="grid-cell-content">{formatDateTimeForDisplay(value)}</span>
</DataGridCellWrapper>

{#if isEditing}
	<PopoverPrimitive.Root open={isEditing} onOpenChange={handleOpenChange}>
		<PopoverContent
			data-grid-cell-editor=""
			align="start"
			alignOffset={-8}
			class="w-auto p-0"
			customAnchor={containerRef}
			onOpenAutoFocus={handleOpenAutoFocus}
			onkeydown={handleWrapperKeyDown}
		>
			<Calendar
				type="single"
				value={selectedDate}
				placeholder={defaultMonth}
				onValueChange={handleDateSelect}
				captionLayout="dropdown"
				weekdayFormat="short"
				initialFocus
			/>
			<div class="flex border-t p-2">
				<TimePicker
					view="dotted"
					bind:time
					setTime={(nextTime) => {
						if (nextTime) handleTimeChange(nextTime);
					}}
				/>
			</div>
		</PopoverContent>
	</PopoverPrimitive.Root>
{/if}
