<script lang="ts">
	import { page } from '$app/state';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import { CopyButton } from '$lib/components/ui/copy-button';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { Switch } from '$lib/components/ui/switch';
	import { TranslatableInput } from '$lib/components/ui/translatable-input';
	import type { findOneStoryById, storySchema } from '$lib/db/repositories/2-stories-module';
	import { formatFormError } from '$lib/db/schemas/0-utils';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import z from 'zod/v4';
	import type { $ZodIssue } from 'zod/v4/core';

	type Props = {
		storyId: string;
		story: Pick<
			Awaited<ReturnType<typeof findOneStoryById>>,
			'reference' | 'name' | 'isPublished' | 'isPublic'
		>;
		close: (output: { action: 'persist' | 'delete'; data?: z.infer<typeof storySchema> }) => void;
	};
	let { storyId, story: rawstory, close }: Props = $props();

	// svelte-ignore state_referenced_locally
	let story = $state(rawstory);

	let error = $state<$ZodIssue[] | null>(null);

	const persist = async (event: Event) => {
		event.preventDefault();

		const result = await fetch(`/api/stories/${storyId}`, {
			method: 'PUT',
			body: JSON.stringify(story)
		});

		if (!result.ok) {
			error = await result.json();
		} else {
			error = null;
			close({ action: 'persist', data: await result.json() });
		}
	};
	const remove = async () => {
		if (!storyId?.length) return;
		const result = await fetch(`/api/stories/${storyId}`, {
			method: 'DELETE'
		});
		if (!result.ok) error = await result.json();
		else {
			close({ action: 'delete' });
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
					<Dialog.Title>Edit story settings</Dialog.Title>
				</div>

				<div class="flex gap-2">
					<Dialog.Close class={buttonVariants({ variant: 'outline' })}>Cancel</Dialog.Close>
					<Button variant="destructive" size="icon" onclick={remove}>
						<TrashIcon />
					</Button>
					<Button type="submit" onclick={persist}>Save story</Button>
				</div>
			</div>

			<Separator class="mt-4" />
		</Dialog.Header>

		<Field.Group class="gap-2">
			<Field.Field>
				<Field.Label>Reference</Field.Label>
				<Input bind:value={story.reference} placeholder="Reference..." />
				<Field.Error>
					{formatFormError(error, `reference`)}
				</Field.Error>
			</Field.Field>

			<Field.Field>
				<Field.Label>Name</Field.Label>
				<TranslatableInput bind:value={story.name} placeholder="Name..." languageselector={true} />
				<Field.Error>
					{formatFormError(error, `name`)}
				</Field.Error>
			</Field.Field>

			<Field.Field class="space-x-2">
				<div class="flex items-center space-x-2">
					<Switch id="ispublished" bind:checked={story.isPublished} />
					<Field.Label for="ispublished" class="text-sm font-normal">Is published?</Field.Label>
				</div>
				<div class="block">
					<CopyButton text={`${page.url.origin}/s/${story.reference}`} size="sm" variant="outline">
						{#snippet icon()}
							<CopyIcon />
						{/snippet}
						<span class="text-sm">Share url:</span>
						<span class="font-mono text-sm font-light" class:line-through={!story.isPublished}>
							{`${page.url.origin}/s/${story.reference}`}
						</span>
					</CopyButton>
				</div>
				<Field.Error>
					{formatFormError(error, `isPublished`)}
				</Field.Error>
			</Field.Field>

			{#if story.isPublished}
				<Field.Field class="space-x-2">
					<div class="flex items-center space-x-2">
						<Switch id="ispublic" disabled bind:checked={story.isPublic} />
						<Field.Label for="ispublic" class="text-sm font-normal">Is public?</Field.Label>
					</div>
					<Field.Error>
						{formatFormError(error, `isPublic`)}
					</Field.Error>
				</Field.Field>
			{/if}
		</Field.Group>
	</Dialog.Content>
</form>
