<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import type { findOneQuizById, findOneStoryById } from '$lib/db/repositories/2-stories-module';
	import { DragDropProvider } from '@dnd-kit-svelte/svelte';
	import { useSortable } from '@dnd-kit-svelte/svelte/sortable';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import type { $ZodIssue } from 'zod/v4/core';

	type DragEndEvent = {
		operation: { source: { sortable: { index: number; initialIndex: number } | null } | null };
	};

	type Props = {
		storyId: string;
		partId: string;
		rules: NonNullable<
			Awaited<ReturnType<typeof findOneStoryById>>['parts'][number]['quizLogicForPart']
		>['rules'];
		quiz: Awaited<ReturnType<typeof findOneStoryById>>['quizzes'][number];
		close: (output: {
			action: 'persist' | 'delete';
			id?: string;
			rules?: Awaited<ReturnType<typeof findOneQuizById>>;
		}) => void;
	};
	let { storyId, partId, rules, quiz, close }: Props = $props();

	let error = $state<$ZodIssue[] | null>(null);

	const addRule = () => {
		rules?.push({
			id: `new-${crypto.randomUUID().toString().slice(0, 8)}`,
			order: (rules?.length ?? 0) + 1,
			name: '',
			nextPartId: 'null',
			inputs: [],
			isRemoved: false // Front-end purposes
		});
	};

	const addRuleInput = (rule: (typeof rules)[number]) => {
		rule.inputs.push({
			id: `new-${crypto.randomUUID().toString().slice(0, 8)}`,
			quizQuestionTemplateId: 'null',
			value: null,
			quizQuestionTemplateAnswerItemId: null,
			isRemoved: false // Front-end purposes
		});
	};

	const handleRuleDrag = (event: DragEndEvent) => {
		const sortable = event.operation.source?.sortable;
		if (!sortable) return;
		const questions = moveArrayItem(quiz.questions ?? [], sortable.initialIndex, sortable.index);
		questions?.filter((q) => !q.isRemoved)?.forEach((q, i) => (q.order = i + 1)) ?? [];
		quiz.questions = questions;
	};

	// Helper function to reorder array
	const moveArrayItem = <T,>(array: T[], fromIndex: number, to: number): T[] => {
		const newArray = [...array];
		const [removed] = newArray.splice(fromIndex, 1);
		newArray.splice(to, 0, removed);
		return newArray;
	};

	const persist = async (event: Event) => {
		event.preventDefault();

		const result = await fetch(
			`/api/stories/${storyId}/parts/${partId}/quizzes/${quiz.id ?? 'new'}/logic`,
			{
				method: 'POST',
				body: JSON.stringify(quiz)
			}
		);

		if (!result.ok) error = await result.json();
		else close({ action: 'persist', rules: await result.json() });
	};
	const remove = async () => {
		if (!quiz.id?.length) return;
		const result = await fetch(`/api/stories/${storyId}/quizzes/${quiz.id}/questions`, {
			method: 'DELETE'
		});
		if (!result.ok) error = await result.json();
		else {
			close({ action: 'delete', id: quiz.id });
			// quiz = defaultQuiz;
		}
	};
</script>

