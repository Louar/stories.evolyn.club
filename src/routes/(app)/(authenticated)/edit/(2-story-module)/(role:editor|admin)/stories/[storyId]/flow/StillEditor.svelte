<script lang="ts">
	import HeaderBlank from '$lib/components/app/header/app-header-blank.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as ColorPicker from '$lib/components/ui/color-picker/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import type { findOneStillById } from '$lib/db/repositories/2-story-module';
	import { formatFormError, MediaCollection, type Media } from '$lib/db/schemas/0-utils';
	import { EDITORS } from '$lib/states/editors.svelte';
	import Paintbrush from '@lucide/svelte/icons/paintbrush';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import XIcon from '@lucide/svelte/icons/x';
	import { onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type { $ZodIssue } from 'zod/v4/core';
	import EditorSurface from './EditorSurface.svelte';

	type Props = {
		storyId: string;
		selectedId?: string;
		embedded?: boolean;
		close: (output: {
			action: 'persist' | 'delete' | 'close';
			id?: string;
			still?: Awaited<ReturnType<typeof findOneStillById>>;
			keepOpen?: boolean;
		}) => void;
	};
	let { storyId, selectedId, embedded = false, close }: Props = $props();
	let stills = $derived(EDITORS.stills);

	const createDefaultStill = (): (typeof stills)[number] => ({
		id: 'new',
		color: null,
		image: null,
		style: null
	});
	const cloneStill = (value: (typeof stills)[number]) => structuredClone($state.snapshot(value));
	// svelte-ignore state_referenced_locally
	let still = $state(
		selectedId
			? cloneStill(EDITORS.stills.find((item) => item.id === selectedId) ?? createDefaultStill())
			: createDefaultStill()
	);
	let error = $state<$ZodIssue[] | null>(null);
	let saveState = $state<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
	let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
	let saveVersion = 0;

	const persist = async (event?: Event, autosave = false) => {
		event?.preventDefault();
		clearTimeout(autosaveTimer);
		const version = ++saveVersion;
		saveState = 'saving';
		const request = (async () => {
			const result = await fetch(`/api/stories/${storyId}/stills/${still.id ?? 'new'}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(still)
			});
			if (!result.ok) {
				if (result.status === 422) error = await result.json();
				throw new Error('Saving still failed');
			}
			return await result.json();
		})();
		toast.promise(request, {
			loading: 'Saving still...',
			success: 'Still saved',
			error: 'Could not save still'
		});
		try {
			const saved = await request;
			if (version !== saveVersion) {
				if (still.id === 'new') still.id = saved.id;
				close({ action: 'persist', still: saved, keepOpen: true });
				return;
			}
			error = null;
			saveState = 'saved';
			if (autosave) still.id = saved.id;
			else still = cloneStill(saved);
			close({ action: 'persist', still: saved, keepOpen: autosave });
		} catch {
			if (version === saveVersion) saveState = 'error';
		}
	};
	const scheduleAutosave = () => {
		saveVersion += 1;
		saveState = 'dirty';
		clearTimeout(autosaveTimer);
		autosaveTimer = setTimeout(() => persist(undefined, true), 700);
	};
	const setStillColor = (value: string) => {
		still.color = value;
		scheduleAutosave();
	};
	onDestroy(() => {
		clearTimeout(autosaveTimer);
		if (saveState === 'dirty') void persist(undefined, true);
	});

	const remove = async () => {
		if (!still.id?.length || still.id === 'new') return;
		const result = await fetch(`/api/stories/${storyId}/stills/${still.id}`, { method: 'DELETE' });
		if (!result.ok) {
			toast.error(result.statusText ?? 'Something went wrong', {
				closeButton: true,
				duration: Infinity
			});
			return;
		}
		close({ action: 'delete', id: still.id });
		still = createDefaultStill();
	};
	const dismiss = () => close({ action: 'close' });

	const setExternalImage = (value: string): Media | null =>
		value.length ? { collection: MediaCollection.externals, filename: value } : null;
</script>

<EditorSurface
	{embedded}
	class="muted-scrollbar {embedded ? '' : 'max-h-[90vh] pt-0 sm:max-w-200'}"
>
	<HeaderBlank class="w-full">
		<div class="px-2">
			<h1 class="truncate overflow-hidden text-sm whitespace-nowrap">
				{still.id === 'new' ? 'New still' : 'Edit still'}
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
			{#if still.id !== 'new'}
				<Button variant="destructive" size="icon" onclick={remove}><TrashIcon /></Button>
			{/if}
			<Button variant="ghost" size="icon" onclick={dismiss}><XIcon /></Button>
		</div>
	</HeaderBlank>
	<form
		class={embedded ? 'block p-4' : 'contents'}
		onsubmit={persist}
		oninput={scheduleAutosave}
		onchange={scheduleAutosave}
	>
		<Field.Group class="gap-2">
			<Field.Field>
				<Field.Label>Background color (optional)</Field.Label>
				<div class="flex items-center gap-4">
					<div
						class="h-8 w-8 rounded-full border shadow-sm"
						style:background-color={still.color}
					></div>
					<Popover.Root>
						<Popover.Trigger>
							{#snippet child({ props })}
								<Button
									{...props}
									variant="outline"
									class="w-55 justify-start text-left font-normal"
								>
									<Paintbrush class="mr-2 h-4 w-4" />
									{still.color ?? 'Pick a color'}
								</Button>
							{/snippet}
						</Popover.Trigger>
						<Popover.Content class="w-auto border-none p-0 shadow-none">
							<ColorPicker.Root
								bind:value={() => still.color ?? '#000000', setStillColor}
								allowOpacity={true}
								defaultFormat="oklch"
							/>
						</Popover.Content>
					</Popover.Root>
				</div>
				<Field.Error>{formatFormError(error, 'color')}</Field.Error>
			</Field.Field>
			<Field.Field>
				<Field.Label>Image URL (optional)</Field.Label>
				<Input
					value={still.image?.filename ?? ''}
					placeholder="https://..."
					oninput={(event) => (still.image = setExternalImage(event.currentTarget.value))}
				/>
				<Field.Error>{formatFormError(error, 'image.filename')}</Field.Error>
			</Field.Field>
			<Field.Field>
				<Field.Label>Image classes (optional)</Field.Label>
				<Input
					value={still.style ?? ''}
					placeholder="bg-cover bg-center bg-no-repeat"
					oninput={(event) => (still.style = event.currentTarget.value || null)}
				/>
				<Field.Description
					>Tailwind background classes such as bg-cover and bg-repeat.</Field.Description
				>
				<Field.Error>{formatFormError(error, 'style')}</Field.Error>
			</Field.Field>
			<div
				class="min-h-48 rounded-md border {still.style ?? ''}"
				style:background-color={still.color ?? undefined}
				style:background-image={still.image ? `url(${still.image.filename})` : undefined}
			></div>
		</Field.Group>
	</form>
</EditorSurface>
