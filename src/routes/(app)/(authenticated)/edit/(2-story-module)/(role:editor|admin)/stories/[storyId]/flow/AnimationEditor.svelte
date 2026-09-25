<script lang="ts" module>
	import type { findOneAnimationById } from '$lib/db/repositories/2-story-module.js';
	export type AnimationEditorOutput = {
		action: 'persist' | 'delete' | 'close';
		id?: string;
		animation?: Awaited<ReturnType<typeof findOneAnimationById>>;
	};
</script>

<script lang="ts">
	import HeaderBlank from '$lib/components/app/header/app-header-blank.svelte';
	import WebMotionPlayer from '$lib/components/app/player/WebMotionPlayer.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { CopyButton } from '$lib/components/ui/copy-button/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { animationSchema, resolveAnimationConfig } from '$lib/media/animation.js';
	import generationGuide from '$lib/media/webmotion-generation-guide.md?raw';
	import { EDITORS } from '$lib/states/editors.svelte.js';
	import { UI } from '$lib/states/ui.svelte.js';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import XIcon from '@lucide/svelte/icons/x';
	import { onMount, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';

	let {
		storyId,
		selectedId,
		close
	}: {
		storyId: string;
		selectedId?: string;
		close: (output: AnimationEditorOutput) => void;
	} = $props();
	const uid = $props.id();
	const initial = untrack(() => EDITORS.animations.find((item) => item.id === selectedId));
	const notify = untrack(() => close);
	const endpoint = untrack(() => `/api/stories/${storyId}/animations`);
	let id = $state(initial?.id ?? 'new');
	let name = $state(initial?.name ?? '');
	let configJson = $state(
		JSON.stringify(
			initial?.configuration ?? {
				version: 1,
				playback: { autoplay: false, loop: false },
				composition: { viewBoxWidth: 1920, viewBoxHeight: 1080, fps: 30, durationInFrames: 150 },
				motions: {},
				layers: []
			},
			null,
			2
		)
	);
	let textsJson = $state(JSON.stringify(initial?.texts ?? {}, null, 2));
	let busy = $state(false);
	let error = $state('');
	let deleteOpen = $state(false);
	let deleting = $state(false);
	let deleted = false;
	let disposed = false;
	let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
	let inFlight: Promise<void> | undefined;
	const snapshot = () => JSON.stringify([name, configJson, textsJson]);
	let savedSnapshot = $state(untrack(snapshot));
	let dirty = $derived(snapshot() !== savedSnapshot);
	let validation = $derived.by(() => {
		try {
			const config: unknown = JSON.parse(configJson);
			if (!config || typeof config !== 'object' || Array.isArray(config))
				return { error: 'Configuration must be a JSON object.' };
			const result = animationSchema.omit({ name: true }).safeParse({
				configuration: config,
				texts: JSON.parse(textsJson)
			});
			return result.success
				? { data: result.data }
				: {
						error: result.error.issues
							.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
							.join('\n')
					};
		} catch (cause) {
			return { error: cause instanceof Error ? cause.message : 'Invalid JSON.' };
		}
	});
	let previewConfig = $derived(
		validation.data ? resolveAnimationConfig(validation.data, UI.language) : undefined
	);
	const persist = async (): Promise<void> => {
		if (deleted || deleting) return;
		if (inFlight) {
			await inFlight;
			return persist();
		}
		if (!dirty || !validation.data) return;
		const submittedSnapshot = snapshot();
		const body = JSON.stringify({ ...validation.data, name });
		busy = true;
		error = '';
		inFlight = (async () => {
			try {
				const response = await fetch(`${endpoint}/${id}`, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body
				});
				if (!response.ok) throw new Error(`Could not save animation (${response.status}).`);
				const animation: NonNullable<AnimationEditorOutput['animation']> = await response.json();
				id = animation.id;
				// A response acknowledges only its own draft, never edits made while it was in flight.
				savedSnapshot = submittedSnapshot;
				notify({ action: 'persist', animation });
			} catch (cause) {
				error = cause instanceof Error ? cause.message : 'Could not save animation.';
				if (disposed) toast.error(error);
			} finally {
				busy = false;
				inFlight = undefined;
			}
		})();
		await inFlight;
	};
	const scheduleAutosave = () => {
		clearTimeout(autosaveTimer);
		if (!disposed && !deleted && !deleting) {
			autosaveTimer = setTimeout(() => void persist(), 700);
		}
	};
	const dismiss = async () => {
		clearTimeout(autosaveTimer);
		await persist();
		if (dirty && error) return;
		notify({ action: 'close' });
	};
	onMount(() => () => {
		disposed = true;
		clearTimeout(autosaveTimer);
		void persist();
	});
	const remove = async () => {
		if (deleting || deleted || id === 'new') return;
		deleting = true;
		clearTimeout(autosaveTimer);
		await inFlight;
		error = '';
		try {
			const response = await fetch(`${endpoint}/${id}`, {
				method: 'DELETE'
			});
			if (!response.ok) throw new Error(`Could not delete animation (${response.status}).`);
			deleted = true;
			notify({ action: 'delete', id });
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not delete animation.';
			if (disposed) toast.error(error);
		} finally {
			deleting = false;
			deleteOpen = false;
			if (!deleted && dirty) {
				if (disposed) void persist();
				else scheduleAutosave();
			}
		}
	};
