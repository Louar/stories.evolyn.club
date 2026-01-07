<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { Toggle } from '$lib/components/ui/toggle/index.js';
	import type { findOneStoryById } from '$lib/db/repositories/2-stories-module';
	import { DragDropProvider } from '@dnd-kit-svelte/svelte';
	import { useSortable } from '@dnd-kit-svelte/svelte/sortable';
	import Dices from '@lucide/svelte/icons/dices';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import Trash from '@lucide/svelte/icons/trash-2';

	type Props = {
		quizzes: Awaited<ReturnType<typeof findOneStoryById>>['quizzes'];
	};
	let { quizzes }: Props = $props();

	// Initialize quiz from quizzes prop or use default
	const defaultQuiz: (typeof quizzes)[number] = {
		id: 'new',
		name: '',
		doRandomize: false,
		questions: []
	};
	let quiz = $state(quizzes?.length ? quizzes[0] : defaultQuiz);

	const addQuestion = () => {
		quiz?.questions?.push({
			id: 'new',
			answerTemplateReference: 'select-single',
			order: (quiz?.questions?.length ?? 0) + 1,
			title: '',
			instruction: null,
			configuration: null,
			isRequired: true,
			answerOptions: [],
			answerGroup: {
				doRandomize: false
			}
		});
	};

	const addAnswerOption = (q: number) => {
		const question = quiz?.questions?.[q];
		question?.answerOptions.push({
			id: 'new',
			order: question.answerOptions.length + 1,
			value: '',
			label: ''
		});
	};

	const handleQuestionDrag = (event: any) => {
		const { active, over } = event;
		if (quiz?.questions?.length && over && active && active.id !== over.id) {
			const i = quiz?.questions?.findIndex((q) => q.id === active.id) ?? -1;
			const j = quiz?.questions?.findIndex((q) => q.id === over.id) ?? -1;
			if (i !== -1 && j !== -1) {
				const questions = moveArrayItem(quiz?.questions ?? [], i, j);
				questions.forEach((question, index) => (question.order = index + 1));
				quiz.questions = questions;
			}
		}
	};
	const handleAnswerOptionDrag = (event: any, q: number) => {
		const { active, over } = event;
		if (quiz?.questions?.length && over && active && active.id !== over.id) {
			const question = quiz?.questions?.[q];
			const i = question?.answerOptions.findIndex((o) => o.id === active.id) ?? -1;
			const j = question?.answerOptions.findIndex((o) => o.id === over.id) ?? -1;
			if (i !== -1 && j !== -1) {
				const newAnswerOptions = moveArrayItem(question?.answerOptions ?? [], i, j);
				newAnswerOptions.forEach((option, index) => (option.order = index + 1));
				quiz.questions[q].answerOptions = newAnswerOptions;
			}
		}
	};

	// Helper function to reorder array
	const moveArrayItem = <T,>(array: T[], fromIndex: number, to: number): T[] => {
		const newArray = [...array];
		const [removed] = newArray.splice(fromIndex, 1);
		newArray.splice(to, 0, removed);
		return newArray;
	};

	const submit = async (event: Event) => {
		event.preventDefault();

		const result = await fetch(`/api/quizzes/${quiz?.id ?? 'new'}/questions`, {
			method: 'POST',
			body: JSON.stringify(quiz)
		});

		if (!result.ok) {
			console.error('Validation errors:', result.statusText);
			// TODO: Display errors
		}
	};
</script>

