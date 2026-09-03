<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Header from '$lib/components/app/header/app-header.svelte';
	import BreadcrumbMenu from '$lib/components/ui/breadcrumb-menu/breadcrumb-menu.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Field from '$lib/components/ui/field/index.js';
	import * as Item from '$lib/components/ui/item/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { moveArrayItem } from '$lib/utils';
	import { DragDropProvider } from '@dnd-kit-svelte/svelte';
	import { useSortable } from '@dnd-kit-svelte/svelte/sortable';
	import CheckIcon from '@lucide/svelte/icons/check';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { toast } from 'svelte-sonner';

	let { data } = $props();
	type Position = (typeof data.anthology.positions)[number];
	type SortableBind = ReturnType<typeof useSortable>;

	let positions: Position[] = $derived(
		data.anthology.positions.map((position) => ({ ...position }))
	);
	let isSaving = $state(false);
	const safeSortable = (id: string, index: number): SortableBind =>
		useSortable({ id, index }) as SortableBind;

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
	};

	const removePosition = (index: number) => {
		positions = positions
			.filter((_, positionIndex) => positionIndex !== index)
			.map((position, positionIndex) => ({ ...position, order: positionIndex + 1 }));
	};

	const save = async () => {
		if (isSaving) return;
		isSaving = true;
		try {
			const response = await fetch(`/api/anthologies/${data.anthology.id}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ positions })
			});
			const result = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(result.message ?? 'Failed to save story order');
			positions = result.positions;
			await invalidateAll();
			toast.success('Story order saved');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to save story order');
		} finally {
			isSaving = false;
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
					url: `/edit/anthologies/${data.anthology.id}/stories`
				}
			]
		]}
	/>
</Header>

<div class="mx-auto mt-4 grid w-full max-w-2xl gap-4 px-4">
	<Item.Root variant="outline">
		<Item.Content>
			<Item.Title>{data.anthology.name ?? data.anthology.slug}</Item.Title>
			<Item.Description>{data.anthology.slug}</Item.Description>
		</Item.Content>
	</Item.Root>

	<DragDropProvider onDragEnd={reorder}>
		<div class="grid gap-3">
			{#each positions as position, index (position.id)}
				{@const { ref, handleRef } = safeSortable(position.id, index)}
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
						<Select.Root
							type="single"
							value={position.storyId}
							onValueChange={(storyId) => {
								positions = positions.map((item, positionIndex) =>
									positionIndex === index ? { ...item, storyId } : item
								);
							}}
						>
							<Select.Trigger class="w-full">
								{data.stories.find((story) => story.id === position.storyId)?.name ??
									data.stories.find((story) => story.id === position.storyId)?.slug ??
									'Select a story'}
							</Select.Trigger>
							<Select.Content>
								{#each data.stories as story (story.id)}
									<Select.Item value={story.id}>{story.name ?? story.slug}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							class="text-destructive hover:text-destructive"
							onclick={() => removePosition(index)}
						>
							<TrashIcon />
						</Button>
					</div>
				</Field.Set>
			{/each}
		</div>
	</DragDropProvider>

	<div class="flex justify-between gap-2">
		<Button type="button" variant="outline" onclick={addPosition} disabled={!data.stories.length}>
			<PlusIcon />
			Add story
		</Button>
		<Button type="button" onclick={save} disabled={isSaving}>
			{#if isSaving}<LoaderCircleIcon class="animate-spin" />{:else}<CheckIcon />{/if}
			Save order
		</Button>
	</div>
</div>
