<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as NavigationMenu from '$lib/components/ui/navigation-menu/index.js';
	import { navigationMenuTriggerStyle } from '$lib/components/ui/navigation-menu/navigation-menu-trigger.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import type {
		findOneAnnouncementById,
		findOneQuizById,
		findOneVideoById,
		storySchema
	} from '$lib/db/repositories/2-stories-module.js';
	import { translateLocalizedField } from '$lib/db/schemas/0-utils.js';
	import { EDITORS } from '$lib/states/editors.svelte.js';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import TvMinimalPlayIcon from '@lucide/svelte/icons/tv-minimal-play';
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { onMount } from 'svelte';
	import type { z } from 'zod/v4';
	import AnnouncementEditor from './AnnouncementEditor.svelte';
	import Flow from './Flow.svelte';
	import QuizEditor from './QuizEditor.svelte';
	import StorySettingsEditor from './StorySettingsEditor.svelte';
	import VideoEditor from './VideoEditor.svelte';

	let { data } = $props();
	let story = $derived(data.story);

	onMount(() => {
		EDITORS.videos = story.videos;
		EDITORS.announcements = story.announcements;
		EDITORS.quizzes = story.quizzes;
	});

	let dialogs = $state({ settings: false, videos: false, announcements: false, quizzes: false });

	const closeSettings = (output: {
		action: 'persist' | 'delete';
		data?: z.infer<typeof storySchema>;
	}) => {
		const { action } = output;
		if (action === 'delete') {
			goto('/editor/stories');
		} else if (action === 'persist' && data) {
			story = { ...story, ...data };
		}
		dialogs.settings = false;
	};
	const closeVideo = (output: {
		action: 'persist' | 'delete';
		id?: string;
		video?: Awaited<ReturnType<typeof findOneVideoById>>;
	}) => {
		const { action, id, video } = output;
		if (action === 'delete' && id?.length) {
			EDITORS.videos = EDITORS.videos?.filter((v) => v.id !== id);
		} else if (action === 'persist' && video) {
			if (EDITORS.videos?.find((v) => v.id === video.id))
				EDITORS.videos = EDITORS.videos.map((v) => (v.id === video.id ? video : v));
			else EDITORS.videos = [...EDITORS.videos, video];
		}
		dialogs.videos = false;
	};
	const closeAnnouncement = (output: {
		action: 'persist' | 'delete';
		id?: string;
		announcement?: Awaited<ReturnType<typeof findOneAnnouncementById>>;
	}) => {
		const { action, id, announcement } = output;
		if (action === 'delete' && id?.length) {
			EDITORS.announcements = EDITORS.announcements?.filter((a) => a.id !== id);
		} else if (action === 'persist' && announcement) {
			if (EDITORS.announcements?.find((a) => a.id === announcement.id))
				EDITORS.announcements = EDITORS.announcements.map((a) =>
					a.id === announcement.id ? announcement : a
				);
			else EDITORS.announcements = [...EDITORS.announcements, announcement];
		}
		dialogs.announcements = false;
	};
	const closeQuiz = (output: {
		action: 'persist' | 'delete';
		id?: string;
		quiz?: Awaited<ReturnType<typeof findOneQuizById>>;
	}) => {
		const { action, id, quiz } = output;
		if (action === 'delete' && id?.length) {
			EDITORS.quizzes = EDITORS.quizzes?.filter((q) => q.id !== id);
		} else if (action === 'persist' && quiz) {
			if (EDITORS.quizzes?.find((q) => q.id === quiz.id))
				EDITORS.quizzes = EDITORS.quizzes.map((q) => (q.id === quiz.id ? quiz : q));
			else EDITORS.quizzes = [...EDITORS.quizzes, quiz];
		}
		dialogs.quizzes = false;
	};
</script>

<svelte:head>
	<title>Edit story: {translateLocalizedField(story.name)}</title>
</svelte:head>

<div class="absolute inset-x-0 top-0 z-50 mt-4">
	<NavigationMenu.Root class="mx-auto" viewport={false}>
		<NavigationMenu.List class="flex-wrap">
			<NavigationMenu.Item>
				<NavigationMenu.Link>
					{#snippet child()}
						<!-- <a href="/editor/stories" class={navigationMenuTriggerStyle()}>
							<House class="size-4" />
						</a> -->
						<Sidebar.Trigger class={navigationMenuTriggerStyle()} />
					{/snippet}
				</NavigationMenu.Link>
			</NavigationMenu.Item>
			<NavigationMenu.Item>
				<NavigationMenu.Trigger>
					<SettingsIcon class="mr-2 size-5" />
				</NavigationMenu.Trigger>
				<NavigationMenu.Content>
					<ul class="grid w-75 gap-2">
						<li>
							<NavigationMenu.Link onclick={() => (dialogs.settings = true)}>
								<div class="font-medium">Story settings</div>
								<div class="text-muted-foreground">Update the story's settings.</div>
							</NavigationMenu.Link>
							<Separator class="my-2" />
							<NavigationMenu.Link onclick={() => (dialogs.videos = true)}>
								<div class="font-medium">Video's</div>
								<div class="text-muted-foreground">Browse and update video's.</div>
							</NavigationMenu.Link>
							<NavigationMenu.Link onclick={() => (dialogs.announcements = true)}>
								<div class="font-medium">Announcements</div>
								<div class="text-muted-foreground">Browse and update announcements.</div>
							</NavigationMenu.Link>
							<NavigationMenu.Link onclick={() => (dialogs.quizzes = true)}>
								<div class="font-medium">Quizzes</div>
								<div class="text-muted-foreground">Browse and update quizzes.</div>
							</NavigationMenu.Link>
						</li>
					</ul>
				</NavigationMenu.Content>
			</NavigationMenu.Item>
			<NavigationMenu.Item>
				<NavigationMenu.Link>
					{#snippet child()}
						<a
							href="/stories/{story.reference}"
							target="_blank"
							class={navigationMenuTriggerStyle()}
						>
							<TvMinimalPlayIcon class="size-5" />
						</a>
					{/snippet}
				</NavigationMenu.Link>
			</NavigationMenu.Item>
		</NavigationMenu.List>
	</NavigationMenu.Root>
</div>

<Dialog.Root bind:open={dialogs.settings}>
	<StorySettingsEditor
		storyId={story.id}
		story={{
			reference: story.reference,
			name: story.name,
			isPublished: story.isPublished,
			isPublic: story.isPublic
		}}
		close={closeSettings}
	/>
</Dialog.Root>
<Dialog.Root bind:open={dialogs.videos}>
	<VideoEditor storyId={story.id} close={closeVideo} />
</Dialog.Root>
<Dialog.Root bind:open={dialogs.announcements}>
	<AnnouncementEditor storyId={story.id} close={closeAnnouncement} />
</Dialog.Root>
<Dialog.Root bind:open={dialogs.quizzes}>
	<QuizEditor storyId={story.id} close={closeQuiz} />
</Dialog.Root>

<div class="mx-auto h-screen w-screen overflow-hidden">
	<SvelteFlowProvider>
		<Flow {story} />
	</SvelteFlowProvider>
</div>
