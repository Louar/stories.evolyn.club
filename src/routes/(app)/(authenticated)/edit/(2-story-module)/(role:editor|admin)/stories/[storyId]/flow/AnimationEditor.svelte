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
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import {
		animationSchema,
		resolveAnimationConfig,
		type WebMotionConfig
	} from '$lib/media/animation.js';
	import { EDITORS } from '$lib/states/editors.svelte.js';
	import { UI } from '$lib/states/ui.svelte.js';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import XIcon from '@lucide/svelte/icons/x';
	import { untrack } from 'svelte';
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
	let id = $state(initial?.id ?? 'new');
	let name = $state(initial?.name ?? '');
	let configJson = $state(
		JSON.stringify(
			initial?.configuration ?? {
				version: 1,
				playback: { autoplay: false, loop: false },
				composition: { width: 1920, height: 1080, fps: 30, durationInFrames: 150 },
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
	let saved = $state(false);
	let previewConfig = $state.raw<WebMotionConfig>();
	let previewError = $state('');
	let validation = $derived.by(() => {
		try {
			const config: unknown = JSON.parse(configJson);
			if (!config || typeof config !== 'object' || Array.isArray(config))
				return { error: 'Configuration must be a JSON object.' };
			const result = animationSchema.safeParse({
				configuration: config,
				name,
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
	const persist = async (event: SubmitEvent) => {
		event.preventDefault();
		if (busy || !validation.data) return;
		busy = true;
		error = '';
		try {
			const response = await fetch(`/api/stories/${storyId}/animations/${id}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(validation.data)
			});
			if (!response.ok) throw new Error(`Could not save animation (${response.status}).`);
			const animation: NonNullable<AnimationEditorOutput['animation']> = await response.json();
			id = animation.id;
			saved = true;
			toast.success('Animation saved');
			close({ action: 'persist', animation });
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not save animation.';
		} finally {
			busy = false;
		}
	};
	const remove = async () => {
		if (busy || id === 'new') return;
		busy = true;
		error = '';
		try {
			const response = await fetch(`/api/stories/${storyId}/animations/${id}`, {
				method: 'DELETE'
			});
			if (!response.ok) throw new Error(`Could not delete animation (${response.status}).`);
			close({ action: 'delete', id });
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not delete animation.';
		} finally {
			busy = false;
			deleteOpen = false;
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
			<AlertDialog.Cancel disabled={busy}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				variant="destructive"
				disabled={busy}
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
				{busy ? 'Saving...' : saved ? 'Saved' : 'Save to apply changes'}
			</p>
		</div>
		<div class="ml-auto flex shrink-0 gap-2">
			{#if id !== 'new'}
				<Button
					variant="destructive"
					size="icon"
					disabled={busy}
					aria-label="Delete animation"
					onclick={() => (deleteOpen = true)}><TrashIcon /></Button
				>
			{/if}
			<Button
				variant="ghost"
				size="icon"
				disabled={busy}
				aria-label="Close animation editor"
				onclick={() => close({ action: 'close' })}><XIcon /></Button
			>
		</div>
	</HeaderBlank>
	<form
		class="min-h-0 min-w-0 flex-1 muted-scrollbar overflow-x-hidden overflow-y-auto p-4"
		onsubmit={persist}
		oninput={() => (saved = false)}
	>
		<fieldset disabled={busy} class="grid min-w-0 gap-4">
			<Field.Field class="min-w-0">
				<Field.Label for={`${uid}-name`}>Name</Field.Label>
				<Input id={`${uid}-name`} bind:value={name} required />
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
			<Field.Field class="min-w-0">
				<Field.Label for={`${uid}-texts`}>Translated texts (JSON)</Field.Label>
				<Field.Description
					>Map each placeholder to its default text and language translations, for example {'{"title":{"default":"Hello","nl":"Hallo"}}'}.</Field.Description
				>
				<Textarea
					id={`${uid}-texts`}
					bind:value={textsJson}
					rows={5}
					class="field-sizing-fixed h-28 min-w-0 resize-y font-mono text-xs [overflow-wrap:anywhere]"
					spellcheck={false}
				/>
			</Field.Field>
			{#if validation.error}<p class="text-sm whitespace-pre-wrap text-destructive" role="status">
					{validation.error}
				</p>{/if}
			{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
			<div class="flex flex-wrap gap-2">
				<Button
					type="button"
					variant="outline"
					class="h-auto max-w-full whitespace-normal"
					disabled={!validation.data}
					onclick={() => {
						if (!validation.data) return;
						previewError = '';
						previewConfig = resolveAnimationConfig(validation.data, UI.language);
					}}>Preview / restart ({UI.language})</Button
				>
			</div>
			{#if previewConfig}
				<WebMotionPlayer
					config={previewConfig}
					controls
					class="min-w-0 overflow-hidden rounded-lg"
					label={`Preview of ${name || 'animation'}`}
					onerror={(cause) =>
						(previewError = cause instanceof Error ? cause.message : 'Preview failed.')}
				/>
			{/if}
			{#if previewError}<p class="text-sm text-destructive" role="alert">{previewError}</p>{/if}
			<Button type="submit" disabled={busy || !validation.data}>Save animation</Button>
		</fieldset>
	</form>
</div>
