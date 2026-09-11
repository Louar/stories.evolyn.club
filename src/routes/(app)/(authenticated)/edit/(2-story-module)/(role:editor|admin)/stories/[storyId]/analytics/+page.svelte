<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Header from '$lib/components/app/header/app-header.svelte';
	import BreadcrumbMenu from '$lib/components/ui/breadcrumb-menu/breadcrumb-menu.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { translateLocalizedField } from '$lib/db/schemas/0-utils.js';
	import { CalendarDate, type DateValue } from '@internationalized/date';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import FilterIcon from '@lucide/svelte/icons/list-filter';
	import MousePointerClickIcon from '@lucide/svelte/icons/mouse-pointer-click';
	import PencilRulerIcon from '@lucide/svelte/icons/pencil-ruler';
	import RouteIcon from '@lucide/svelte/icons/route';
	import TvMinimalPlayIcon from '@lucide/svelte/icons/tv-minimal-play';
	import UsersIcon from '@lucide/svelte/icons/users';
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import AnalyticsFlow from './AnalyticsFlow.svelte';

	let { data } = $props();
	let filterOpen = $state(false);

	const toCalendarDate = (value: string) => {
		const [year, month, day] = value.split('-').map(Number);
		return new CalendarDate(year, month, day);
	};
	const formatCalendarDate = (value: DateValue) =>
		`${value.year}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`;

	let start: DateValue = $derived(toCalendarDate(data.range.start));
	let end: DateValue = $derived(toCalendarDate(data.range.end));

	const applyFilters = async () => {
		const nextUrl = new URL(page.url);
		nextUrl.searchParams.set('start', formatCalendarDate(start));
		nextUrl.searchParams.set('end', formatCalendarDate(end));
		filterOpen = false;
		await goto(
			resolve((nextUrl.pathname + nextUrl.search) as '/edit/stories/[storyId]/analytics'),
			{
				keepFocus: true,
				noScroll: true,
				replaceState: true
			}
		);
	};
</script>

<svelte:head>
	<title>Analytics: {translateLocalizedField(data.story.name)}</title>
</svelte:head>

<Header>
	<BreadcrumbMenu
		menus={[
			[
				{ label: 'Anthologies', url: `/edit/anthologies` },
				{ isTrigger: true, label: 'Stories', url: `/edit/stories` }
			],
			[
				{ label: 'Permissions', url: `/edit/stories/${page.params.storyId}/permissions` },
				{ label: 'Assets', url: `/edit/stories/${page.params.storyId}/assets` },
				{ label: 'Flow', url: `/edit/stories/${page.params.storyId}/flow` },
				{
					isTrigger: true,
					label: 'Analytics',
					url: `/edit/stories/${page.params.storyId}/analytics`
				}
			]
		]}
	/>
	<div class="ml-auto flex items-center gap-2">
		<Popover.Root bind:open={filterOpen}>
			<Popover.Trigger>
				{#snippet child({ props })}
					<Button {...props} variant="outline">
						<FilterIcon />Analytics filters
					</Button>
				{/snippet}
			</Popover.Trigger>
			<Popover.Content
				align="end"
				class="max-h-[calc(100svh-2rem)] w-[min(32rem,calc(100vw-2rem))] space-y-4 overflow-y-auto p-4"
			>
				<div>
					<h2 class="font-medium">Date range</h2>
					<p class="text-sm text-muted-foreground">Both selected dates are included.</p>
				</div>
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<p class="text-sm font-medium">Start date</p>
						<Calendar type="single" bind:value={start} maxValue={end} preventDeselect />
					</div>
					<div class="space-y-2">
						<p class="text-sm font-medium">End date</p>
						<Calendar type="single" bind:value={end} minValue={start} preventDeselect />
					</div>
				</div>
				<div class="flex justify-end">
					<Button size="sm" onclick={applyFilters}>Apply filters</Button>
				</div>
			</Popover.Content>
		</Popover.Root>
		<Button
			href={resolve(`/edit/stories/${data.story.id}/flow`)}
			target="_blank"
			variant="outline"
			size="icon"
			aria-label="Edit story"
		>
			<PencilRulerIcon />
		</Button>
		<Button
			href={resolve(`/s/${data.story.slug}` as '/s/[storySlug]/[...settings]')}
			target="_blank"
			variant="outline"
			size="icon"
			aria-label="Preview story"
		>
			<TvMinimalPlayIcon />
		</Button>
	</div>
</Header>

<main class="flex min-h-0 flex-1 flex-col gap-4 p-4">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">
				{translateLocalizedField(data.story.name)} analytics
			</h1>
			<p class="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
				<CalendarIcon class="size-4" />{data.range.start} to {data.range.end} (UTC)
			</p>
		</div>
		<p class="text-xs text-muted-foreground">
			Sessions include visitors who generated a transition.
		</p>
	</div>

	<div class="grid gap-3 sm:grid-cols-3">
		<Card.Root>
			<Card.Header class="flex-row items-center justify-between pb-2">
				<Card.Description>Story sessions</Card.Description><UsersIcon
					class="size-4 text-muted-foreground"
				/>
			</Card.Header>
			<Card.Content
				><p class="text-3xl font-semibold tabular-nums">{data.stats.sessions}</p></Card.Content
			>
		</Card.Root>
		<Card.Root>
			<Card.Header class="flex-row items-center justify-between pb-2">
				<Card.Description>Transitions</Card.Description><RouteIcon
					class="size-4 text-muted-foreground"
				/>
			</Card.Header>
			<Card.Content
				><p class="text-3xl font-semibold tabular-nums">{data.stats.transitions}</p></Card.Content
			>
		</Card.Root>
		<Card.Root>
			<Card.Header class="flex-row items-center justify-between pb-2">
				<Card.Description>Quiz answers</Card.Description><MousePointerClickIcon
					class="size-4 text-muted-foreground"
				/>
			</Card.Header>
			<Card.Content
				><p class="text-3xl font-semibold tabular-nums">{data.stats.interactions}</p></Card.Content
			>
		</Card.Root>
	</div>

	<section
		class="h-[calc(100svh-18rem)] min-h-[32rem] overflow-hidden rounded-xl border bg-muted/20"
	>
		<SvelteFlowProvider>
			<AnalyticsFlow
				story={data.story}
				transitions={data.transitions}
				interactions={data.interactions}
			/>
		</SvelteFlowProvider>
	</section>
</main>
