<script lang="ts">
	import { resolve } from '$app/paths';
	import Header from '$lib/components/app/header/app-header.svelte';
	import BreadcrumbMenu from '$lib/components/ui/breadcrumb-menu/breadcrumb-menu.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import * as Item from '$lib/components/ui/item/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { moveArrayItem } from '$lib/utils';
	import { DragDropProvider } from '@dnd-kit-svelte/svelte';
	import { useSortable } from '@dnd-kit-svelte/svelte/sortable';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import TvMinimalPlayIcon from '@lucide/svelte/icons/tv-minimal-play';
	import { toast } from 'svelte-sonner';

	let { data } = $props();
	let anthology = $derived(data.anthology);
	type Position = (typeof anthology.positions)[number];
	type SortableBind = ReturnType<typeof useSortable>;

	let positions: Position[] = $derived(anthology.positions.map((position) => ({ ...position })));
	let isSaving = $state(false);
	let saveQueued = false;
	let saveStatus = $state<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
	let openStoryPickerId = $state<string | null>(null);
	const safeSortable = (id: string, index: number): SortableBind =>
		useSortable({ id, index }) as SortableBind;

	const queueSave = () => {
		saveStatus = 'pending';
		if (isSaving) {
			saveQueued = true;
			return;
		}
		void save();
	};

	const reorder = (event: unknown) => {
		const sortable = (
			event as {
				operation?: { source?: { sortable?: { index: number; initialIndex: number } } | null };
			}
		).operation?.source?.sortable;
		if (!sortable || sortable.index === sortable.initialIndex) return;
		positions = moveArrayItem(positions, sortable.initialIndex, sortable.index).map(
			(position, index) => ({ ...position, order: index + 1 })
		);
		queueSave();
	};

	const addPosition = () => {
		const availableStory = data.stories.find(
			(story) => !positions.some((position) => position.storyId === story.id)
		);
		if (!availableStory) return;
		positions = [
			...positions,
			{
				id: `new-${crypto.randomUUID().slice(0, 8)}`,
				storyId: availableStory.id,
				order: positions.length + 1,
				configuration: null
			}
		];
		queueSave();
	};

	const removePosition = (index: number) => {
		positions = positions
			.filter((_, positionIndex) => positionIndex !== index)
			.map((position, positionIndex) => ({ ...position, order: positionIndex + 1 }));
		queueSave();
	};

	const save = async () => {
		isSaving = true;
		saveStatus = 'saving';
		try {
			const response = await fetch(`/api/anthologies/${anthology.id}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ positions })
			});
			const result = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(result.message ?? 'Failed to save story order');
			const savedPositions = result.positions as Position[] | undefined;
			if (savedPositions) {
				const savedPositionsByStoryId = new Map(
					savedPositions.map((position) => [position.storyId, position])
				);
				positions = positions.map((position) => {
					const savedPosition = savedPositionsByStoryId.get(position.storyId);
					return position.id.startsWith('new') && savedPosition
						? { ...position, id: savedPosition.id }
						: position;
				});
			}
			if (!saveQueued) saveStatus = 'saved';
		} catch (error) {
			saveStatus = 'error';
			toast.error(error instanceof Error ? error.message : 'Failed to save story order');
		} finally {
			isSaving = false;
			if (saveQueued) {
				saveQueued = false;
				void save();
			}
		}
	};
</script>

<svelte:head><title>Order anthology stories</title></svelte:head>

<Header>
	<BreadcrumbMenu
		menus={[
			[
				{ isTrigger: true, label: 'Anthologies', url: '/edit/anthologies' },
				{ label: 'Stories', url: '/edit/stories' }
			],
			[
				{
					isTrigger: true,
					label: 'Story order',
					url: `/edit/anthologies/${anthology.id}/stories`
				}
			]
		]}
	/>
</Header>

<div class="mx-auto mt-4 grid w-full max-w-2xl gap-4 px-4 pb-10">
	<Item.Root variant="outline">
		<Item.Content>
			<Item.Title>{anthology.name ?? anthology.slug}</Item.Title>
			<Item.Description>{anthology.slug}</Item.Description>
		</Item.Content>
		<Item.Actions>
			<Button
				href={resolve(`/${anthology.slug}` as '/[anthologySlug]/[...settings]')}
				target="_blank"
				variant="outline"
				size="icon"
				aria-label="Preview story"
			>
				<TvMinimalPlayIcon />
			</Button>
		</Item.Actions>
	</Item.Root>

	<DragDropProvider onDragEnd={reorder}>
		<div class="grid gap-3">
			{#each positions as position, index (position.id)}
				{@const { ref, handleRef } = safeSortable(position.id, index)}
				{@const selectedStory = data.stories.find((story) => story.id === position.storyId)}
				<Field.Set class="rounded-lg border bg-card p-3" {@attach ref}>
					<div class="flex items-center gap-2">
						<Button
							type="button"
							variant="ghost"
							size="icon"
							class="cursor-move"
							{@attach handleRef}
						>
							<GripVerticalIcon />
						</Button>
						<Popover.Root
							open={openStoryPickerId === position.id}
							onOpenChange={(open) => (openStoryPickerId = open ? position.id : null)}
						>
							<Popover.Trigger>
								{#snippet child({ props })}
									<Button
										{...props}
										variant="outline"
										role="combobox"
										aria-expanded={openStoryPickerId === position.id}
										class="min-w-0 flex-1 justify-between font-normal"
									>
										<span class="truncate">
											{selectedStory?.name ?? selectedStory?.slug ?? 'Select a story'}
										</span>
										<ChevronsUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
									</Button>
								{/snippet}
							</Popover.Trigger>
							<Popover.Content class="w-(--bits-popover-anchor-width) p-0" align="start">
								<Command.Root>
									<Command.Input placeholder="Search stories..." />
									<Command.List class="max-h-72">
										<Command.Empty>No stories found.</Command.Empty>
										<Command.Group>
											{#each data.stories as story (story.id)}
												<Command.Item
													value={`${story.name ?? ''} ${story.slug}`}
													disabled={positions.some(
														(item, positionIndex) =>
															positionIndex !== index && item.storyId === story.id
													)}
													onSelect={() => {
														positions = positions.map((item, positionIndex) =>
															positionIndex === index ? { ...item, storyId: story.id } : item
														);
														openStoryPickerId = null;
														queueSave();
													}}
												>
													<div class="w-full">
														<p class="line-clamp-3">{story.name ?? story.slug}</p>
														<p class="truncate text-muted-foreground">{story.slug}</p>
													</div>
													<CheckIcon
														class="ml-auto size-4 shrink-0 {story.id === position.storyId
															? 'opacity-100'
															: 'opacity-0'}"
													/>
												</Command.Item>
											{/each}
										</Command.Group>
									</Command.List>
								</Command.Root>
							</Popover.Content>
						</Popover.Root>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							class="text-destructive hover:text-destructive"
							onclick={() => removePosition(index)}
						>
							<TrashIcon />
						</Button>
						<Button
							href={`/edit/stories/${position.storyId}/flow`}
							variant="ghost"
							size="icon"
							aria-label={`Edit ${selectedStory?.name ?? selectedStory?.slug ?? 'story'} flow`}
						>
							<PencilIcon />
						</Button>
					</div>
				</Field.Set>
			{/each}
		</div>
	</DragDropProvider>

	<div class="flex flex-col items-center justify-between gap-4">
		<Button class="w-full" type="button" onclick={addPosition} disabled={!data.stories.length}>
			<PlusIcon />
			Add story
		</Button>
		<p class="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
			{#if saveStatus === 'pending' || saveStatus === 'saving'}
				<LoaderCircleIcon class="size-4 animate-spin" />
				Saving changes...
			{:else if saveStatus === 'saved'}
				<CheckIcon class="size-4" />
				Changes saved
			{:else if saveStatus === 'error'}
				Changes not saved
			{/if}
		</p>
	</div>
</div>