</script>

<AlertDialog.Root bind:open={deleteOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete animation?</AlertDialog.Title>
			<AlertDialog.Description
				>This permanently deletes the animation from every story using it. Parts using it will no
				longer have this animation background.</AlertDialog.Description
			>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={deleting}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				variant="destructive"
				disabled={deleting}
				onclick={(event) => {
					event.preventDefault();
					void remove();
				}}>Delete</AlertDialog.Action
			>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
<div class="flex h-full min-h-0 min-w-0 flex-col [overflow-wrap:anywhere]">
	<HeaderBlank class="w-full shrink-0">
		<div class="min-w-0">
			<h1 class="text-sm font-medium">{id === 'new' ? 'New animation' : 'Edit animation'}</h1>
			<p class="text-xs text-muted-foreground" aria-live="polite">
				{deleting
					? 'Deleting...'
					: busy
						? 'Saving...'
						: error
							? 'Not saved'
							: dirty
								? validation.data
									? 'Unsaved changes'
									: 'Fix JSON to save'
								: id === 'new'
									? 'Changes save automatically'
									: 'Saved'}
			</p>
		</div>
		<div class="ml-auto flex shrink-0 gap-2">
			{#if id !== 'new'}
				<Button
					variant="destructive"
					size="icon"
					disabled={deleting}
					aria-label="Delete animation"
					onclick={() => (deleteOpen = true)}><TrashIcon /></Button
				>
			{/if}
			<Button
				variant="ghost"
				size="icon"
				disabled={deleting}
				aria-label="Close animation editor"
				onclick={() => void dismiss()}><XIcon /></Button
			>
		</div>
	</HeaderBlank>
	<div class="min-h-0 min-w-0 flex-1 muted-scrollbar overflow-x-hidden overflow-y-auto p-4">
		<div class="grid min-w-0 gap-4" inert={deleting}>
			<Field.Field class="min-w-0">
				<Field.Label for={`${uid}-name`}>Name</Field.Label>
				<Input id={`${uid}-name`} bind:value={name} oninput={scheduleAutosave} required />
			</Field.Field>
			<Field.Field class="min-w-0">
				<Field.Label for={`${uid}-config`}>WebMotion configuration (JSON)</Field.Label>
				<Field.Description
					>Edit version, playback, composition, motions and layers. Use text placeholders such as {'${title}'}
					in layers.</Field.Description
				>
				<Textarea
					id={`${uid}-config`}
					bind:value={configJson}
					oninput={scheduleAutosave}
					rows={10}
					class="field-sizing-fixed h-48 min-w-0 resize-y font-mono text-xs [overflow-wrap:anywhere]"
					spellcheck={false}
				/>
				{#if validation.data}
					<Field.Description>
						Duration: {(
							validation.data.configuration.composition.durationInFrames /
							validation.data.configuration.composition.fps
						).toFixed(2)} seconds (derived from frames / FPS).
					</Field.Description>
				{/if}
			</Field.Field>
			<CopyButton
				text={generationGuide}
				variant="outline"
				tabindex={0}
				class="h-auto max-w-full justify-self-start whitespace-normal"
				>Copy LLM generation guide</CopyButton
			>
			<Field.Field class="min-w-0">
				<Field.Label for={`${uid}-texts`}>Translated texts (JSON)</Field.Label>
				<Field.Description
					>Map each placeholder to its default text and language translations, for example {'{"title":{"default":"Hello","nl":"Hallo"}}'}.</Field.Description
				>
				<Textarea
					id={`${uid}-texts`}
					bind:value={textsJson}
					oninput={scheduleAutosave}
					rows={5}
					class="field-sizing-fixed h-28 min-w-0 resize-y font-mono text-xs [overflow-wrap:anywhere]"
					spellcheck={false}
				/>
			</Field.Field>
			{#if validation.error}<p class="text-sm whitespace-pre-wrap text-destructive" role="status">
					{validation.error}
				</p>{/if}
			{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
			{#if previewConfig}
				<div class="aspect-video min-w-0 overflow-hidden rounded-lg border bg-black">
					<WebMotionPlayer
						config={previewConfig}
						controls
						fit="contain"
						class="h-full"
						label={`Preview of ${name || 'animation'}`}
					/>
				</div>
			{/if}
		</div>
	</div>
</div>
