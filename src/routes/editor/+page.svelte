<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as NavigationMenu from '$lib/components/ui/navigation-menu/index.js';
	import { navigationMenuTriggerStyle } from '$lib/components/ui/navigation-menu/navigation-menu-trigger.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import type {
		findOneAnnouncementById,
		findOneQuizById
	} from '$lib/db/repositories/2-stories-module.js';
	import House from '@lucide/svelte/icons/house';
	import TvMinimalPlay from '@lucide/svelte/icons/tv-minimal-play';
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import AnnouncementEditor from './AnnouncementEditor.svelte';
	import Flow from './Flow.svelte';
	import QuizEditor from './QuizEditor.svelte';

	let { data } = $props();
	let story = $derived(data.story);

	let dialogs = $state({ videos: false, announcements: false, quizzes: false });

	const closeAnnouncement = (output: {
		action: 'persist' | 'delete';
		id?: string;
		announcement?: Awaited<ReturnType<typeof findOneAnnouncementById>>;
	}) => {
		const { action, id, announcement } = output;
		if (action === 'delete' && id?.length) {
			story.announcements = story.announcements?.filter((a) => a.id !== id);
		} else if (action === 'persist' && announcement) {
			if (story.announcements?.find((a) => a.id === announcement.id))
				story.announcements = story.announcements.map((a) =>
					a.id === announcement.id ? announcement : a
				);
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
			story.quizzes = story.quizzes?.filter((q) => q.id !== id);
		} else if (action === 'persist' && quiz) {
			if (story.quizzes?.find((q) => q.id === quiz.id))
				story.quizzes = story.quizzes.map((q) => (q.id === quiz.id ? quiz : q));
		}
		dialogs.quizzes = false;
	};
</script>

<div class="absolute inset-x-0 top-0 z-50 mt-4">
	<NavigationMenu.Root class="mx-auto" viewport={false}>
		<NavigationMenu.List class="flex-wrap">
			<NavigationMenu.Item>
				<NavigationMenu.Link>
					{#snippet child()}
						<a href="/docs" class={navigationMenuTriggerStyle()}><House class="size-4" /></a>
					{/snippet}
				</NavigationMenu.Link>
			</NavigationMenu.Item>
			<!-- <NavigationMenu.Item>
				<NavigationMenu.Link>
					{#snippet child()}
						<a href="/docs" class={navigationMenuTriggerStyle()}>Docs</a>
					{/snippet}
				</NavigationMenu.Link>
			</NavigationMenu.Item> -->
			<NavigationMenu.Item class="hidden md:block">
				<NavigationMenu.Trigger>Media</NavigationMenu.Trigger>
				<NavigationMenu.Content>
					<ul class="grid w-75 gap-2">
						<li>
							<NavigationMenu.Link href="##">
								<div class="font-medium">Video's</div>
								<div class="text-muted-foreground">Browse and update video's for this story.</div>
							</NavigationMenu.Link>
							<Separator class="my-2" />
							<NavigationMenu.Link onclick={() => (dialogs.announcements = true)}>
								<div class="font-medium">Announcements</div>
								<div class="text-muted-foreground">
									Browse and update announcements for this story.
								</div>
							</NavigationMenu.Link>
							<NavigationMenu.Link onclick={() => (dialogs.quizzes = true)}>
								<div class="font-medium">Quizzes</div>
								<div class="text-muted-foreground">Browse and update quizzes for this story.</div>
							</NavigationMenu.Link>
						</li>
					</ul>
				</NavigationMenu.Content>
			</NavigationMenu.Item>
			<NavigationMenu.Item>
				<NavigationMenu.Link>
					{#snippet child()}
						<a href="/docs" class={navigationMenuTriggerStyle()}><TvMinimalPlay class="size-4" /></a
						>
					{/snippet}
				</NavigationMenu.Link>
			</NavigationMenu.Item>
		</NavigationMenu.List>
	</NavigationMenu.Root>
</div>

<Dialog.Root bind:open={dialogs.announcements}>
	<AnnouncementEditor
		storyId={story.id}
		announcements={story.announcements}
		close={closeAnnouncement}
	/>
</Dialog.Root>
<Dialog.Root bind:open={dialogs.quizzes}>
	<QuizEditor storyId={story.id} quizzes={story.quizzes} close={closeQuiz} />
</Dialog.Root>

<div class="mx-auto h-screen w-screen overflow-hidden">
	<SvelteFlowProvider>
		<Flow {story} />
	</SvelteFlowProvider>
</div>
