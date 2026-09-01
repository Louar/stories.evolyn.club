<script lang="ts">
	import HeaderBlank from '$lib/components/app/header/app-header-blank.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { translateLocalizedField, type Translatable } from '$lib/db/schemas/0-utils.js';
	import type { findOneStoryById } from '$lib/db/repositories/2-story-module';
	import { UI } from '$lib/states/ui.svelte';
	import { moveArrayItem } from '$lib/utils';
	import { DragDropProvider } from '@dnd-kit-svelte/svelte';
	import { useSortable } from '@dnd-kit-svelte/svelte/sortable';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import ChevronsRightIcon from '@lucide/svelte/icons/chevrons-right';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import XIcon from '@lucide/svelte/icons/x';
	import { onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';

	type DragEndEvent = {
		operation: { source: { sortable: { index: number; initialIndex: number } | null } | null };
	};

	type Part = Awaited<ReturnType<typeof findOneStoryById>>['parts'][number];
	type Draft = NonNullable<Part['taxonomyDraftForPart']>;
	type Rule = Draft['rules'][number];
	type RangeKey = 'nrOfRounds' | 'score' | 'mistakes' | 'duration';
	type SelectionKey = 'draftedAttributeIds' | 'draftedCategoryIds' | 'draftedItemIds';
	type ScopeOption = { id: string; label: string };

	let {
		storyId,
		partId,
		draft: rawDraft,
		close
	}: {
		storyId: string;
		partId: string;
		draft: Draft;
		close: (draft?: Draft, keepOpen?: boolean) => void;
	} = $props();
	// svelte-ignore state_referenced_locally
	let draft = $state(structuredClone($state.snapshot(rawDraft)));
	let saveState = $state<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
	let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
	let saveVersion = 0;

	function scheduleAutosave() {
		saveVersion += 1;
		saveState = 'dirty';
		clearTimeout(autosaveTimer);
		autosaveTimer = setTimeout(() => persist(undefined, true), 700);
	}
	onDestroy(() => {
		clearTimeout(autosaveTimer);
		if (saveState === 'dirty') void persist(undefined, true);
	});

	const metrics: Array<{ key: RangeKey; label: string }> = [
		{ key: 'nrOfRounds', label: 'Rounds played' },
		{ key: 'score', label: 'Score' },
		{ key: 'mistakes', label: 'Mistakes' },
		{ key: 'duration', label: 'Duration (ms)' }
	];

	function addRule() {
		const order = draft.rules.filter((rule) => !rule.isRemoved).length + 1;
		draft.rules.push({
			id: `new-${crypto.randomUUID().slice(0, 8)}`,
			order,
			name: `Rule ${order}`,
			nextPartId: null,
			nrOfRounds: null,
			score: null,
			mistakes: null,
			duration: null,
			isRemoved: false
		});
		scheduleAutosave();
	}

	function removeRule(rule: Rule) {
		rule.isRemoved = true;
		draft.rules
			.filter((item) => !item.isRemoved)
			.forEach((item, index) => (item.order = index + 1));
		scheduleAutosave();
	}

	function handleRuleDrag(event: DragEndEvent) {
		const sortable = event.operation.source?.sortable;
		if (!sortable || sortable.initialIndex === sortable.index) return;
		draft.rules = moveArrayItem(draft.rules, sortable.initialIndex, sortable.index);
		draft.rules
			.filter((rule) => !rule.isRemoved)
			.forEach((rule, index) => (rule.order = index + 1));
		scheduleAutosave();
	}

	function setBound(rule: Rule, key: RangeKey, index: 0 | 1, value: string) {
		const parsed = value === '' ? null : Number(value);
		const range = [...(rule[key] ?? [null, null])] as [number | null, number | null];
		range[index] = parsed !== null && Number.isFinite(parsed) ? parsed : null;
		rule[key] = range[0] === null && range[1] === null ? null : range;
	}

	function nullableNumber(value: number | null | undefined) {
		return value === undefined ? null : value;
	}

	function isSelected(key: SelectionKey, id: string) {
		return (draft[key] ?? []).includes(id);
	}

	function toggleSelected(key: SelectionKey, id: string, selected: boolean) {
		const current = draft[key] ?? [];
		if (selected && !current.includes(id)) draft[key] = [...current, id];
		else if (!selected) draft[key] = current.filter((selectedId) => selectedId !== id);
		scheduleAutosave();
	}

	function clearSelected(key: SelectionKey) {
		draft[key] = [];
		scheduleAutosave();
	}

	function selectedOptions(key: SelectionKey, options: ScopeOption[]) {
		return (draft[key] ?? []).map(
			(id) => options.find((option) => option.id === id) ?? { id, label: id }
		);
	}

	function translatedLabel(value: Translatable | null | undefined, fallback: string) {
		return translateLocalizedField(value, UI.language) ?? fallback;
	}

	const attributeScopeOptions = $derived(
		draft.attributeOptions.map((attribute) => ({
			id: attribute.id,
			label: translatedLabel(attribute.name as Translatable, attribute.slug)
		}))
	);
	const categoryScopeOptions = $derived(
		draft.categoryOptions.map((category) => ({
			id: category.id,
			label: translatedLabel(category.name as Translatable, category.id)
		}))
	);
	const itemScopeOptions = $derived(
		draft.itemOptions.map((item) => ({
			id: item.id,
			label: item.id
		}))
	);

	function mergeSavedIds(saved: Draft) {
		const rules = draft.rules.filter((rule) => !rule.isRemoved);
		const savedRules = [...saved.rules].sort((a, b) => a.order - b.order);

		for (const [index, rule] of rules.entries()) {
			const savedRule = savedRules[index];
			if (savedRule) rule.id = savedRule.id;
		}
	}

	async function persist(event?: SubmitEvent, autosave = false) {
		event?.preventDefault();
		clearTimeout(autosaveTimer);
		const version = ++saveVersion;
		saveState = 'saving';
		const request = (async () => {
			const result = await fetch(`/api/stories/${storyId}/parts/${partId}/taxonomy/logic`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					taxonomyId: draft.taxonomyId,
					nrOfRounds: nullableNumber(draft.nrOfRounds),
					nrOfItemsPerRound: nullableNumber(draft.nrOfItemsPerRound),
					goal: nullableNumber(draft.goal),
					maxMistakes: nullableNumber(draft.maxMistakes),
					difficulty: nullableNumber(draft.difficulty),
					draftedAttributeIds: draft.draftedAttributeIds ?? [],
					draftedCategoryIds: draft.draftedCategoryIds ?? [],
					draftedItemIds: draft.draftedItemIds ?? [],
					rules: draft.rules
				})
			});
			if (!result.ok) throw new Error('Saving taxonomy draft failed');
			return (await result.json()) as Draft;
		})();
		toast.promise(request, {
			loading: 'Saving taxonomy draft...',
			success: 'Taxonomy draft saved',
			error: 'Could not save taxonomy draft'
		});
		try {
			const saved = await request;
			if (version !== saveVersion) return;
			saveState = 'saved';
			if (autosave) mergeSavedIds(saved);
			else draft = structuredClone(saved);
			close(saved, autosave);
		} catch {
			if (version === saveVersion) saveState = 'error';
		}
	}
