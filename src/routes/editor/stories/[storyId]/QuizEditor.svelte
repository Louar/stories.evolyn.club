<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import LanguageSelector from '$lib/components/ui/language-selector/language-selector.svelte';
	import * as Select from '$lib/components/ui/select/index.js';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { Toggle } from '$lib/components/ui/toggle/index.js';
	import { TranslatableInput } from '$lib/components/ui/translatable-input';
	import type { findOneQuizById } from '$lib/db/repositories/2-stories-module';
	import { EDITORS } from '$lib/states/editors.svelte';
	import { moveArrayItem } from '$lib/utils';
	import { DragDropProvider } from '@dnd-kit-svelte/svelte';
	import { useSortable } from '@dnd-kit-svelte/svelte/sortable';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import DicesIcon from '@lucide/svelte/icons/dices';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import SquarePlusIcon from '@lucide/svelte/icons/square-plus';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import type { $ZodIssue } from 'zod/v4/core';

	type DragEndEvent = {
		operation: { source: { sortable: { index: number; initialIndex: number } | null } | null };
	};

	type Props = {
		storyId: string;
		close: (output: {
			action: 'persist' | 'delete';
			id?: string;
			quiz?: Awaited<ReturnType<typeof findOneQuizById>>;
		}) => void;
	};
	let { storyId, close }: Props = $props();

	let quizzes = $derived(EDITORS.quizzes);

	const defaultQuiz: (typeof quizzes)[number] = {
		id: 'new',
		name: '',
		doRandomize: false,
		questions: []
	};
	let quiz = $state(defaultQuiz);
	let error = $state<$ZodIssue[] | null>(null);

	const addQuestion = () => {
		quiz.questions?.push({
			id: `new-${crypto.randomUUID().toString().slice(0, 8)}`,
			answerTemplateReference: 'select-single',
			order: (quiz.questions?.length ?? 0) + 1,
			title: {},
			instruction: null,
			configuration: null,
			isRequired: true,
			answerOptions: [],
			answerGroup: {
				id: 'new',
				doRandomize: false
			},
			isRemoved: false // Front-end purposes
		});
	};

	const addAnswerOption = (question: (typeof quiz.questions)[number]) => {
		question.answerOptions.push({
			id: `new-${crypto.randomUUID().toString().slice(0, 8)}`,
			order: question.answerOptions.length + 1,
			value: '',
			label: {},
			isRemoved: false // Front-end purposes
		});
	};

	const handleQuestionDrag = (event: DragEndEvent) => {
		const sortable = event.operation.source?.sortable;
		if (!sortable) return;
		const questions = moveArrayItem(quiz.questions ?? [], sortable.initialIndex, sortable.index);
		questions?.filter((q) => !q.isRemoved)?.forEach((q, i) => (q.order = i + 1)) ?? [];
		quiz.questions = questions;
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
		options?.filter((o) => !o.isRemoved)?.forEach((o, i) => (o.order = i + 1)) ?? [];
		question.answerOptions = options;
	};

	const persist = async (event: Event) => {
		event.preventDefault();

		const result = await fetch(`/api/stories/${storyId}/quizzes/${quiz.id ?? 'new'}/questions`, {
			method: 'POST',
			body: JSON.stringify(quiz)
		});

		if (!result.ok) {
			error = await result.json();
		} else {
			error = null;
			close({ action: 'persist', quiz: await result.json() });
		}
	};
	const remove = async () => {
		if (!quiz.id?.length) return;
		const result = await fetch(`/api/stories/${storyId}/quizzes/${quiz.id}/questions`, {
			method: 'DELETE'
		});
		if (!result.ok) error = await result.json();
		else {
			close({ action: 'delete', id: quiz.id });
			quiz = defaultQuiz;
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
				<div class="flex w-full items-center gap-2">
					{#if quizzes && quizzes.length > 0}
						<Dialog.Title>Edit:</Dialog.Title>
						<div>
							<Select.Root
								type="single"
								value={quiz.id ?? 'none'}
								onValueChange={(value) =>
									(quiz = quizzes.find((q) => q.id === value) ?? defaultQuiz)}
							>
								<Select.Trigger
									class="min-w-40 {quizzes.find((q) => quiz.id && q.id === quiz.id)
										? ''
										: 'text-muted-foreground'}"
								>
									{quizzes.find((q) => quiz.id && q.id === quiz.id)?.name ?? 'Select a quiz...'}
								</Select.Trigger>
								<Select.Content align="start">
									<Select.Group>
										<!-- <Select.GroupHeading>Quizzes</Select.GroupHeading> -->
										{#each quizzes as item}
											<Select.Item class="block" value={item.id}>
												<p>{item.name}</p>
												<p class="text-xs text-muted-foreground">
													{item?.questions?.length ?? 0} questions
												</p>
											</Select.Item>
										{/each}
									</Select.Group>
								</Select.Content>
							</Select.Root>
						</div>
						<Separator orientation="vertical" class="mr-2 ml-4" />
					{/if}
					<Toggle
						size="default"
						variant="default"
						class="bg-card! {quiz?.id === 'new'
							? 'text-blue-600! *:[svg]:fill-blue-100! *:[svg]:stroke-blue-500!'
							: ''}"
						onclick={() => (quiz = defaultQuiz)}
					>
						<SquarePlusIcon />
						New
					</Toggle>
				</div>

				<div class="flex gap-2">
					<LanguageSelector />
					<Dialog.Close class={buttonVariants({ variant: 'outline' })}>Cancel</Dialog.Close>
					<Button type="submit" onclick={persist}>Save quiz</Button>
				</div>
			</div>

			<Separator class="mt-4" />
		</Dialog.Header>

		<div class="grid gap-4 rounded-lg border bg-accent p-4">
			<div class="flex items-center justify-between">
				<div class="w-full">
					<Field.Label>Quiz</Field.Label>
					<Field.Error>
						{error?.find((e) => e.path?.join('.') === ['questions'].join('.'))?.message}
					</Field.Error>
				</div>
				{#if quiz.id && quiz.id !== 'new'}
					<Button variant="destructive" size="sm" onclick={remove}>Delete quiz</Button>
				{/if}
			</div>
			<div class="flex gap-4">
				<div class="w-full space-y-1">
					<Field.Field>
						<Input bind:value={quiz.name} placeholder="Quiz name" />
					</Field.Field>
					<Field.Error>
						{error?.find((e) => e.path?.join('.') === ['name'].join('.'))?.message}
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
				{#each quiz.questions as question, q (question.id)}
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
											{error?.find((e) => e.path?.join('.') === ['questions', q, 'title'].join('.'))
												?.message}
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
											{#each question.answerOptions as option, o (option.id)}
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

				<Button type="button" variant="outline" size="sm" onclick={addQuestion}>Add Question</Button
				>
			</div>
		</DragDropProvider>
		<!-- <Dialog.Footer>
			<Dialog.Close class={buttonVariants({ variant: 'outline' })}>Cancel</Dialog.Close>
			<Button type="submit" onclick={submit}>Save Quiz</Button>
		</Dialog.Footer> -->
	</Dialog.Content>
</form>
