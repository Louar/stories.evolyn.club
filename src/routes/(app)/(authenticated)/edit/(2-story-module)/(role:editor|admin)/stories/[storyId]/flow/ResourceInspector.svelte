<script lang="ts" module>
	export type EditorSelection =
		| { kind: 'still'; id?: string }
		| { kind: 'video'; id?: string }
		| { kind: 'announcement'; id?: string }
		| { kind: 'quiz'; id?: string }
		| { kind: 'taxonomy'; partId: string }
		| null;
</script>

<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';
	import type {
		findOneAnnouncementById,
		findOneQuizById,
		findOneStillById,
		findOneStoryById,
		findOneVideoById
	} from '$lib/db/repositories/2-story-module.js';
	import AnnouncementEditor from './AnnouncementEditor.svelte';
	import QuizEditor from './QuizEditor.svelte';
	import StillEditor from './StillEditor.svelte';
	import TaxonomyLogicEditor from './TaxonomyLogicEditor.svelte';
	import VideoEditor from './VideoEditor.svelte';

	type Story = Awaited<ReturnType<typeof findOneStoryById>>;
	type TaxonomyDraft = NonNullable<Story['parts'][number]['taxonomyDraftForPart']>;

	let {
		story,
		selection = $bindable(null),
		open = $bindable(false),
		closeStill,
		closeVideo,
		closeAnnouncement,
		closeQuiz,
		closeTaxonomy
	}: {
		story: Story;
		selection?: EditorSelection;
		open?: boolean;
		closeStill: (output: {
			action: 'persist' | 'delete' | 'close';
			id?: string;
			still?: Awaited<ReturnType<typeof findOneStillById>>;
			keepOpen?: boolean;
		}) => void;
		closeVideo: (output: {
			action: 'persist' | 'delete' | 'close';
			id?: string;
			video?: Awaited<ReturnType<typeof findOneVideoById>>;
			keepOpen?: boolean;
		}) => void;
		closeAnnouncement: (output: {
			action: 'persist' | 'delete' | 'close';
			id?: string;
			announcement?: Awaited<ReturnType<typeof findOneAnnouncementById>>;
			keepOpen?: boolean;
		}) => void;
		closeQuiz: (output: {
			action: 'persist' | 'delete' | 'close';
			id?: string;
			quiz?: Awaited<ReturnType<typeof findOneQuizById>>;
			keepOpen?: boolean;
		}) => void;
		closeTaxonomy: (draft?: TaxonomyDraft, keepOpen?: boolean) => void;
	} = $props();

	const sidebar = useSidebar();
	let taxonomyPart = $derived.by(() => {
		const current = selection;
		if (current?.kind !== 'taxonomy') return undefined;
		return story.parts.find((part) => part.id === current.partId);
	});

	// const dismiss = () => {
	// 	open = false;
	// 	selection = null;
	// };
</script>

{#snippet inspector()}
	<div class="relative h-full min-h-0 bg-background">
		<!-- <Button
			type="button"
			variant="ghost"
			size="icon"
			class="absolute top-2 right-2 z-60"
			onclick={dismiss}
			aria-label="Close editor"
		>
			<XIcon />
		</Button> -->
		{#if selection}
			{#key selection.kind === 'taxonomy' ? `${selection.kind}-${selection.partId}` : `${selection.kind}-${selection.id ?? 'new'}`}
				{#if selection.kind === 'still'}
					<StillEditor storyId={story.id} selectedId={selection.id} close={closeStill} />
				{:else if selection.kind === 'video'}
					<VideoEditor storyId={story.id} selectedId={selection.id} close={closeVideo} />
				{:else if selection.kind === 'announcement'}
					<AnnouncementEditor
						storyId={story.id}
						selectedId={selection.id}
						close={closeAnnouncement}
					/>
				{:else if selection.kind === 'quiz'}
					<QuizEditor storyId={story.id} selectedId={selection.id} close={closeQuiz} />
				{:else if taxonomyPart?.taxonomyDraftForPart}
					<TaxonomyLogicEditor
						storyId={story.id}
						partId={taxonomyPart.id}
						draft={taxonomyPart.taxonomyDraftForPart}
						close={closeTaxonomy}
					/>
				{/if}
			{/key}
		{/if}
	</div>
{/snippet}

{#if sidebar.isMobile}
	<Sheet.Root bind:open>
		<Sheet.Content side="left" class="w-[min(100vw,32rem)] max-w-none p-0 [&>button]:hidden">
			<Sheet.Header class="sr-only">
				<Sheet.Title>Resource editor</Sheet.Title>
				<Sheet.Description>Edit the selected story resource.</Sheet.Description>
			</Sheet.Header>
			{@render inspector()}
		</Sheet.Content>
	</Sheet.Root>
{:else if open && selection}
	<aside
		class="fixed inset-y-0 start-(--sidebar-width) z-50 h-svh w-[30rem] border-r bg-background shadow-sm peer-data-[collapsible=offcanvas]:start-0"
	>
		{@render inspector()}
	</aside>
{/if}
