<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import type { findOneStoryById } from '$lib/db/repositories/2-story-module';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { toast } from 'svelte-sonner';
	import { onDestroy } from 'svelte';
	import EditorSurface from './EditorSurface.svelte';

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
		draft.rules.push({
			id: `new-${crypto.randomUUID().slice(0, 8)}`,
			order: draft.rules.filter((rule) => !rule.isRemoved).length + 1,
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

	function setBound(rule: Rule, key: RangeKey, index: 0 | 1, value: string) {
		const parsed = value === '' ? null : Number(value);
		const range = [...(rule[key] ?? [null, null])] as [number | null, number | null];
		range[index] = parsed !== null && Number.isFinite(parsed) ? parsed : null;
		rule[key] = range[0] === null && range[1] === null ? null : range;
	}

	function nullableNumber(value: number | null | undefined) {
		return value === undefined ? null : value;
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
			draft = structuredClone(saved);
			close(saved, autosave);
		} catch {
			if (version === saveVersion) saveState = 'error';
		}
	}
</script>

<EditorSurface {embedded} class={embedded ? '' : 'max-h-[90vh] pt-0 md:max-w-190'}>
	<form
		class={embedded ? 'block min-h-full p-4 pt-0' : 'contents'}
		onsubmit={persist}
		oninput={scheduleAutosave}
		onchange={scheduleAutosave}
	>
		<Dialog.Header class="sticky top-0 z-50 -mx-6 bg-background/90 pt-6 backdrop-blur-md">
			<div class="flex flex-col justify-between gap-2 px-6 md:flex-row">
				<div class="space-y-1 text-left">
					<Dialog.Title>Edit taxonomy game</Dialog.Title>
					<Dialog.Description>{draft.taxonomyName}</Dialog.Description>
				</div>
				<div class="flex gap-2">
					<span class="self-center text-xs text-muted-foreground" aria-live="polite">
						{saveState === 'saving'
							? 'Saving...'
							: saveState === 'saved'
								? 'Saved'
								: saveState === 'error'
									? 'Save failed'
									: saveState === 'dirty'
										? 'Unsaved changes'
										: ''}
					</span>
					{#if embedded && onBack}
						<Button type="button" variant="outline" onclick={onBack}>Back</Button>
					{:else if !embedded}
						<Dialog.Close class={buttonVariants({ variant: 'outline' })}>Cancel</Dialog.Close>
					{/if}
				</div>
			</div>
			<Separator class="mt-4" />
		</Dialog.Header>

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

		<div class="grid gap-4">
			{#each draft.rules as rule (rule.id)}
				{#if !rule.isRemoved}
					<Field.Set class="grid gap-4 rounded-lg border p-4">
						<div class="flex items-center justify-between">
							<Field.Legend>Rule {rule.order}</Field.Legend>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								class="text-destructive"
								onclick={() => removeRule(rule)}
								aria-label={`Remove rule ${rule.order}`}><TrashIcon /></Button
							>
						</div>
						<p class="text-sm text-muted-foreground">
							Every configured range must match. Empty bounds are unbounded.
						</p>
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
				{/if}
			{/each}
			<Button type="button" variant="outline" onclick={addRule}>Add rule</Button>
		</div>
	</form>
</EditorSurface>
