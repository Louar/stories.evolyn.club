<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import { CopyButton } from '$lib/components/ui/copy-button';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import * as Form from '$lib/components/ui/form/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { Switch } from '$lib/components/ui/switch';
	import { TranslatableInput } from '$lib/components/ui/translatable-input';
	import { formatFormError } from '$lib/db/schemas/0-utils';
	import { moveArrayItem } from '$lib/utils';
	import { DragDropProvider } from '@dnd-kit-svelte/svelte';
	import { useSortable } from '@dnd-kit-svelte/svelte/sortable';
	import CheckIcon from '@lucide/svelte/icons/check';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { defaults, superForm } from 'sveltekit-superforms';
	import { zod4, zod4Client } from 'sveltekit-superforms/adapters';
	import type { PageData } from './$types';
	import { anthologySchema } from './schemas';

	type Anthology = PageData['anthologies'][number];
	type Props = {
		data: PageData;
		isEditorOpen: boolean;
		anthology: Anthology | undefined;
	};
	let { data, isEditorOpen = $bindable(true), anthology = $bindable() }: Props = $props();
	const defaultsData = defaults(zod4(anthologySchema)).data;
	const input = $state({
		...defaultsData,
		...{
			...anthology,
			positions: anthology?.positions.map((position) => ({ ...position, isRemoved: false })) ?? []
		}
	});
	let stories = $derived(data.stories);

	const form = superForm(input, {
		validators: zod4Client(anthologySchema),
		resetForm: false,
		dataType: 'json',
		scrollToError: 'smooth',
		onUpdate: ({ form: f }) => {
			if (f.valid) isEditorOpen = false;
		}
	});
	const { form: fd, enhance, delayed, message, isTainted, tainted } = form;

	type DragEndEvent = {
		operation: { source: { sortable: { index: number; initialIndex: number } | null } | null };
	};

	type SortableBind = ReturnType<typeof useSortable>;
	const safeSortable = (id: string, index: number): SortableBind =>
		useSortable({ id, index }) as SortableBind;

	const addPosition = () => {
		const positions = $fd.positions ?? [];
		const nextOrder = positions.filter((p) => !p.isRemoved).length + 1;
		$fd.positions = [
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
			$fd.positions,
			sortable.initialIndex,
			sortable.index
		) as typeof $fd.positions;
		positions?.filter((q) => !q.isRemoved)?.forEach((q, i) => (q.order = i + 1)) ?? [];
		$fd.positions = positions;
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
			class="scrollbar-none max-h-screen max-w-2xl! overflow-y-scroll pt-10"
			interactOutsideBehavior={isTainted($tainted) ? 'ignore' : 'close'}
			escapeKeydownBehavior={isTainted($tainted) ? 'ignore' : 'close'}
		>
			<form method="POST" action="?/upsert" use:enhance class="grid gap-6">
				<div class="grid gap-6 md:grid-cols-2">
					<Form.Field {form} name="reference">
						<Form.Control>
							{#snippet children({ props })}
								<div class="space-y-2">
									<Form.Label>Reference</Form.Label>
									<Input {...props} type="text" bind:value={$fd.reference} />
									<Form.FieldErrors />
								</div>
							{/snippet}
						</Form.Control>
					</Form.Field>
					<Form.Field {form} name="nameRaw">
						<Form.Control>
							{#snippet children({ props })}
								<div class="space-y-2">
									<Form.Label>Naam</Form.Label>
									<TranslatableInput bind:value={$fd.nameRaw} languageselector={true} />
									<Form.FieldErrors />
								</div>
							{/snippet}
						</Form.Control>
					</Form.Field>

					<Form.Field {form} name="isPublished">
						<Form.Control>
							{#snippet children({ props })}
								<div class="flex items-center space-x-2">
									<Switch id="ispublished" bind:checked={$fd.isPublished} />
									<Field.Label for="ispublished" class="text-sm font-normal"
										>Is published?</Field.Label
									>
								</div>
								<div class="block">
									<CopyButton
										text={`${page.url.origin}/a/${$fd.reference}`}
										size="sm"
										variant="outline"
									>
										{#snippet icon()}
											<CopyIcon />
										{/snippet}
										<span class="text-sm">Share url:</span>
										<span
											class="font-mono text-sm font-light"
											class:line-through={!$fd.isPublished}
										>
											{`${page.url.origin}/a/${$fd.reference}`}
										</span>
									</CopyButton>
								</div>
							{/snippet}
						</Form.Control>
					</Form.Field>

					{#if $fd.isPublished}
						<Form.Field {form} name="isPublic">
							<Form.Control>
								{#snippet children({ props })}
									<div class="flex items-center space-x-2">
										<Switch id="ispublic" disabled bind:checked={$fd.isPublic} />
										<Field.Label for="ispublic" class="text-sm font-normal">Is public?</Field.Label>
									</div>
								{/snippet}
							</Form.Control>
						</Form.Field>
					{/if}

					<Separator class="md:col-span-2" />

					<DragDropProvider onDragEnd={(event) => handlePositionDrag(event as DragEndEvent)}>
						<div class="grid gap-4 md:col-span-2">
							{#each $fd.positions ?? [] as position, p (position.id)}
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
													<Select.Root type="single" bind:value={$fd.positions[p].storyId}>
														<Select.Trigger
															class="w-full min-w-40 {stories.find(
																(s) => $fd.positions[p].storyId && s.id === $fd.positions[p].storyId
															)
																? ''
																: 'text-muted-foreground'}"
														>
															{stories.find(
																(s) => $fd.positions[p].storyId && s.id === $fd.positions[p].storyId
															)?.name ?? 'Select a story...'}
														</Select.Trigger>
														<Select.Content align="start">
															<Select.Group>
																{#each stories as item}
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
														$fd.positions[p].isRemoved = true;
														$fd.positions
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
					<Button type="submit" class="w-full" disabled={$delayed}>
						{#if $delayed}<LoaderIcon class="size-4 animate-spin" />{/if}
						<CheckIcon class="size-4" />
						<span>Opslaan</span>
					</Button>
					{#if $message?.error}
						<p class="text-center text-sm font-medium text-destructive">{$message.reason}</p>
					{/if}
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
