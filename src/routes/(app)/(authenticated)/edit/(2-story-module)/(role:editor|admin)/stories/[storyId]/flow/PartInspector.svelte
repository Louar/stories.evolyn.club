<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';
	import type { findOneStoryById } from '$lib/db/repositories/2-story-module.js';
	import PartEditor from './PartEditor.svelte';

	type Story = Awaited<ReturnType<typeof findOneStoryById>>;
	type Part = Story['parts'][number];

	let {
		story,
		partId = $bindable(),
		onSave
	}: { story: Story; partId?: string; onSave: (part: Part) => void } = $props();

	const sidebar = useSidebar();
	let part = $derived(story.parts.find((item) => item.id === partId));
	let open = $derived(!!partId && !!part);

	const dismiss = () => {
		partId = undefined;
	};
</script>

{#snippet inspector()}
	<div class="relative h-full min-h-0 bg-background">
		{#if part}
			{#key part}
				<PartEditor storyId={story.id} {part} parts={story.parts} {onSave} onDismiss={dismiss} />
			{/key}
		{/if}
	</div>
{/snippet}

{#if sidebar.isMobile}
	<Sheet.Root
		{open}
		onOpenChange={(nextOpen) => {
			if (!nextOpen) dismiss();
		}}
	>
		<Sheet.Content side="right" class="w-[min(100vw,32rem)] max-w-none p-0 [&>button]:hidden">
			<Sheet.Header class="sr-only">
				<Sheet.Title>Part editor</Sheet.Title>
				<Sheet.Description>Edit the selected story part.</Sheet.Description>
			</Sheet.Header>
			{@render inspector()}
		</Sheet.Content>
	</Sheet.Root>
{:else if open}
	<aside class="h-svh w-120 shrink-0 border-l bg-background shadow-sm">
		{@render inspector()}
	</aside>
{/if}
