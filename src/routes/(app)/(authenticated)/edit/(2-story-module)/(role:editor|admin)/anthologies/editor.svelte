<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import { CopyButton } from '$lib/components/ui/copy-button';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { Switch } from '$lib/components/ui/switch';
	import { TranslatableInput } from '$lib/components/ui/translatable-input';
	import { useSubmissionState } from '$lib/hooks/use-submission-state.svelte.js';
	import { moveArrayItem } from '$lib/utils';
	import { DragDropProvider } from '@dnd-kit-svelte/svelte';
	import { useSortable } from '@dnd-kit-svelte/svelte/sortable';
	import CheckIcon from '@lucide/svelte/icons/check';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { tick } from 'svelte';
	import { z } from 'zod/v4';
	import type { ActionData, PageData } from './$types';
	import { anthologySchema } from './schemas';

	type Anthology = PageData['anthologies'][number];
	type AnthologyFormValues = z.infer<typeof anthologySchema>;
	type UpsertActionData = Extract<NonNullable<ActionData>, { form: 'upsert' }>;
	type Props = {
		data: PageData;
		isEditorOpen: boolean;
		anthology: Anthology | undefined;
	};
	let { data, isEditorOpen = $bindable(true), anthology = $bindable() }: Props = $props();
	const input: AnthologyFormValues = {
		id: anthology?.id ?? null,
		slug: anthology?.slug ?? '',
		nameRaw: anthology?.nameRaw ?? {},
		isPublished: anthology?.isPublished ?? false,
		isPublic: anthology?.isPublic ?? true,
		positions: anthology?.positions.map((position) => ({ ...position, isRemoved: false })) ?? []
	};
	let fd = $state(input);
	let errors: Record<string, string[] | undefined> = $state({});
	let message = $state<string | undefined>();
	let initialSnapshot = $state(JSON.stringify(input));
	const isDirty = $derived(JSON.stringify(fd) !== initialSnapshot);
	const submission = useSubmissionState();
	let stories = $derived(data.stories);

	type DragEndEvent = {
		operation: { source: { sortable: { index: number; initialIndex: number } | null } | null };
	};

	type SortableBind = ReturnType<typeof useSortable>;
	const safeSortable = (id: string, index: number): SortableBind =>
		useSortable({ id, index }) as SortableBind;

	const validate = () => {
		const result = anthologySchema.safeParse(fd);
		if (result.success) {
			errors = {};
			message = undefined;
			return true;
		}

		errors = z.flattenError(result.error).fieldErrors;
		message = 'Form submission failed.';
		void tick().then(() =>
			document
				.querySelector<HTMLElement>('[aria-invalid="true"]')
				?.scrollIntoView({ behavior: 'smooth' })
		);
		return false;
	};

	const enhanceUpsert: SubmitFunction = ({ cancel }) => {
		if (submission.submitting || !validate()) {
			cancel();
			return;
		}

		const submissionId = submission.start();
		return async ({ result, update }) => {
			try {
				if (result.type === 'success') {
					message = undefined;
					initialSnapshot = JSON.stringify(fd);
					isEditorOpen = false;
				} else if (result.type === 'failure' && result.data) {
					const data = result.data as UpsertActionData;
					if (data.values) fd = data.values as AnthologyFormValues;
					errors = data.errors ?? {};
					message = data.message;
				}
				await update({ reset: false });
			} finally {
				submission.finish(submissionId);
			}
		};
	};

	const addPosition = () => {
		const positions = fd.positions ?? [];
		const nextOrder = positions.filter((p) => !p.isRemoved).length + 1;
		fd.positions = [
			...positions,
			{
				id: `new-${crypto.randomUUID().toString().slice(0, 8)}`,
				storyId: '',
				order: nextOrder,
				isRemoved: false // Front-end purposes
			}
		];
	};

	const handlePositionDrag = (event: DragEndEvent) => {
		const sortable = event.operation.source?.sortable;
		if (!sortable) return;
		const positions = moveArrayItem(
			fd.positions,
			sortable.initialIndex,
			sortable.index
		) as typeof fd.positions;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		positions?.filter((q) => !q.isRemoved)?.forEach((q, i) => (q.order = i + 1)) ?? [];
		fd.positions = positions;
	};
</script>

<Dialog.Root
	bind:open={isEditorOpen}
	onOpenChange={(isOpen) => {
		if (!isOpen) anthology = undefined;
	}}
