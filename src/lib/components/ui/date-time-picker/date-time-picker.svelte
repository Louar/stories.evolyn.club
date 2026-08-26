<script lang="ts">
	import { buttonVariants } from '$lib/components/ui/button';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Calendar } from '$lib/components/ui/calendar';
	import * as Popover from '$lib/components/ui/popover';
	import { cn, type WithElementRef } from '$lib/utils';
	import {
		DateFormatter,
		type DateValue,
		getLocalTimeZone,
		now,
		Time
	} from '@internationalized/date';
	import CalendarIcon from '@lucide/svelte/icons/calendar-days';
	import BackspaceIcon from '@lucide/svelte/icons/delete';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import TimePicker from './time-picker.svelte';

	const df = new DateFormatter('nl-NL', {
		weekday: 'short',
		month: 'short',
		year: '2-digit',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		hourCycle: 'h23'
	});

	type Props = WithElementRef<
		Omit<HTMLInputAttributes, 'type' | 'value' | 'defaultValue'> & {
			date?: DateValue;
			view?: 'labels' | 'dotted';
			setDate?: (date: DateValue | null | undefined) => void;
		},
		HTMLInputElement
	>;

	let {
		date = $bindable(),
		ref = $bindable(null),
		class: className,
		view,
		setDate,
		name,
		disabled = false,
		required = false,
		id,
		...restProps
	}: Props = $props();

	let contentRef = $state<HTMLElement | null>(null);
	let dateValue = $state<DateValue | undefined>(date ?? undefined);

	let time = $state(
		new Time(date && 'hour' in date ? date.hour : 0, date && 'minute' in date ? date.minute : 0)
	);

	const toFormValue = (value: DateValue | undefined) => {
		if (!value) return '';

		const zoned = value.toDate(getLocalTimeZone());
		const pad = (part: number) => String(part).padStart(2, '0');

		return `${zoned.getFullYear()}-${pad(zoned.getMonth() + 1)}-${pad(zoned.getDate())}T${pad(zoned.getHours())}:${pad(zoned.getMinutes())}:${pad(zoned.getSeconds())}`;
	};

	const clearDate = () => {
		date = undefined;
		dateValue = undefined;
		setDate?.(null);
	};

	$effect(() => {
		dateValue = date ?? undefined;
		if (date) {
			time = new Time(
				'hour' in date ? date.hour : 0,
				'minute' in date ? date.minute : 0,
				'second' in date ? date.second : 0
			);
		}
	});

	const onValueChange = (_date: DateValue | undefined) => {
		if (!_date) {
			clearDate();
			return;
		}

		if (!date) date = now(getLocalTimeZone());
		date = date.set({
			year: _date?.year,
			month: _date?.month,
			day: _date?.day,
			minute: time.minute,
			hour: time.hour,
			second: time.second
		});

		setDate?.(date);
	};

	const setTime = (nextTime: Time) => {
		if (!date) date = now(getLocalTimeZone());
		date = date?.set({
			minute: nextTime.minute,
			hour: nextTime.hour,
			second: nextTime.second
		});
		time = nextTime;

		if (date) setDate?.(date);
	};
</script>

<Popover.Root>
	<input
		bind:this={ref}
		type="hidden"
		{name}
		{id}
		value={toFormValue(date)}
		{disabled}
		{required}
		{...restProps}
	/>

	<div class="flex w-full gap-1">
		<Popover.Trigger
			{disabled}
			class={cn(
				buttonVariants({
					variant: 'outline',
					class: 'w-0 grow justify-start text-left font-normal'
				}),
				!date && 'text-muted-foreground',
				className
			)}
		>
			<CalendarIcon class="size-4" />
			<p class="truncate">{date ? df.format(date.toDate(getLocalTimeZone())) : 'Kies een datum'}</p>
		</Popover.Trigger>

		<Button variant="outline" size="icon" class="size-9 shrink-0" {disabled} onclick={clearDate}>
			<BackspaceIcon class="size-4" />
		</Button>
	</div>
	<Popover.Content
		bind:ref={contentRef}
		class="w-auto p-0"
		align="start"
		interactOutsideBehavior="close"
	>
		<Calendar {onValueChange} type="single" bind:value={dateValue} />

		<div class="flex border-t p-2">
			<TimePicker
				{view}
				bind:time
				setTime={(time) => {
					time && setTime(time);
				}}
			/>
		</div>
	</Popover.Content>
</Popover.Root>
