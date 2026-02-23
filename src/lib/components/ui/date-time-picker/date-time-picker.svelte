<script lang="ts">
	import { buttonVariants } from '$lib/components/ui/button';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Calendar } from '$lib/components/ui/calendar';
	import * as Popover from '$lib/components/ui/popover';
	import { cn } from '$lib/utils';
	import {
		DateFormatter,
		type DateValue,
		getLocalTimeZone,
		now,
		Time
	} from '@internationalized/date';
	import CalendarIcon from '@lucide/svelte/icons/calendar-days';
	import BackspaceIcon from '@lucide/svelte/icons/delete';
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

	let {
		date = $bindable(),
		class: className,
		view,
		setDate
	}: {
		date?: DateValue;
		class?: string;
		view?: 'labels' | 'dotted';
		setDate?: (date: DateValue | null | undefined) => void;
	} = $props();

	let contentRef = $state<HTMLElement | null>(null);
	let dateValue = $state<DateValue | undefined>(date ?? undefined);

	let time = $state(
		new Time(date && 'hour' in date ? date.hour : 0, date && 'minute' in date ? date.minute : 0)
	);

	const onValueChange = (_date: DateValue | undefined) => {
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

	const setTime = (time: Time) => {
		if (!date) date = now(getLocalTimeZone());
		date = date?.set({
			minute: time.minute,
			hour: time.hour,
			second: time.second
		});

		if (date) setDate?.(date);
	};
</script>

<Popover.Root>
	<div class="flex w-full gap-1">
		<Popover.Trigger
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

		<Button
			variant="outline"
			size="icon"
			class="size-9 shrink-0"
			onclick={() => {
				date = undefined;
				setDate?.(null);
			}}
		>
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