<form onsubmit={submit}>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-200">
		<Dialog.Header>
			<Dialog.Title>Configure Quiz</Dialog.Title>
			<Dialog.Description>Add questions and answer options to your quiz.</Dialog.Description>

			<!-- Quiz Selection Dropdown -->
			{#if quizzes && quizzes.length > 0}
				<div class="mt-4">
					<Select.Root
						type="single"
						value={quiz?.id ?? 'none'}
						onValueChange={(value) => (quiz = quizzes.find((q) => q.id === value) ?? defaultQuiz)}
					>
						<Select.Trigger>
							{quizzes.find((q) => quiz?.id && q.id === quiz.id)?.name ?? 'Select a quiz...'}
						</Select.Trigger>
						<Select.Content>
							<Select.Group>
								<Select.GroupHeading>Quizzes</Select.GroupHeading>
								{#each quizzes as item}
									<Select.Item value={item.id}>
										{item.name} ({item?.questions?.length ?? 0} questions)
									</Select.Item>
								{/each}
							</Select.Group>
						</Select.Content>
					</Select.Root>
				</div>
			{/if}
		</Dialog.Header>

		<div class="grid gap-2 rounded-lg border bg-card p-4">
			<Field.Label>Quiz</Field.Label>
			<div class="flex gap-4">
				<Field.Field>
					<Input bind:value={quiz.name} placeholder="Enter your question" />
				</Field.Field>
				<Field.Field class="flex-1">
					<Toggle
						size="default"
						variant="outline"
						class="data-[state=on]:bg-transparent data-[state=on]:text-blue-600 data-[state=on]:*:[svg]:fill-blue-100 data-[state=on]:*:[svg]:stroke-blue-500"
						bind:pressed={quiz.doRandomize}
					>
						<Dices />
						Randomize
					</Toggle>
				</Field.Field>
			</div>
		</div>

		<DragDropProvider onDragEnd={handleQuestionDrag}>
			<div class="grid gap-4">
				{#each quiz?.questions as question, q (question.id)}
					{@const { ref, handleRef } = useSortable({
						id: question.id,
						index: q
					})}
					<Field.Set
						class="grid cursor-move gap-0 rounded-lg border bg-card/50 backdrop-blur-md"
						{@attach ref}
					>
						<div class="grid gap-0 p-4">
							<Field.Label>Question</Field.Label>
							<div class="flex items-center justify-between gap-2 p-4 transition-colors">
								<GripVertical
									class="size-6 cursor-move text-muted-foreground"
									{@attach handleRef}
								/>
								<!-- <span class="text-sm text-muted-foreground">{q + 1}.</span> -->
								<Input bind:value={question.title} placeholder="Enter your question" />

								<Button
									type="button"
									variant="ghost"
									size="icon"
									class="text-destructive hover:bg-destructive/10 hover:text-destructive"
									onclick={() => {
										quiz?.questions?.splice(q, 1);
										// Update order for remaining questions
										quiz?.questions?.forEach((q, i) => (q.order = i + 1));
									}}
								>
									<Trash class="size-4" />
								</Button>
							</div>
						</div>

						<Separator />

						<Field.Field class="p-4">
							<div class="flex items-center justify-between">
								<Field.Label>Answer options</Field.Label>
								{#if question.answerGroup}
									<Toggle
										size="sm"
										variant="outline"
										class="data-[state=on]:bg-transparent data-[state=on]:*:[svg]:fill-blue-100 data-[state=on]:*:[svg]:stroke-blue-500"
										bind:pressed={question.answerGroup.doRandomize}
									>
										<Dices />
									</Toggle>
								{/if}
							</div>

							<DragDropProvider onDragEnd={(event) => handleAnswerOptionDrag(event, q)}>
								<div class="space-y-3">
									{#each question.answerOptions as option, o (option.id)}
										{@const { ref, handleRef, isDragging, isDropTarget } = useSortable({
											id: option.id,
											index: o
										})}
										<div
											class="flex items-center gap-2 rounded-md border bg-card/50 p-3 transition-colors"
											class:bg-muted={isDragging.current}
											class:bg-accent={isDropTarget.current}
											{@attach ref}
										>
											<GripVertical
												class="size-5 cursor-move text-muted-foreground"
												{@attach handleRef}
											/>
											<!-- class:opacity-50={sortable.isDragging} -->
											<div class="grid flex-1 gap-2">
												<Input bind:value={option.label} placeholder="Option label" />
												<!-- <Input bind:value={option.value} placeholder="Option value (JSON string)" /> -->
											</div>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												class="text-destructive hover:bg-destructive/10 hover:text-destructive"
												onclick={() => {
													question.answerOptions.splice(o, 1);
													question.answerOptions.forEach(
														(option, index) => (option.order = index + 1)
													);
												}}
											>
												<Trash class="size-4" />
											</Button>
										</div>
									{/each}
									<Button
										type="button"
										variant="outline"
										size="sm"
										onclick={() => addAnswerOption(q)}
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
					</Field.Set>
				{/each}

				<Button type="button" variant="outline" size="sm" onclick={addQuestion}>Add Question</Button
				>
			</div>
		</DragDropProvider>
		<Dialog.Footer>
			<Dialog.Close class={buttonVariants({ variant: 'outline' })}>Cancel</Dialog.Close>
			<Button type="submit">Save Quiz</Button>
		</Dialog.Footer>
	</Dialog.Content>
</form>
