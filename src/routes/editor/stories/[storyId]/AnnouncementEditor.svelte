<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { LanguageSelector } from '$lib/components/ui/language-selector';
	import * as Select from '$lib/components/ui/select/index.js';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { Toggle } from '$lib/components/ui/toggle/index.js';
	import { TranslatableInput } from '$lib/components/ui/translatable-input';
	import type { findOneAnnouncementById } from '$lib/db/repositories/2-stories-module';
	import { EDITORS } from '$lib/states/editors.svelte';
	import SquarePlus from '@lucide/svelte/icons/square-plus';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import type { $ZodIssue } from 'zod/v4/core';

	type Props = {
		storyId: string;
		close: (output: {
			action: 'persist' | 'delete';
			id?: string;
			announcement?: Awaited<ReturnType<typeof findOneAnnouncementById>>;
		}) => void;
	};
	let { storyId, close }: Props = $props();

	let announcements = $derived(EDITORS.announcements);

	const defaultAnnouncement: (typeof announcements)[number] = {
		id: 'new',
		name: '',
		title: {},
		message: {}
	};
	let announcement = $state(defaultAnnouncement);
	let error = $state<$ZodIssue[] | null>(null);

	const persist = async (event: Event) => {
		event.preventDefault();

		const result = await fetch(
			`/api/stories/${storyId}/announcements/${announcement.id ?? 'new'}`,
			{
				method: 'POST',
				body: JSON.stringify(announcement)
			}
		);

		if (!result.ok) {
			error = await result.json();
		} else {
			error = null;
			close({ action: 'persist', announcement: await result.json() });
		}
	};
	const remove = async () => {
		if (!announcement.id?.length) return;
		const result = await fetch(`/api/stories/${storyId}/announcements/${announcement.id}`, {
			method: 'DELETE'
		});
		if (!result.ok) error = await result.json();
		else {
			close({ action: 'delete', id: announcement.id });
			announcement = defaultAnnouncement;
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
					{#if announcements && announcements.length > 0}
						<Dialog.Title>Edit:</Dialog.Title>
						<div>
							<Select.Root
								type="single"
								value={announcement.id ?? 'none'}
								onValueChange={(value) =>
									(announcement = announcements.find((a) => a.id === value) ?? defaultAnnouncement)}
							>
								<Select.Trigger
									class="min-w-40 {announcements.find(
										(a) => announcement.id && a.id === announcement.id
									)
										? ''
										: 'text-muted-foreground'}"
								>
									{announcements.find((a) => announcement.id && a.id === announcement.id)?.name ??
										'Select an announcement...'}
								</Select.Trigger>
								<Select.Content align="start">
									<Select.Group>
										<!-- <Select.GroupHeading>Announcements</Select.GroupHeading> -->
										{#each announcements as item}
											<Select.Item class="block" value={item.id}>
												<p>{item.name}</p>
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
						class="bg-card! {announcement?.id === 'new'
							? 'text-blue-600! *:[svg]:fill-blue-100! *:[svg]:stroke-blue-500!'
							: ''}"
						onclick={() => (announcement = defaultAnnouncement)}
					>
						<SquarePlus />
						New
					</Toggle>
				</div>

				<div class="flex gap-2">
					<LanguageSelector />
					<Dialog.Close class={buttonVariants({ variant: 'outline' })}>Cancel</Dialog.Close>
					{#if announcement.id && announcement.id !== 'new'}
						<Button variant="destructive" size="icon" onclick={remove}>
							<TrashIcon />
						</Button>
					{/if}
					<Button type="submit" onclick={persist}>Save announcement</Button>
				</div>
			</div>

			<Separator class="mt-4" />
		</Dialog.Header>

		<Field.Group class="gap-2">
			<Field.Field>
				<Field.Label>Announcement reference name</Field.Label>
				<Input bind:value={announcement.name} placeholder="Name..." />
				<Field.Error>
					{error?.find((e) => e.path?.join('.') === ['name'].join('.'))?.message}
				</Field.Error>
			</Field.Field>
			<Field.Field>
				<Field.Label>Title (optional)</Field.Label>
				<TranslatableInput bind:value={announcement.title} placeholder="Title..." />
				<Field.Error>
					{error?.find((e) => e.path?.join('.') === ['title'].join('.'))?.message}
				</Field.Error>
			</Field.Field>
			<Field.Field>
				<Field.Label>Message (optional)</Field.Label>
				<TranslatableInput bind:value={announcement.message} placeholder="Message..." />
				<Field.Error>
					{error?.find((e) => e.path?.join('.') === ['message'].join('.'))?.message}
				</Field.Error>
			</Field.Field>
		</Field.Group>
	</Dialog.Content>
</form>
