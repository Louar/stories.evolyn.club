<script lang="ts">
	import HeaderBlank from '$lib/components/app/header/app-header-blank.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import type { findOneStoryById } from '$lib/db/repositories/2-story-module';
	import { moveArrayItem } from '$lib/utils';
	import { DragDropProvider } from '@dnd-kit-svelte/svelte';
	import { useSortable } from '@dnd-kit-svelte/svelte/sortable';
	import ChevronsRightIcon from '@lucide/svelte/icons/chevrons-right';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';
	import EditorSurface from './EditorSurface.svelte';

	type DragEndEvent = {
		operation: { source: { sortable: { index: number; initialIndex: number } | null } | null };
	};

	type Part = Awaited<ReturnType<typeof findOneStoryById>>['parts'][number];
	type Draft = NonNullable<Part['taxonomyDraftForPart']>;
	type Rule = Draft['rules'][number];
	type RangeKey = 'nrOfRounds' | 'score' | 'mistakes' | 'duration';

	let {
		storyId,
		partId,
		draft: rawDraft,
		embedded = false,
		onBack,
		close
	}: {
		storyId: string;
		partId: string;
		draft: Draft;
		embedded?: boolean;
		onBack?: () => void;
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

<EditorSurface {embedded} class={embedded ? '' : 'max-h-[90vh] pt-0 md:max-w-190'}>
	<HeaderBlank class="h-12 w-full bg-muted/50">
		<div class="size-full">
			<h1 class="flex items-center gap-2 truncate overflow-hidden text-sm whitespace-nowrap">
				Foreground
				<ChevronsRightIcon class="size-4 text-muted-foreground" />
				<span class="font-medium">Taxonomy draft rules</span>
			</h1>
		</div>
	</HeaderBlank>

	<form
		class={embedded ? 'grid gap-4 p-4' : 'contents'}
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
</EditorSurface>