<form onsubmit={persist}>
	<Dialog.Content
		class="scrollbar-none max-h-[90vh] overflow-y-auto pt-0 sm:max-w-200"
		showCloseButton={false}
	>
		<Dialog.Header class="sticky top-0 z-50 -mx-6 bg-background/50 pt-6 backdrop-blur-md">
			<div class="flex justify-between gap-2 px-6">
				<div class="space-y-2 text-left">
					<Dialog.Title>Edit rules</Dialog.Title>
					<Dialog.Description>Quiz: {quiz.name}</Dialog.Description>
				</div>
				<!-- <Dialog.Close class={buttonVariants({ variant: 'ghost', size: 'icon' })}>
					<XIcon />
				</Dialog.Close> -->

				<div class="flex gap-2">
					<Dialog.Close class={buttonVariants({ variant: 'outline' })}>Cancel</Dialog.Close>
					<Button type="submit" onclick={persist}>Save logic</Button>
				</div>
			</div>

			<Separator class="mt-4" />
		</Dialog.Header>

		<DragDropProvider onDragEnd={(event) => handleRuleDrag(event as DragEndEvent)}>
			<div class="grid gap-4">
				{#each rules as rule, r (rule.id)}
					{@const { ref, handleRef } = useSortable({
						id: rule.id,
						index: r
					})}
					<Field.Set
						class="grid gap-0 rounded-lg border bg-card/50 backdrop-blur-md {rule.isRemoved
							? 'hidden'
							: ''}"
						{@attach ref}
					>
						<Collapsible.Root open={true}>
							<div class="grid gap-4 p-4">
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
								<div class="flex justify-between gap-2">
									<!-- <span class="text-sm text-muted-foreground">{q + 1}.</span> -->
									<div class="w-full space-y-1">
										<Field.Field>
											<Input bind:value={rule.name} placeholder="Rule name" />
										</Field.Field>
										<Field.Error>
											{error?.find((e) => e.path?.join('.') === [r, 'name'].join('.'))?.message}
										</Field.Error>
									</div>

									<Button
										type="button"
										variant="ghost"
										size="icon"
										class="text-destructive hover:bg-destructive/10 hover:text-destructive"
										onclick={() => {
											rule.isRemoved = true;
											rules?.filter((r) => !r.isRemoved)?.forEach((r, i) => (r.order = i + 1));
										}}
									>
										<TrashIcon class="size-4" />
									</Button>
									<Collapsible.Trigger class={buttonVariants({ variant: 'ghost', size: 'icon' })}>
										<ChevronsUpDownIcon />
									</Collapsible.Trigger>
								</div>

								<Field.Field>
									<Input bind:value={rule.nextPartId} placeholder="Next" />
									<Field.Error>
										{error?.find((e) => e.path?.join('.') === [r, 'nextPartId'].join('.'))?.message}
									</Field.Error>
								</Field.Field>
							</div>

							<Collapsible.Content>
								<Separator />

								<Field.Field class="p-4">
									<div class="flex items-center justify-between">
										<div>
											<Field.Label>Inputs</Field.Label>
											<Field.Error>
												{error?.find((e) => e.path?.join('.') === [r, 'inputs'].join('.'))?.message}
											</Field.Error>
										</div>
									</div>

									<div class="space-y-3">
										{#each rule.inputs as input, i (input.id)}
											<div
												class="flex gap-2 rounded-md border bg-card/50 p-3 transition-colors"
												class:hidden={input.isRemoved}
											>
												<div class="w-full space-y-1">
													<Field.Field>
														<Input
															bind:value={input.quizQuestionTemplateId}
															placeholder="Option label"
														/>
													</Field.Field>
													<Field.Error>
														{error?.find(
															(e) =>
																e.path?.join('.') ===
																[r, 'inputs', i, 'quizQuestionTemplateId'].join('.')
														)?.message}
													</Field.Error>
												</div>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													class="text-destructive hover:bg-destructive/10 hover:text-destructive"
													onclick={() => (input.isRemoved = true)}
												>
													<TrashIcon class="size-4" />
												</Button>
											</div>
										{/each}
										<Button
											type="button"
											variant="outline"
											size="sm"
											onclick={() => addRuleInput(rule)}
										>
											Add input
										</Button>
									</div>
								</Field.Field>

								<!-- <Field.Field class="block space-x-2">
											<div class="flex items-center space-x-2">
												<Switch id="required" />
												<Field.Label for="required" class="text-sm font-normal"
													>Required question</Field.Label
												>
											</div>
										</Field.Field> -->
							</Collapsible.Content>
						</Collapsible.Root>
					</Field.Set>
				{/each}

				<Button type="button" variant="outline" size="sm" onclick={addRule}>Add rule</Button>
			</div>
		</DragDropProvider>
		<!-- <Dialog.Footer>
			<Dialog.Close class={buttonVariants({ variant: 'outline' })}>Cancel</Dialog.Close>
			<Button type="submit" onclick={submit}>Save logic</Button>
		</Dialog.Footer> -->
	</Dialog.Content>
</form>
