<script lang="ts">
	import HeaderBlank from '$lib/components/app/header/app-header-blank.svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { Toggle } from '$lib/components/ui/toggle/index.js';
	import { TranslatableInput } from '$lib/components/ui/translatable-input';
	import type { findOneQuizById } from '$lib/db/repositories/2-story-module';
	import { formatFormError, translateLocalizedField } from '$lib/db/schemas/0-utils';
	import { EDITORS } from '$lib/states/editors.svelte';
	import { moveArrayItem } from '$lib/utils';
	import { DragDropProvider } from '@dnd-kit-svelte/svelte';
	import { useSortable } from '@dnd-kit-svelte/svelte/sortable';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import DicesIcon from '@lucide/svelte/icons/dices';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import XIcon from '@lucide/svelte/icons/x';
	import { onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type { $ZodIssue } from 'zod/v4/core';

	type DragEndEvent = {
		operation: { source: { sortable: { index: number; initialIndex: number } | null } | null };
	};

	type Props = {
		storyId: string;
		selectedId?: string;
		close: (output: {
			action: 'persist' | 'delete' | 'close';
			id?: string;
			quiz?: Awaited<ReturnType<typeof findOneQuizById>>;
			keepOpen?: boolean;
		}) => void;
	};
	let { storyId, selectedId, close }: Props = $props();

	const createDefaultQuiz = (): (typeof EDITORS.quizzes)[number] => ({
		id: 'new',
		name: '',
		doRandomize: false,
		questions: []
	});
	const cloneQuiz = (value: (typeof EDITORS.quizzes)[number]) =>
		structuredClone($state.snapshot(value));
	// svelte-ignore state_referenced_locally
	let quiz = $state(
		selectedId
			? cloneQuiz(EDITORS.quizzes.find((item) => item.id === selectedId) ?? createDefaultQuiz())
			: createDefaultQuiz()
	);
	let error = $state<$ZodIssue[] | null>(null);
	let saveState = $state<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
	let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
	let saveVersion = 0;

	const scheduleAutosave = () => {
		saveVersion += 1;
		saveState = 'dirty';
		clearTimeout(autosaveTimer);
		autosaveTimer = setTimeout(() => persist(undefined, true), 700);
	};
	onDestroy(() => {
		clearTimeout(autosaveTimer);
		if (saveState === 'dirty') void persist(undefined, true);
	});

	const addQuestion = () => {
		quiz.questions?.push({
			id: `new-${crypto.randomUUID().toString().slice(0, 8)}`,
			answerTemplateSlug: 'select-single',
			order: (quiz.questions?.length ?? 0) + 1,
			title: {},
			instruction: null,
			configuration: null,
			isRequired: true,
			answerOptions: [],
			answerGroup: {
				id: 'new',
				slug: '',
				doRandomize: false
			},
			isRemoved: false // Front-end purposes
		});
		scheduleAutosave();
	};

	const addAnswerOption = (question: (typeof quiz.questions)[number]) => {
		question.answerOptions.push({
			id: `new-${crypto.randomUUID().toString().slice(0, 8)}`,
			order: question.answerOptions.length + 1,
			value: '',
			label: {},
			isRemoved: false // Front-end purposes
		});
		scheduleAutosave();
	};

	const handleQuestionDrag = (event: DragEndEvent) => {
		const sortable = event.operation.source?.sortable;
		if (!sortable) return;
		const questions = moveArrayItem(quiz.questions ?? [], sortable.initialIndex, sortable.index);
		questions?.filter((q) => !q.isRemoved)?.forEach((q, i) => (q.order = i + 1));
		quiz.questions = questions;
		scheduleAutosave();
	};
	const handleAnswerOptionDrag = (
		event: DragEndEvent,
		question: (typeof quiz.questions)[number]
	) => {
		const sortable = event.operation.source?.sortable;
		if (!sortable) return;
		const options = moveArrayItem(
			question.answerOptions ?? [],
			sortable.initialIndex,
			sortable.index
		);
		options?.filter((o) => !o.isRemoved)?.forEach((o, i) => (o.order = i + 1));
		question.answerOptions = options;
		scheduleAutosave();
	};
	const mergeSavedIds = (saved: NonNullable<Awaited<ReturnType<typeof findOneQuizById>>>) => {
		quiz.id = saved.id;
		const questions = quiz.questions.filter((question) => !question.isRemoved);
		const savedQuestions = [...saved.questions].sort((a, b) => a.order - b.order);

		for (const [index, question] of questions.entries()) {
			const savedQuestion = savedQuestions[index];
			if (!savedQuestion) continue;

			question.id = savedQuestion.id;
			if (question.answerGroup && savedQuestion.answerGroup) {
				question.answerGroup.id = savedQuestion.answerGroup.id;
			}

			const options = question.answerOptions.filter((option) => !option.isRemoved);
			const savedOptions = [...savedQuestion.answerOptions].sort((a, b) => a.order - b.order);
			for (const [optionIndex, option] of options.entries()) {
				const savedOption = savedOptions[optionIndex];
				if (savedOption) option.id = savedOption.id;
			}
		}
	};

	const persist = async (event?: Event, autosave = false) => {
		event?.preventDefault();
		clearTimeout(autosaveTimer);
		const version = ++saveVersion;
		saveState = 'saving';

		for (const question of quiz.questions) {
			if (!question.answerOptions?.length) continue;
			for (const option of question.answerOptions) {
				const value = translateLocalizedField(option.label, 'default');
				if (value?.length) option.value = value;
			}
		}

		const request = (async () => {
			const result = await fetch(`/api/stories/${storyId}/quizzes/${quiz.id ?? 'new'}/questions`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(quiz)
			});
			if (!result.ok) {
				if (result.status === 422) error = await result.json();
				throw new Error('Saving quiz failed');
			}
			return await result.json();
		})();
		toast.promise(request, {
			loading: 'Saving quiz...',
			success: 'Quiz saved',
			error: 'Could not save quiz'
		});
		try {
			const saved = await request;
			if (version !== saveVersion) {
				if (quiz.id === 'new') quiz.id = saved.id;
				close({ action: 'persist', quiz: saved, keepOpen: true });
				return;
			}
			error = null;
			saveState = 'saved';
			if (autosave) mergeSavedIds(saved);
			else quiz = cloneQuiz(saved);
			close({ action: 'persist', quiz: saved, keepOpen: autosave });
		} catch {
			if (version === saveVersion) saveState = 'error';
		}
	};
	const remove = async () => {
		if (!quiz.id?.length) return;
		const result = await fetch(`/api/stories/${storyId}/quizzes/${quiz.id}/questions`, {
			method: 'DELETE'
		});
		if (!result.ok) {
			toast.error(result.statusText ?? 'Something went wrong', {
				closeButton: true,
				duration: Infinity
			});
			if (result.status === 422) error = await result.json();
		} else {
			close({ action: 'delete', id: quiz.id });
			quiz = createDefaultQuiz();
		}
	};
	const dismiss = () => close({ action: 'close' });
