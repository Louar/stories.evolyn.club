<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { DragDropProvider } from '@dnd-kit-svelte/svelte';
	import { useSortable } from '@dnd-kit-svelte/svelte/sortable';
	import { z } from 'zod/v4';

	const answerOptionSchema = z.object({
		order: z.number(),
		value: z.string(),
		label: z.string(),
		isCorrect: z.boolean().default(false)
	});

	const questionSchema = z.object({
		widget: z.literal('select-single'),
		order: z.number(),
		description: z.string().min(1, 'Description is required'),
		isRequired: z.boolean().default(true),
		answerOptions: z.array(answerOptionSchema).min(1, 'At least one answer option is required'),
		answerGroup: z.object({ doRandomize: z.boolean() }).optional()
	});

	const quizSchema = z.array(questionSchema).min(1, 'At least one question is required');

	let quiz = $state([
		{
			widget: 'select-single',
			order: 1,
			description: 'Are you ready?',
			isRequired: true,
			answerOptions: [
				{
					order: 1,
					value: JSON.stringify(1),
					label: 'Yes',
					isCorrect: true
				},
				{
					order: 2,
					value: JSON.stringify(0),
					label: 'No',
					isCorrect: false
				}
			]
		},
		{
			widget: 'select-single',
			order: 2,
			description: 'Are you sure?',
			isRequired: true,
			answerOptions: [
				{
					order: 1,
					value: JSON.stringify('YES'),
					label: 'Yes',
					isCorrect: true
				},
				{
					order: 2,
					value: JSON.stringify('NO'),
					label: 'No',
					isCorrect: false
				}
			]
		}
	]);

	function addQuestion() {
		quiz.push({
			widget: 'select-single',
			order: quiz.length + 1,
			description: '',
			isRequired: true,
			answerOptions: []
		});
	}

	function addOption(qIndex: number) {
		const question = quiz[qIndex];
		question.answerOptions.push({
			order: question.answerOptions.length + 1,
			value: '',
			label: '',
			isCorrect: false
		});
	}

	// Helper function to reorder array
	function moveArrayItem<T>(array: T[], fromIndex: number, toIndex: number): T[] {
		const newArray = [...array];
		const [removed] = newArray.splice(fromIndex, 1);
		newArray.splice(toIndex, 0, removed);
		return newArray;
	}

	// Handle drag end for questions
	function handleQuestionDragEnd(event: any) {
		const { active, over } = event;

		if (over && active && active.id !== over.id) {
			const oldIndex = quiz.findIndex((item) => item.order.toString() === active.id);
			const newIndex = quiz.findIndex((item) => item.order.toString() === over.id);

			if (oldIndex !== -1 && newIndex !== -1) {
				// Reorder the array
				const newQuiz = moveArrayItem(quiz, oldIndex, newIndex);

				// Update the order property for each question
				newQuiz.forEach((question: any, index: number) => {
					question.order = index + 1;
				});

				// Update the quiz
				quiz = newQuiz;
			}
		}
	}

	// Handle drag end for answer options
	function handleDragEnd(event: any, qIndex: number) {
		const { active, over } = event;

		if (over && active && active.id !== over.id) {
			const question = quiz[qIndex];
			const oldIndex = question.answerOptions.findIndex(
				(item) => item.order.toString() === active.id
			);
			const newIndex = question.answerOptions.findIndex(
				(item) => item.order.toString() === over.id
			);

			if (oldIndex !== -1 && newIndex !== -1) {
				// Reorder the array
				const newAnswerOptions = moveArrayItem(question.answerOptions, oldIndex, newIndex);

				// Update the order property for each option
				newAnswerOptions.forEach((option: any, index: number) => {
					option.order = index + 1;
				});

				// Update the question's answer options
				quiz[qIndex].answerOptions = newAnswerOptions;
			}
		}
	}

	function handleSubmit(event: Event) {
		event.preventDefault();
		const result = quizSchema.safeParse(quiz);
		if (result.success) {
			// TODO: Save the quiz to the node data or wherever
			console.log('Quiz saved:', result.data);
		} else {
			console.error('Validation errors:', result.error.issues);
			// TODO: Display errors
		}
	}
</script>

<form onsubmit={handleSubmit}>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-200">
		<Dialog.Header>
			<Dialog.Title>Configure Quiz</Dialog.Title>
			<Dialog.Description>Add questions and answer options to your quiz.</Dialog.Description>
		</Dialog.Header>
		<DragDropProvider onDragEnd={handleQuestionDragEnd}>
			<div class="grid gap-6">
				{#each quiz as question, qIndex (question.order)}
					{@const questionSortable = useSortable({
						id: question.order.toString(),
						index: qIndex
					})}
					<Field.Set
						class="grid cursor-move gap-4 rounded-lg border bg-card p-4"
						{@attach questionSortable.ref}
					>
						<div class="flex items-center justify-between">
							<Field.Title class="text-base font-medium">Question {question.order}</Field.Title>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onclick={() => {
									quiz.splice(qIndex, 1);
									// Update order for remaining questions
									quiz.forEach((q, i) => (q.order = i + 1));
								}}
							>
								Remove
							</Button>
						</div>

						<Field.Field>
							<Field.Label>Description</Field.Label>
							<Input bind:value={question.description} placeholder="Enter your question" />
							<!-- <Field.Error>Enter the question text</Field.Error> -->
						</Field.Field>

						<Field.Field>
							<Field.Label>Answer Options</Field.Label>
							<DragDropProvider onDragEnd={(event) => handleDragEnd(event, qIndex)}>
								<div class="space-y-3">
									{#each question.answerOptions as option, oIndex (option.order)}
										{@const sortable = useSortable({
											id: option.order.toString(),
											index: oIndex
										})}
										<div
											class="flex cursor-move items-start gap-2 rounded-md border bg-card p-3 transition-colors hover:bg-muted"
											{@attach sortable.ref}
										>
											<!-- class:opacity-50={sortable.isDragging} -->
											<div class="grid flex-1 gap-2">
												<Input bind:value={option.label} placeholder="Option label" />
												<Input bind:value={option.value} placeholder="Option value (JSON string)" />
												<div class="flex items-center space-x-2">
													<Switch
														bind:checked={option.isCorrect}
														id={`correct-${qIndex}-${oIndex}`}
													/>
													<Field.Label
														for={`correct-${qIndex}-${oIndex}`}
														class="text-sm font-normal"
													>
														Correct answer
													</Field.Label>
												</div>
											</div>
											<Button
												type="button"
												variant="outline"
												size="sm"
												onclick={() => {
													question.answerOptions.splice(oIndex, 1);
													// Update order for remaining options
													question.answerOptions.forEach((option, index) => {
														option.order = index + 1;
													});
												}}
											>
												×
											</Button>
										</div>
									{/each}
									<Button
										type="button"
										variant="outline"
										size="sm"
										onclick={() => addOption(qIndex)}
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