>
	<Dialog.Portal>
		<Dialog.Overlay
			class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 dark:bg-background/50"
		/>
		<Dialog.Content
			preventScroll={true}
			onOpenAutoFocus={(e) => e.preventDefault()}
			class="max-h-screen max-w-2xl! scrollbar-none overflow-y-scroll pt-10"
			interactOutsideBehavior={isDirty ? 'ignore' : 'close'}
			escapeKeydownBehavior={isDirty ? 'ignore' : 'close'}
		>
			<form method="POST" action="?/upsert" use:enhance={enhanceUpsert} class="grid gap-6">
				<input type="hidden" name="id" value={fd.id ?? ''} />
				<input type="hidden" name="nameRaw" value={JSON.stringify(fd.nameRaw ?? {})} />
				<input type="hidden" name="isPublished" value={String(fd.isPublished)} />
				<input type="hidden" name="isPublic" value={String(fd.isPublic)} />
				<input type="hidden" name="positions" value={JSON.stringify(fd.positions ?? [])} />
				<div class="grid gap-6 md:grid-cols-2">
					<div class="space-y-2">
						<Field.Label
							for="anthology-slug"
							class={errors.slug?.length ? 'text-destructive' : undefined}
							>Slug</Field.Label
						>
						<Input
							id="anthology-slug"
							name="slug"
							type="text"
							bind:value={fd.slug}
							aria-invalid={errors.slug?.length ? 'true' : undefined}
						/>
						{#if errors.slug?.length}<div
								class="text-sm font-medium text-destructive"
								role="alert"
							>
								{#each errors.slug as error, i (`${error}-${i}`)}<div>{error}</div>{/each}
							</div>{/if}
					</div>
					<div class="space-y-2">
						<Field.Label class={errors.nameRaw?.length ? 'text-destructive' : undefined}
							>Naam</Field.Label
						>
						<TranslatableInput bind:value={fd.nameRaw} languageselector={true} />
						{#if errors.nameRaw?.length}<div
								class="text-sm font-medium text-destructive"
								role="alert"
							>
								{#each errors.nameRaw as error, i (`${error}-${i}`)}<div>{error}</div>{/each}
							</div>{/if}
					</div>

					<div class="space-y-2">
						<div class="flex items-center space-x-2">
							<Switch id="ispublished" bind:checked={fd.isPublished} />
							<Field.Label for="ispublished" class="text-sm font-normal">Is published?</Field.Label>
						</div>
						<div class="block">
							<CopyButton text={`${page.url.origin}/a/${fd.slug}`} size="sm" variant="outline">
								{#snippet icon()}
									<CopyIcon />
								{/snippet}
								<span class="text-sm">Share url:</span>
								<span class="font-mono text-sm font-light" class:line-through={!fd.isPublished}>
									{`${page.url.origin}/a/${fd.slug}`}
								</span>
							</CopyButton>
						</div>
					</div>

					{#if fd.isPublished}
						<div class="flex items-center space-x-2">
							<Switch id="ispublic" disabled bind:checked={fd.isPublic} />
							<Field.Label for="ispublic" class="text-sm font-normal">Is public?</Field.Label>
						</div>
					{/if}

					<Separator class="md:col-span-2" />

					<DragDropProvider onDragEnd={(event: DragEndEvent) => handlePositionDrag(event)}>
						<div class="grid gap-4 md:col-span-2">
							{#each fd.positions ?? [] as position, p (position.id)}
								{@const { ref, handleRef } = safeSortable(position.id ?? `pos-${p}`, p)}
								<Field.Set
									class="grid gap-0 rounded-lg border bg-card/50 backdrop-blur-md {position.isRemoved
										? 'hidden'
										: ''}"
									{@attach ref}
								>
									<Collapsible.Root open={true}>
										<div class="grid gap-4 p-4">
											<div class="flex justify-between gap-2">
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
													<Select.Root type="single" bind:value={fd.positions[p].storyId}>
														<Select.Trigger
															class="w-full min-w-40 {stories.find(
																(s) => fd.positions[p].storyId && s.id === fd.positions[p].storyId
															)
																? ''
																: 'text-muted-foreground'}"
														>
															{stories.find(
																(s) => fd.positions[p].storyId && s.id === fd.positions[p].storyId
															)?.name ?? 'Select a story...'}
														</Select.Trigger>
														<Select.Content align="start">
															<Select.Group>
																{#each stories as item (item.id)}
																	<Select.Item class="block" value={item.id}>
																		<p>{item.name}</p>
																	</Select.Item>
																{/each}
															</Select.Group>
														</Select.Content>
													</Select.Root>
												</div>

												<Button
													type="button"
													variant="ghost"
													size="icon"
													class="text-destructive hover:bg-destructive/10 hover:text-destructive"
													onclick={() => {
														fd.positions[p].isRemoved = true;
														fd.positions
															?.filter((p) => !p.isRemoved)
															?.forEach((p, i) => (p.order = i + 1));
													}}
												>
													<TrashIcon class="size-4" />
												</Button>
											</div>
										</div>
									</Collapsible.Root>
								</Field.Set>
							{/each}

							<Button type="button" variant="outline" size="sm" onclick={addPosition}
								>Add position</Button
							>
						</div>
					</DragDropProvider>
				</div>

				<div class="space-y-2">
					{#if errors.positions?.length}<div
							class="text-sm font-medium text-destructive"
							role="alert"
						>
							{#each errors.positions as error, i (`${error}-${i}`)}<div>{error}</div>{/each}
						</div>{/if}
					<Button type="submit" class="w-full" disabled={submission.delayed}>
						{#if submission.delayed}<LoaderIcon class="size-4 animate-spin" />{/if}
						<CheckIcon class="size-4" />
						<span>Opslaan</span>
					</Button>
					{#if message}
						<p class="text-center text-sm font-medium text-destructive">{message}</p>
					{/if}
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
