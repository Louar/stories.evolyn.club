<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import HeaderBlank from '$lib/components/app/header/app-header-blank.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { LanguageSelector } from '$lib/components/ui/language-selector/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import type {
		findOneAnnouncementById,
		findOneQuizById,
		findOneStillById,
		findOneVideoById,
		storySchema
	} from '$lib/db/repositories/2-story-module.js';
	import { translateLocalizedField } from '$lib/db/schemas/0-utils.js';
	import { EDITORS } from '$lib/states/editors.svelte.js';
	import HouseIcon from '@lucide/svelte/icons/house';
	import ImageIcon from '@lucide/svelte/icons/image';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import ShapesIcon from '@lucide/svelte/icons/shapes';
	import TvMinimalPlayIcon from '@lucide/svelte/icons/tv-minimal-play';
	import VideoIcon from '@lucide/svelte/icons/video';
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { onMount } from 'svelte';
	import type { z } from 'zod/v4';
	import Flow from './Flow.svelte';
	import PartInspector from './PartInspector.svelte';
	import ResourceInspector, { type EditorSelection } from './ResourceInspector.svelte';
	import StorySettingsEditor from './StorySettingsEditor.svelte';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let story = $state(data.story);

	onMount(() => {
		EDITORS.videos = story.videos;
		EDITORS.stills = story.stills;
		EDITORS.announcements = story.announcements;
		EDITORS.quizzes = story.quizzes;
		EDITORS.taxonomies = story.taxonomies;
	});

	let editorSelection = $state<EditorSelection>(null);
	let inspectorOpen = $state(false);
	let selectedTaxonomyPartId = $state<string>();
	let selectedPartId = $state<string>();
	const activeCommandItemClass =
		'bg-primary! text-primary-foreground! [&_svg]:text-primary-foreground!';

	const isEditingStill = (id?: string) =>
		editorSelection?.kind === 'still' && editorSelection.id === id;
	const isEditingVideo = (id?: string) =>
		editorSelection?.kind === 'video' && editorSelection.id === id;
	const isEditingAnnouncement = (id?: string) =>
		editorSelection?.kind === 'announcement' && editorSelection.id === id;
	const isEditingQuiz = (id?: string) =>
		editorSelection?.kind === 'quiz' && editorSelection.id === id;
	const isEditingTaxonomy = (partId: string) =>
		editorSelection?.kind === 'taxonomy' && editorSelection.partId === partId;

	const openStill = (id?: string) => {
		editorSelection = { kind: 'still', id };
		inspectorOpen = true;
	};
	const openVideo = (id?: string) => {
		editorSelection = { kind: 'video', id };
		inspectorOpen = true;
	};
	const openAnnouncement = (id?: string) => {
		editorSelection = { kind: 'announcement', id };
		inspectorOpen = true;
	};
	const openQuiz = (id?: string) => {
		editorSelection = { kind: 'quiz', id };
		inspectorOpen = true;
	};
	const openTaxonomy = (partId: string) => {
		selectedTaxonomyPartId = partId;
		editorSelection = { kind: 'taxonomy', partId };
		inspectorOpen = true;
	};

	const closeSettings = (output: {
		action: 'persist' | 'delete';
		data?: z.infer<typeof storySchema>;
	}) => {
		const { action, data: saved } = output;
		if (action === 'delete') {
			goto(resolve('/edit/stories'));
		} else if (action === 'persist' && saved) {
			story = { ...story, ...saved };
		}
	};
	const closeVideo = (output: {
		action: 'persist' | 'delete' | 'close';
		id?: string;
		video?: Awaited<ReturnType<typeof findOneVideoById>>;
		keepOpen?: boolean;
	}) => {
		const { action, id, video, keepOpen } = output;
		if (action === 'close') {
			editorSelection = null;
			inspectorOpen = false;
		} else if (action === 'delete' && id?.length) {
			EDITORS.videos = EDITORS.videos?.filter((v) => v.id !== id);
			story = { ...story, videos: story.videos.filter((item) => item.id !== id) };
			editorSelection = null;
			inspectorOpen = false;
		} else if (action === 'persist' && video) {
			if (EDITORS.videos?.find((v) => v.id === video.id))
				EDITORS.videos = EDITORS.videos.map((v) => (v.id === video.id ? video : v));
			else EDITORS.videos = [...EDITORS.videos, video];
			story = {
				...story,
				videos: story.videos.some((item) => item.id === video.id)
					? story.videos.map((item) => (item.id === video.id ? video : item))
					: [...story.videos, video]
			};
			if (!keepOpen) editorSelection = { kind: 'video', id: video.id };
		}
	};
	const closeStill = (output: {
		action: 'persist' | 'delete' | 'close';
		id?: string;
		still?: Awaited<ReturnType<typeof findOneStillById>>;
		keepOpen?: boolean;
	}) => {
		const { action, id, still, keepOpen } = output;
		if (action === 'close') {
			editorSelection = null;
			inspectorOpen = false;
		} else if (action === 'delete' && id?.length) {
			EDITORS.stills = EDITORS.stills.filter((item) => item.id !== id);
			story = { ...story, stills: story.stills.filter((item) => item.id !== id) };
			editorSelection = null;
			inspectorOpen = false;
		} else if (action === 'persist' && still) {
			if (EDITORS.stills.find((item) => item.id === still.id))
				EDITORS.stills = EDITORS.stills.map((item) => (item.id === still.id ? still : item));
			else EDITORS.stills = [...EDITORS.stills, still];
			story = {
				...story,
				stills: story.stills.some((item) => item.id === still.id)
					? story.stills.map((item) => (item.id === still.id ? still : item))
					: [...story.stills, still]
			};
			if (!keepOpen) editorSelection = { kind: 'still', id: still.id };
		}
	};
	const closeAnnouncement = (output: {
		action: 'persist' | 'delete' | 'close';
		id?: string;
		announcement?: Awaited<ReturnType<typeof findOneAnnouncementById>>;
		keepOpen?: boolean;
	}) => {
		const { action, id, announcement, keepOpen } = output;
		if (action === 'close') {
			editorSelection = null;
			inspectorOpen = false;
		} else if (action === 'delete' && id?.length) {
			EDITORS.announcements = EDITORS.announcements?.filter((a) => a.id !== id);
			story = {
				...story,
				announcements: story.announcements.filter((item) => item.id !== id)
			};
			editorSelection = null;
			inspectorOpen = false;
		} else if (action === 'persist' && announcement) {
			if (EDITORS.announcements?.find((a) => a.id === announcement.id))
				EDITORS.announcements = EDITORS.announcements.map((a) =>
					a.id === announcement.id ? announcement : a
				);
			else EDITORS.announcements = [...EDITORS.announcements, announcement];
			story = {
				...story,
				announcements: story.announcements.some((item) => item.id === announcement.id)
					? story.announcements.map((item) => (item.id === announcement.id ? announcement : item))
					: [...story.announcements, announcement]
			};
			if (!keepOpen) editorSelection = { kind: 'announcement', id: announcement.id };
		}
	};
	const closeQuiz = (output: {
		action: 'persist' | 'delete' | 'close';
		id?: string;
		quiz?: Awaited<ReturnType<typeof findOneQuizById>>;
		keepOpen?: boolean;
	}) => {
		const { action, id, quiz, keepOpen } = output;
		if (action === 'close') {
			editorSelection = null;
			inspectorOpen = false;
		} else if (action === 'delete' && id?.length) {
			EDITORS.quizzes = EDITORS.quizzes?.filter((q) => q.id !== id);
			story = { ...story, quizzes: story.quizzes.filter((item) => item.id !== id) };
			editorSelection = null;
			inspectorOpen = false;
		} else if (action === 'persist' && quiz) {
			if (EDITORS.quizzes?.find((q) => q.id === quiz.id))
				EDITORS.quizzes = EDITORS.quizzes.map((q) => (q.id === quiz.id ? quiz : q));
			else EDITORS.quizzes = [...EDITORS.quizzes, quiz];
			story = {
				...story,
				quizzes: story.quizzes.some((item) => item.id === quiz.id)
					? story.quizzes.map((item) => (item.id === quiz.id ? quiz : item))
					: [...story.quizzes, quiz]
			};
			if (!keepOpen) editorSelection = { kind: 'quiz', id: quiz.id };
		}
	};
	const closeTaxonomy = (
		draft?: NonNullable<(typeof story.parts)[number]['taxonomyDraftForPart']>
	) => {
		if (draft && selectedTaxonomyPartId) {
			story = {
				...story,
				parts: story.parts.map((part) =>
					part.id === selectedTaxonomyPartId ? { ...part, taxonomyDraftForPart: draft } : part
				)
			};
		}
	};

	const replacePart = (savedPart: (typeof story.parts)[number]) => {
		story = {
			...story,
			parts: story.parts.map((part) => (part.id === savedPart.id ? savedPart : part))
		};
	};

	const addPart = (part: (typeof story.parts)[number]) => {
		story = { ...story, parts: [...story.parts, part] };
	};

	const removePart = (partId: string) => {
		story = { ...story, parts: story.parts.filter((part) => part.id !== partId) };
		if (selectedPartId === partId) selectedPartId = undefined;
	};

	const updateConnection = (sourceId: string, handle: string, targetId: string | null) => {
		story = {
			...story,
			parts: story.parts.map((part) => {
				if (part.id !== sourceId) return part;
				if (handle === 'default') return { ...part, defaultNextPartId: targetId };
				if (handle === 'default-after-quiz' && part.quizLogicForPart)
					return {
						...part,
						quizLogicForPart: { ...part.quizLogicForPart, defaultNextPartId: targetId }
					};
				if (handle === 'default-after-taxonomy' && part.taxonomyDraftForPart)
					return {
						...part,
						taxonomyDraftForPart: { ...part.taxonomyDraftForPart, defaultNextPartId: targetId }
					};
				if (handle.startsWith('taxonomy-rule:') && part.taxonomyDraftForPart)
					return {
						...part,
						taxonomyDraftForPart: {
							...part.taxonomyDraftForPart,
							rules: part.taxonomyDraftForPart.rules.map((rule) =>
								rule.id === handle.slice('taxonomy-rule:'.length)
									? { ...rule, nextPartId: targetId }
									: rule
							)
						}
					};
				if (part.quizLogicForPart)
					return {
						...part,
						quizLogicForPart: {
							...part.quizLogicForPart,
							rules: part.quizLogicForPart.rules.map((rule) =>
								rule.id === handle ? { ...rule, nextPartId: targetId } : rule
							)
						}
					};
				return part;
			})
		};
	};