</script>

<div>
	<HeaderBlank class="h-12 w-full bg-muted/50">
		<div>
			<h1 class="flex items-center gap-2 truncate overflow-hidden text-sm whitespace-nowrap">
				Foreground
				<ChevronsRightIcon class="size-4 text-muted-foreground" />
				<span class="font-medium">Taxonomy draft rules</span>
			</h1>
		</div>
		<p class="ml-auto self-center text-xs text-muted-foreground" aria-live="polite">
			{saveState === 'saving'
				? 'Saving...'
				: saveState === 'saved'
					? 'Saved'
					: saveState === 'error'
						? 'Save failed'
						: saveState === 'dirty'
							? 'Unsaved changes'
							: 'No changes'}
		</p>
	</HeaderBlank>

	<form
		class="grid gap-4 p-4"
		onsubmit={persist}
		oninput={scheduleAutosave}
		onchange={scheduleAutosave}
	>
		<Field.Set class="grid gap-4 rounded-lg border p-4">
			<Field.Legend>Game parameters</Field.Legend>
			<div class="grid grid-cols-2 gap-3 md:grid-cols-3">
				<Field.Field
					><Field.Label>Rounds</Field.Label><Input
						type="number"
						min="1"
						bind:value={draft.nrOfRounds}
					/></Field.Field
				>
				<Field.Field
					><Field.Label>Items per round</Field.Label><Input
						type="number"
						min="1"
						bind:value={draft.nrOfItemsPerRound}
					/></Field.Field
				>
				<Field.Field
					><Field.Label>Goal</Field.Label><Input
						type="number"
						min="1"
						bind:value={draft.goal}
					/></Field.Field
				>
				<Field.Field
					><Field.Label>Max mistakes</Field.Label><Input
						type="number"
						min="0"
						bind:value={draft.maxMistakes}
					/></Field.Field
				>
				<Field.Field
					><Field.Label>Difficulty</Field.Label><Input
						type="number"
						min="0"
						bind:value={draft.difficulty}
					/></Field.Field
				>
			</div>
		</Field.Set>

		<Field.Set class="grid gap-4 rounded-lg border p-4">
			<Field.Legend>Drafting scope</Field.Legend>
			<p class="text-sm text-muted-foreground">
				Limit which taxonomy content can be drafted for rounds. Empty selections mean any option in
				the taxonomy is allowed.
			</p>
			<div class="grid gap-4 md:grid-cols-3">
				<Field.Field class="content-start gap-2">
					<Field.Label>Attributes</Field.Label>
					<p class="text-xs text-muted-foreground">Empty means any attribute.</p>
					<Popover.Root>
						<Popover.Trigger>
							{#snippet child({ props })}
								<Button
									{...props}
									type="button"
									variant="outline"
									class="min-h-10 w-full justify-between"
								>
									<span class="truncate text-left font-normal">
										{(draft.draftedAttributeIds ?? []).length
											? `${(draft.draftedAttributeIds ?? []).length} selected`
											: 'Any attribute'}
									</span>
									<ChevronsUpDownIcon class="size-4 text-muted-foreground" />
								</Button>
							{/snippet}
						</Popover.Trigger>
						<Popover.Content align="start" class="w-80 p-0">
							<Command.Root>
								<div class="flex min-h-10 flex-wrap items-center gap-1 border-b px-3 py-1.5">
									{#each selectedOptions('draftedAttributeIds', attributeScopeOptions) as option (option.id)}
										<Badge variant="secondary" class="h-5 gap-1 px-1.5 text-xs">
											{option.label}
											<button
												type="button"
												onclick={() => toggleSelected('draftedAttributeIds', option.id, false)}
											>
												<XIcon class="size-3" />
											</button>
										</Badge>
									{/each}
									<Command.Input placeholder="Search attributes..." class="h-auto flex-1 py-1" />
								</div>
								<Command.List>
									<Command.Empty>No attributes found.</Command.Empty>
									<Command.Group class="max-h-64 overflow-auto">
										{#each attributeScopeOptions as option (option.id)}
											<Command.Item
												value={option.label}
												onSelect={() =>
													toggleSelected(
														'draftedAttributeIds',
														option.id,
														!isSelected('draftedAttributeIds', option.id)
													)}
											>
												<CheckIcon
													class="size-4 {isSelected('draftedAttributeIds', option.id)
														? 'opacity-100'
														: 'opacity-0'}"
												/>
												<span class="truncate">{option.label}</span>
											</Command.Item>
										{/each}
									</Command.Group>
									{#if (draft.draftedAttributeIds ?? []).length > 0}
										<Command.Separator />
										<Command.Group>
											<Command.Item
												onSelect={() => clearSelected('draftedAttributeIds')}
												class="justify-center text-muted-foreground"
											>
												Clear all
											</Command.Item>
										</Command.Group>
									{/if}
								</Command.List>
							</Command.Root>
						</Popover.Content>
					</Popover.Root>
				</Field.Field>

				<Field.Field class="content-start gap-2">
					<Field.Label>Categories</Field.Label>
					<p class="text-xs text-muted-foreground">Empty means any category.</p>
					<Popover.Root>
						<Popover.Trigger>
							{#snippet child({ props })}
								<Button
									{...props}
									type="button"
									variant="outline"
									class="min-h-10 w-full justify-between"
								>
									<span class="truncate text-left font-normal">
										{(draft.draftedCategoryIds ?? []).length
											? `${(draft.draftedCategoryIds ?? []).length} selected`
											: 'Any category'}
									</span>
									<ChevronsUpDownIcon class="size-4 text-muted-foreground" />
								</Button>
							{/snippet}
						</Popover.Trigger>
						<Popover.Content align="start" class="w-80 p-0">
							<Command.Root>
								<div class="flex min-h-10 flex-wrap items-center gap-1 border-b px-3 py-1.5">
									{#each selectedOptions('draftedCategoryIds', categoryScopeOptions) as option (option.id)}
										<Badge variant="secondary" class="h-5 gap-1 px-1.5 text-xs">
											{option.label}
											<button
												type="button"
												onclick={() => toggleSelected('draftedCategoryIds', option.id, false)}
											>
												<XIcon class="size-3" />
											</button>
										</Badge>
									{/each}
									<Command.Input placeholder="Search categories..." class="h-auto flex-1 py-1" />
								</div>
								<Command.List>
									<Command.Empty>No categories found.</Command.Empty>
									<Command.Group class="max-h-64 overflow-auto">
										{#each categoryScopeOptions as option (option.id)}
											<Command.Item
												value={option.label}
												onSelect={() =>
													toggleSelected(
														'draftedCategoryIds',
														option.id,
														!isSelected('draftedCategoryIds', option.id)
													)}
											>
												<CheckIcon
													class="size-4 {isSelected('draftedCategoryIds', option.id)
														? 'opacity-100'
														: 'opacity-0'}"
												/>
												<span class="truncate">{option.label}</span>
											</Command.Item>
										{/each}
									</Command.Group>
									{#if (draft.draftedCategoryIds ?? []).length > 0}
										<Command.Separator />
										<Command.Group>
											<Command.Item
												onSelect={() => clearSelected('draftedCategoryIds')}
												class="justify-center text-muted-foreground"
											>
												Clear all
											</Command.Item>
										</Command.Group>
									{/if}
								</Command.List>
							</Command.Root>
						</Popover.Content>
					</Popover.Root>
				</Field.Field>

				<Field.Field class="content-start gap-2">
					<Field.Label>Items</Field.Label>
					<p class="text-xs text-muted-foreground">Empty means any item.</p>
					<Popover.Root>
						<Popover.Trigger>
							{#snippet child({ props })}
								<Button
									{...props}
									type="button"
									variant="outline"
									class="min-h-10 w-full justify-between"
								>
									<span class="truncate text-left font-normal">
										{(draft.draftedItemIds ?? []).length
											? `${(draft.draftedItemIds ?? []).length} selected`
											: 'Any item'}
									</span>
									<ChevronsUpDownIcon class="size-4 text-muted-foreground" />
								</Button>
							{/snippet}
						</Popover.Trigger>
						<Popover.Content align="start" class="w-80 p-0">
							<Command.Root>
								<div class="flex min-h-10 flex-wrap items-center gap-1 border-b px-3 py-1.5">
									{#each selectedOptions('draftedItemIds', itemScopeOptions) as option (option.id)}
										<Badge variant="secondary" class="h-5 gap-1 px-1.5 text-xs">
											{option.label}
											<button
												type="button"
												onclick={() => toggleSelected('draftedItemIds', option.id, false)}
											>
												<XIcon class="size-3" />
											</button>
										</Badge>
									{/each}
									<Command.Input placeholder="Search items..." class="h-auto flex-1 py-1" />
								</div>
								<Command.List>
									<Command.Empty>No items found.</Command.Empty>
									<Command.Group class="max-h-64 overflow-auto">
										{#each itemScopeOptions as option (option.id)}
											<Command.Item
												value={option.label}
												onSelect={() =>
													toggleSelected(
														'draftedItemIds',
														option.id,
														!isSelected('draftedItemIds', option.id)
													)}
											>
												<CheckIcon
													class="size-4 {isSelected('draftedItemIds', option.id)
														? 'opacity-100'
														: 'opacity-0'}"
												/>
												<span class="truncate">{option.label}</span>
											</Command.Item>
										{/each}
									</Command.Group>
									{#if (draft.draftedItemIds ?? []).length > 0}
										<Command.Separator />
										<Command.Group>
											<Command.Item
												onSelect={() => clearSelected('draftedItemIds')}
												class="justify-center text-muted-foreground"
											>
												Clear all
											</Command.Item>
										</Command.Group>
									{/if}
								</Command.List>
							</Command.Root>
						</Popover.Content>
					</Popover.Root>
				</Field.Field>
			</div>
		</Field.Set>

		<DragDropProvider onDragEnd={(event) => handleRuleDrag(event as DragEndEvent)}>
			<div class="grid gap-4">
				{#each draft.rules as rule, r (rule)}
					{@const { ref, handleRef } = useSortable({
						id: rule.id,
						index: r
					})}
					<Field.Set
						class="grid gap-4 rounded-lg border bg-card/50 p-4 backdrop-blur-md {rule.isRemoved
							? 'hidden'
							: ''}"
						{@attach ref}
					>
						<div class="flex items-center justify-between gap-2">
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
								<Field.Label>Rule {rule.order}</Field.Label>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								class="text-destructive hover:bg-destructive/10 hover:text-destructive"
								onclick={() => removeRule(rule)}
								aria-label={`Remove rule ${rule.order}`}><TrashIcon /></Button
							>
						</div>
						<Field.Field>
							<Field.Label>Name</Field.Label>
							<Input bind:value={rule.name} />
						</Field.Field>
						<div class="grid gap-3">
							{#each metrics as metric (metric.key)}
								<div class="grid grid-cols-[minmax(8rem,1fr)_1fr_1fr] items-end gap-2">
									<Field.Label>{metric.label}</Field.Label>
									<Field.Field
										><Field.Label>Minimum</Field.Label><Input
											type="number"
											value={rule[metric.key]?.[0] ?? ''}
											oninput={(event) => setBound(rule, metric.key, 0, event.currentTarget.value)}
										/></Field.Field
									>
									<Field.Field
										><Field.Label>Maximum</Field.Label><Input
											type="number"
											value={rule[metric.key]?.[1] ?? ''}
											oninput={(event) => setBound(rule, metric.key, 1, event.currentTarget.value)}
										/></Field.Field
									>
								</div>
							{/each}
						</div>
					</Field.Set>
				{/each}
				<Button type="button" variant="outline" onclick={addRule}>Add rule</Button>
			</div>
		</DragDropProvider>
	</form>
</div>
