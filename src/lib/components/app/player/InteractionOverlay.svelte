<script lang="ts">
	import { Label } from '$lib/components/ui/label/index.js';
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import type { findOneStoryByReference } from '$lib/db/repositories/2-stories-module';
	import { cn } from '$lib/utils';
	import type { ClassValue } from 'clsx';
	import { fade, fly } from 'svelte/transition';
	import type { InputFromLogic, Logic } from './types';

	type Props = {
		partId: string;

		questions: Extract<
			NonNullable<
				Awaited<ReturnType<typeof findOneStoryByReference>>
			>['parts'][number]['foreground'],
			{ questions: unknown }
		>['questions'];

		logic: Logic | undefined;

		submit: (logic: Logic | undefined, input: InputFromLogic<Logic>) => void;

		oninteraction: (args: {
			quizQuestionTemplate: (typeof questions)[number];
			quizQuestionTemplateAnswerItemId: string | null;
			value: unknown;
			raw_value: unknown;
		}) => void;

		class?: ClassValue | null | undefined;
	};
	let {
		partId,
		questions,
		logic,

		submit,
		oninteraction,

		class: className
	}: Props = $props();

	let i = $state(0);
	let input: InputFromLogic<Logic> = $state({});

	const next = async () => {
		if (!questions?.length || i === -1) return;

		if (i < questions?.length - 1) i++;
		else {
			i = -1;
			await new Promise((resolve) => setTimeout(resolve, 250));
			submit(logic, input);
		}
	};

	const set = (
		quizQuestionTemplate: (typeof questions)[number],
		raw: string,
		quizQuestionTemplateAnswerItemId: string | null
	) => {
		let raw_value: unknown;
		try {
			raw_value = JSON.parse(raw);
		} catch {
			return false;
		}

		if (partId?.length) {
			oninteraction({
				quizQuestionTemplate,
				quizQuestionTemplateAnswerItemId,
				value: quizQuestionTemplateAnswerItemId ? null : raw_value,
				raw_value
			});
		}

		input[quizQuestionTemplate.id] = raw_value;
	};
</script>

<div class="absolute inset-0 z-20 bg-black/20 backdrop-blur-md" in:fade={{ duration: 250 }}></div>
{#each questions as question, ii (question.id)}
	{#if i === ii}
		<div
			class={cn(
				'scrollbar-none absolute inset-0 z-30 flex overflow-y-auto p-8 text-white md:py-20',
				className
			)}
		>
			<div class="mx-auto mt-auto flex min-h-min w-full max-w-sm flex-col gap-4">
				<div
					in:fly|global={{
						y: 20,
						duration: 250,
						delay: ii === 0 ? 250 : 500
					}}
					out:fly|global={{
						y: 20,
						duration: 250
					}}
				>
					{#if question.title?.length}
						<h3 class="text-lg font-medium md:text-2xl">
							{question.title}
						</h3>
					{/if}
				</div>

				{#if question.answerTemplateReference === 'select-single'}
					{@const answerOptions = question.answerGroup?.doRandomize
						? question.answerOptions?.sort(() => Math.random() - 0.5)
						: question.answerOptions}
					<RadioGroup.Root
						class="gap-2"
						onValueChange={(value) => {
							const matched = answerOptions?.find((answerOption) => answerOption.value === value);
							set(question, value, matched?.id ?? null);
							next();
						}}
					>
						{#each answerOptions as answerOption, jj (answerOption.id)}
							<div
								in:fly|global={{
									y: 20,
									duration: 250,
									delay: (ii === 0 ? 250 : 500) + jj * 150
								}}
								out:fly|global={{
									y: 20,
									duration: 250,
									delay: ii === questions.length - 1 ? 0 : jj * 150
								}}
							>
								<Label
									class="m-0 cursor-pointer rounded-xl bg-black/80 p-3 text-lg font-medium transition-colors hover:bg-black md:text-xl"
								>
									<RadioGroup.Item value={answerOption.value} class="hidden" />
									{answerOption.label}
								</Label>
							</div>
						{/each}
					</RadioGroup.Root>
				{:else}
					<div class="flex flex-col gap-2"></div>
				{/if}
			</div>
		</div>
	{/if}
{/each}