</script>

<svelte:head>
	<title>Edit story: {translateLocalizedField(story.name)}</title>
</svelte:head>

<Sidebar.Provider style="--sidebar-width: 24rem;">
	<Sidebar.Root collapsible="offcanvas" class="border-r">
		<Tabs.Root value="settings" class="h-full min-h-0 gap-4">
			<Sidebar.Header class="-mt-px border-b p-0">
				<div class="flex h-16 w-full shrink-0 items-center">
					<div class="grid size-16 place-items-center border-r">
						<Button
							href={resolve('/edit/stories')}
							variant="ghost"
							size="icon"
							aria-label="Back to stories"
						>
							<HouseIcon />
						</Button>
					</div>
					<Tabs.List variant="line" class="grid h-16 flex-1 grid-cols-3 px-0">
						<Tabs.Trigger value="settings"><SettingsIcon />Settings</Tabs.Trigger>
						<Tabs.Trigger value="backgrounds"><ImageIcon />Back</Tabs.Trigger>
						<Tabs.Trigger value="foregrounds"><LayersIcon />Front</Tabs.Trigger>
					</Tabs.List>
				</div>
			</Sidebar.Header>

			<Sidebar.Content class="px-3 py-0">
				<Tabs.Content value="settings" class="min-h-0 flex-1 overflow-hidden">
					<Dialog.Root>
						<StorySettingsEditor
							embedded
							storyId={story.id}
							story={{
								slug: story.slug,
								name: story.name,
								defaultBackgroundColor: story.defaultBackgroundColor,
								isPublished: story.isPublished,
								isPublic: story.isPublic
							}}
							close={closeSettings}
						/>
					</Dialog.Root>
				</Tabs.Content>

				<Tabs.Content value="backgrounds">
					<Tabs.Root value="stills" class="gap-3">
						<Tabs.List class="grid w-full grid-cols-2">
							<Tabs.Trigger value="stills"><ImageIcon />Stills</Tabs.Trigger>
							<Tabs.Trigger value="videos"><VideoIcon />Videos</Tabs.Trigger>
						</Tabs.List>
						<Tabs.Content value="stills">
							<Command.Root class="border bg-sidebar-accent/30">
								<Command.Input placeholder="Search stills..." />
								<Command.List class="max-h-[calc(100svh-15rem)]">
									<Command.Empty>No stills found.</Command.Empty>
									<Command.Group heading="Background stills">
										<Command.Item
											value="create new still"
											class={isEditingStill() ? activeCommandItemClass : ''}
											onSelect={() => openStill()}><PlusIcon />Create still</Command.Item
										>
										{#each EDITORS.stills as still (still.id)}
											<Command.Item
												value={`${still.image?.filename ?? ''} ${still.color ?? ''}`}
												class={isEditingStill(still.id) ? activeCommandItemClass : ''}
												onSelect={() => openStill(still.id)}
											>
												<ImageIcon /><span class="truncate"
													>{still.image?.filename ?? still.color ?? 'Untitled still'}</span
												>
											</Command.Item>
										{/each}
									</Command.Group>
								</Command.List>
							</Command.Root>
						</Tabs.Content>
						<Tabs.Content value="videos">
							<Command.Root class="border bg-sidebar-accent/30">
								<Command.Input placeholder="Search videos..." />
								<Command.List class="max-h-[calc(100svh-15rem)]">
									<Command.Empty>No videos found.</Command.Empty>
									<Command.Group heading="Background videos">
										<Command.Item
											value="create new video"
											class={isEditingVideo() ? activeCommandItemClass : ''}
											onSelect={() => openVideo()}><PlusIcon />Create video</Command.Item
										>
										{#each EDITORS.videos as video (video.id)}
											<Command.Item
												value={video.name}
												class={isEditingVideo(video.id) ? activeCommandItemClass : ''}
												onSelect={() => openVideo(video.id)}
												><VideoIcon /><span class="truncate">{video.name}</span></Command.Item
											>
										{/each}
									</Command.Group>
								</Command.List>
							</Command.Root>
						</Tabs.Content>
					</Tabs.Root>
				</Tabs.Content>

				<Tabs.Content value="foregrounds">
					<Tabs.Root value="announcements" class="gap-3">
						<Tabs.List class="grid w-full grid-cols-3">
							<Tabs.Trigger value="announcements"><MessageSquareIcon />Notes</Tabs.Trigger>
							<Tabs.Trigger value="quizzes"><ShapesIcon />Quizzes</Tabs.Trigger>
							<Tabs.Trigger value="taxonomies"><LayersIcon />Drafts</Tabs.Trigger>
						</Tabs.List>
						<Tabs.Content value="announcements">
							<Command.Root class="border bg-sidebar-accent/30">
								<Command.Input placeholder="Search announcements..." />
								<Command.List class="max-h-[calc(100svh-15rem)]"
									><Command.Empty>No announcements found.</Command.Empty><Command.Group
										heading="Foreground announcements"
									>
										<Command.Item
											value="create new announcement"
											class={isEditingAnnouncement() ? activeCommandItemClass : ''}
											onSelect={() => openAnnouncement()}
											><PlusIcon />Create announcement</Command.Item
										>
										{#each EDITORS.announcements as announcement (announcement.id)}<Command.Item
												value={announcement.name}
												class={isEditingAnnouncement(announcement.id) ? activeCommandItemClass : ''}
												onSelect={() => openAnnouncement(announcement.id)}
												><MessageSquareIcon /><span class="truncate">{announcement.name}</span
												></Command.Item
											>{/each}
									</Command.Group></Command.List
								>
							</Command.Root>
						</Tabs.Content>
						<Tabs.Content value="quizzes">
							<Command.Root class="border bg-sidebar-accent/30">
								<Command.Input placeholder="Search quizzes..." />
								<Command.List class="max-h-[calc(100svh-15rem)]"
									><Command.Empty>No quizzes found.</Command.Empty><Command.Group
										heading="Foreground quizzes"
									>
										<Command.Item
											value="create new quiz"
											class={isEditingQuiz() ? activeCommandItemClass : ''}
											onSelect={() => openQuiz()}><PlusIcon />Create quiz</Command.Item
										>
										{#each EDITORS.quizzes as quiz (quiz.id)}<Command.Item
												value={quiz.name}
												class={isEditingQuiz(quiz.id) ? activeCommandItemClass : ''}
												onSelect={() => openQuiz(quiz.id)}
												><ShapesIcon />
												<div>
													<p>{quiz.name}</p>
													<p class="text-xs text-muted-foreground">
														{quiz.questions.length} questions
													</p>
												</div></Command.Item
											>{/each}
									</Command.Group></Command.List
								>
							</Command.Root>
						</Tabs.Content>
						<Tabs.Content value="taxonomies">
							<Command.Root class="border bg-sidebar-accent/30">
								<Command.Input placeholder="Search taxonomy drafts..." />
								<Command.List class="max-h-[calc(100svh-15rem)]"
									><Command.Empty>No taxonomy drafts in this flow.</Command.Empty><Command.Group
										heading="Taxonomy drafts"
									>
										{#each story.parts.filter((part) => part.taxonomyDraftForPart) as part (part.id)}
											<Command.Item
												value={`${part.taxonomyDraftForPart?.taxonomyName ?? ''} ${part.id}`}
												class={isEditingTaxonomy(part.id) ? activeCommandItemClass : ''}
												onSelect={() => openTaxonomy(part.id)}
												><LayersIcon />
												<div>
													<p>{part.taxonomyDraftForPart?.taxonomyName}</p>
													<p class="truncate font-mono text-xs text-muted-foreground">
														Part {part.id}
													</p>
												</div></Command.Item
											>
										{/each}
									</Command.Group></Command.List
								>
							</Command.Root>
						</Tabs.Content>
					</Tabs.Root>
				</Tabs.Content>
			</Sidebar.Content>
		</Tabs.Root>
	</Sidebar.Root>
	<ResourceInspector
		{story}
		bind:selection={editorSelection}
		bind:open={inspectorOpen}
		{closeStill}
		{closeVideo}
		{closeAnnouncement}
		{closeQuiz}
		{closeTaxonomy}
	/>
	<Sidebar.Inset class="h-svh min-w-0 overflow-hidden">
		<HeaderBlank class="z-40 w-full">
			<Sidebar.Trigger class="-ml-1" />
			<Separator orientation="vertical" class="mr-2 data-[orientation=vertical]:h-4" />
			<h1 class="truncate overflow-hidden text-sm whitespace-nowrap">
				{translateLocalizedField(story.name)}
			</h1>
			<div class="ml-auto flex items-center gap-2">
				<LanguageSelector />
				<Button
					href={resolve(`/s/${story.slug}` as '/s/[storySlug]/[...settings]')}
					target="_blank"
					variant="outline"
					size="icon"
					aria-label="Preview story"
				>
					<TvMinimalPlayIcon />
				</Button>
			</div>
		</HeaderBlank>
		<div class="min-h-0 flex-1">
			<SvelteFlowProvider>
				<Flow
					{story}
					onSelectPart={(partId) => (selectedPartId = partId)}
					onPartSaved={replacePart}
					onPartCreated={addPart}
					onPartDeleted={removePart}
					onConnectionChange={updateConnection}
				/>
			</SvelteFlowProvider>
		</div>
	</Sidebar.Inset>
	<PartInspector {story} bind:partId={selectedPartId} onSave={replacePart} />
</Sidebar.Provider>
