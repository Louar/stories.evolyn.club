<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Popover from '$lib/components/ui/popover';
	import { TranslatableInput } from '$lib/components/ui/translatable-input';
	import type { Translatable } from '$lib/db/schemas/0-utils';
	import { useSubmissionState } from '$lib/hooks/use-submission-state.svelte';
	import CheckIcon from '@lucide/svelte/icons/check';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { toast } from 'svelte-sonner';
	import DataGridLanguageSelectMenu from '$lib/components/data-grid/data-grid-language-select-menu.svelte';

	type FieldErrors = Record<string, string[]>;

	let open = $state(false);
	let slug = $state('');
	let name: Translatable = $state({});
	let errors: FieldErrors = $state({});
	const submission = useSubmissionState();

	const reset = () => {
		slug = '';
		name = {};
		errors = {};
	};

	const submit = async (event: SubmitEvent) => {
		event.preventDefault();
		if (submission.submitting) return;

		const trimmedSlug = slug.trim();
		const trimmedName = Object.fromEntries(
			Object.entries(name)
				.map(([language, name]) => [language, name.trim()])
				.filter(([, name]) => name)
		) as Translatable;
		const fallbackName = Object.values(trimmedName)[0];
		errors = {
			...(!trimmedSlug ? { slug: ['Slug is required'] } : {}),
			...(!fallbackName ? { name: ['Name is required'] } : {})
		};
		if (!trimmedSlug || !fallbackName) return;

		const translatedName: Translatable = {
			...trimmedName,
			...(trimmedName.default || trimmedName.en ? {} : { default: fallbackName })
		};
		const submissionId = submission.start();
		try {
			const response = await fetch('/api/stories', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ slug: trimmedSlug, name: translatedName })
			});
			const payload: unknown = await response.json().catch(() => undefined);

			if (!response.ok) {
				if (payload && typeof payload === 'object' && 'errors' in payload) {
					errors = (payload as { errors: FieldErrors }).errors;
					return;
				}
				throw new Error('Failed to create story');
			}
			if (!payload || typeof payload !== 'object' || !('id' in payload)) {
				throw new Error('The created story response did not include an ID');
			}

			const storyId = (payload as { id: unknown }).id;
			if (typeof storyId !== 'string') throw new Error('The created story ID is invalid');
			open = false;
			reset();
			await goto(resolve(`/edit/stories/${storyId}/flow`));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to create story');
		} finally {
			submission.finish(submissionId);
		}
	};
</script>

<Popover.Root bind:open onOpenChange={(nextOpen) => !nextOpen && !submission.submitting && reset()}>
	<Popover.Trigger class="ml-auto">
		{#snippet child({ props })}
			<Button {...props} size="lg">
				<PlusIcon />
				New story
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content align="end" class="w-96 max-w-[calc(100vw-2rem)]">
		<form class="grid gap-4" onsubmit={submit} novalidate aria-busy={submission.submitting}>
			<div class="space-y-2">
				<h4 class="leading-none font-medium">Create story</h4>
				<p class="text-sm text-muted-foreground">Set the URL slug and translated name.</p>
			</div>

			<div class="grid gap-2">
				<Label for="new-story-slug" class={errors.slug?.length ? 'text-destructive' : undefined}
					>Slug</Label
				>
				<Input
					id="new-story-slug"
					name="slug"
					bind:value={slug}
					placeholder="my-new-story"
					disabled={submission.submitting}
					aria-invalid={errors.slug?.length ? 'true' : undefined}
					aria-describedby={errors.slug?.length ? 'new-story-slug-errors' : undefined}
				/>
				{#if errors.slug?.length}
					<div id="new-story-slug-errors" class="text-xs text-destructive" role="alert">
						{#each errors.slug as error, index (`${error}-${index}`)}<div>{error}</div>{/each}
					</div>
				{/if}
			</div>

			<div class="grid gap-2">
				<div class="flex items-center justify-between gap-2">
					<Label for="new-story-name" class={errors.name?.length ? 'text-destructive' : undefined}
						>Name</Label
					>
					<DataGridLanguageSelectMenu />
				</div>
				<TranslatableInput
					id="new-story-name"
					bind:value={name}
					disabled={submission.submitting}
					aria-invalid={errors.name?.length ? 'true' : undefined}
					aria-describedby={errors.name?.length ? 'new-story-name-errors' : undefined}
				/>
				{#if errors.name?.length}
					<div id="new-story-name-errors" class="text-xs text-destructive" role="alert">
						{#each errors.name as error, index (`${error}-${index}`)}<div>{error}</div>{/each}
					</div>
				{/if}
			</div>

			<Button type="submit" class="w-full" disabled={submission.submitting}>
				{#if submission.delayed}<LoaderCircleIcon class="animate-spin" />{:else}<CheckIcon />{/if}
				Create and edit
			</Button>
			{#if submission.timeout}
				<p class="text-center text-xs text-muted-foreground" aria-live="polite">
					Story creation is taking longer than expected.
				</p>
			{/if}
		</form>
	</Popover.Content>
</Popover.Root>