</script>

<div class="muted-scrollbar">
	<HeaderBlank class="w-full">
		<div class="px-2">
			<h1 class="truncate overflow-hidden text-sm whitespace-nowrap">
				{quiz.id === 'new' ? 'New quiz' : 'Edit quiz'}
			</h1>
			<p class="self-center text-xs text-muted-foreground" aria-live="polite">
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
		</div>
		<div class="ml-auto flex items-center gap-2">
			{#if quiz.id && quiz.id !== 'new'}
				<Button variant="destructive" size="icon" onclick={remove}><TrashIcon /></Button>
			{/if}
			<Button variant="ghost" size="icon" onclick={dismiss}><XIcon /></Button>
		</div>
	</HeaderBlank>
	<form class="block p-4" onsubmit={persist} oninput={scheduleAutosave} onchange={scheduleAutosave}>
		<div class="mb-4 grid gap-4 rounded-lg border bg-accent p-4">
			<div class="flex items-center justify-between">
				<div class="w-full">
					<Field.Label>Quiz</Field.Label>
					<Field.Error>
						{formatFormError(error, `questions`)}
					</Field.Error>
				</div>
			</div>
			<div class="flex gap-4">
				<div class="w-full space-y-1">
					<Field.Field>
						<Input bind:value={quiz.name} placeholder="Quiz name" />
					</Field.Field>
					<Field.Error>
						{formatFormError(error, `name`)}
					</Field.Error>
				</div>
				<Field.Field class="flex-1">
					<Toggle
						size="default"
						variant="outline"
						class="bg-card! data-[state=on]:text-blue-600 data-[state=on]:*:[svg]:fill-blue-100 data-[state=on]:*:[svg]:stroke-blue-500"
						bind:pressed={quiz.doRandomize}
					>
						<DicesIcon />
						Randomize
					</Toggle>
				</Field.Field>
			</div>
		</div>

		<DragDropProvider onDragEnd={(event) => handleQuestionDrag(event as DragEndEvent)}>
			<div class="grid gap-4">
				{#each quiz.questions as question, q (question)}
					{@const { ref, handleRef } = useSortable({
						id: question.id,
						index: q
					})}
					<Field.Set
						class="grid gap-0 rounded-lg border bg-card/50 backdrop-blur-md {question.isRemoved
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
									<Field.Label>Question {question.order}</Field.Label>
								</div>
								<div class="flex justify-between gap-2">
									<!-- <span class="text-sm text-muted-foreground">{q + 1}.</span> -->
									<div class="w-full space-y-1">
										<Field.Field>
											<TranslatableInput
												bind:value={question.title}
												placeholder="Enter your question"
											/>
										</Field.Field>
										<Field.Error>
											{formatFormError(error, `questions.${q}.title.*`)}
										</Field.Error>
									</div>

									<Button
										type="button"
										variant="ghost"
										size="icon"
										class="text-destructive hover:bg-destructive/10 hover:text-destructive"
										onclick={() => {
											question.isRemoved = true;
											quiz.questions
												?.filter((q) => !q.isRemoved)
												?.forEach((q, i) => (q.order = i + 1));
											scheduleAutosave();
										}}
									>
										<TrashIcon class="size-4" />
									</Button>
									<Collapsible.Trigger class={buttonVariants({ variant: 'ghost', size: 'icon' })}>
										<ChevronsUpDownIcon />
									</Collapsible.Trigger>
								</div>
							</div>

							<Collapsible.Content>
								<Separator />

								<Field.Field class="p-4">
									<div class="flex items-center justify-between">
										<div>
											<Field.Label>Answer options</Field.Label>
											<Field.Error>
												{error?.find(
													(e) => e.path?.join('.') === ['questions', q, 'answerOptions'].join('.')
												)?.message}
											</Field.Error>
										</div>
										{#if question.answerGroup}
											<Toggle
												size="sm"
												variant="outline"
												class="data-[state=on]:bg-transparent data-[state=on]:*:[svg]:fill-blue-100 data-[state=on]:*:[svg]:stroke-blue-500"
												bind:pressed={question.answerGroup.doRandomize}
											>
												<DicesIcon />
											</Toggle>
										{/if}
									</div>

									<DragDropProvider
										onDragEnd={(event) => handleAnswerOptionDrag(event as DragEndEvent, question)}
									>
										<div class="space-y-3">
											{#each question.answerOptions as option, o (option)}
												{@const { ref, handleRef, isDragging, isDropTarget } = useSortable({
													id: option.id,
													index: o
												})}
												<div
													class="flex gap-2 rounded-md border bg-card/50 p-3 transition-colors"
													class:bg-muted={isDragging.current}
													class:bg-accent={isDropTarget.current}
													class:hidden={option.isRemoved}
													{@attach ref}
												>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														class="cursor-move"
														{@attach handleRef}
													>
														<GripVerticalIcon />
													</Button>
													<div class="w-full space-y-1">
														<Field.Field>
															<TranslatableInput
																bind:value={option.label}
																placeholder="Option label"
															/>
														</Field.Field>
														<Field.Error>
															{error?.find(
																(e) =>
																	e.path?.join('.') ===
																	['questions', q, 'answerOptions', o, 'label'].join('.')
															)?.message}
														</Field.Error>
													</div>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														class="text-destructive hover:bg-destructive/10 hover:text-destructive"
														onclick={() => {
															option.isRemoved = true;
															question.answerOptions
																?.filter((o) => !o.isRemoved)
																?.forEach((o, i) => (o.order = i + 1));
															scheduleAutosave();
														}}
													>
														<TrashIcon class="size-4" />
													</Button>
												</div>
											{/each}
											<Button
												type="button"
												variant="outline"
												size="sm"
												onclick={() => addAnswerOption(question)}
											>
												Add Option
											</Button>
										</div>
									</DragDropProvider>
								</Field.Field>
							</Collapsible.Content>
						</Collapsible.Root>
					</Field.Set>
				{/each}

				<Button type="button" variant="outline" size="sm" onclick={addQuestion}>Add Question</Button
				>
			</div>
		</DragDropProvider>
		<!-- <Dialog.Footer>
			<Dialog.Close class={buttonVariants({ variant: 'outline' })}>Cancel</Dialog.Close>
			<Button type="submit" onclick={submit}>Save Quiz</Button>
		</Dialog.Footer> -->
	</form>
</div>
