<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import HeaderBlank from '$lib/components/app/header/app-header-blank.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
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
	import { UI } from '$lib/states/ui.svelte.js';
	import ChartLineIcon from '@lucide/svelte/icons/chart-no-axes-combined';
	import HouseIcon from '@lucide/svelte/icons/house';
	import ImageIcon from '@lucide/svelte/icons/image';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import LibraryIcon from '@lucide/svelte/icons/library-big';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import ShapesIcon from '@lucide/svelte/icons/shapes';
	import TvMinimalPlayIcon from '@lucide/svelte/icons/tv-minimal-play';
	import VideoIcon from '@lucide/svelte/icons/video';
	import { SvelteFlowProvider, type Viewport } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { onMount } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import type { z } from 'zod/v4';
	import Flow from './Flow.svelte';
	import PartInspector from './PartInspector.svelte';
	import ResourceInspector, {
		type EditorSelection,
		type PartResourceEditorSelection
	} from './ResourceInspector.svelte';
	import StorySettingsEditor from './StorySettingsEditor.svelte';
	import type { AnimationEditorOutput } from './AnimationEditor.svelte';
	import ClapperboardIcon from '@lucide/svelte/icons/clapperboard';
	import {
		getStoryFlowPreferencesKey,
		parseStoryFlowPreferences,
		persistStoryFlowPreferences,
		STORY_FLOW_PREFERENCES_VERSION,
		type StoryFlowPreferences
	} from './story-flow-preferences.js';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let story = $state(data.story);

	let editorSelection = $state<EditorSelection>(null);
	let inspectorOpen = $state(false);
	let selectedTaxonomyPartId = $state<string>();
	let selectedPartId = $state<string>();
	let partScrollPositions = $state<Record<string, number>>({});
	let sidebarOpen = $state(true);
	let mainTab = $state<StoryFlowPreferences['mainTab']>('settings');
	let backgroundTab = $state<StoryFlowPreferences['backgroundTab']>('stills');
	let foregroundTab = $state<StoryFlowPreferences['foregroundTab']>('announcements');
	let viewport = $state<Viewport>();
	let preferencesHydrated = $state(false);
	let preferencesKey = $derived(getStoryFlowPreferencesKey(story.id));
	let selectedPart = $derived(story.parts.find((part) => part.id === selectedPartId));
	const activeCommandItemClass =
		'bg-primary! text-primary-foreground! [&_svg]:text-primary-foreground!';

	const isEditingStill = (id?: string) =>
		editorSelection?.kind === 'still' && editorSelection.id === id;
	const isEditingVideo = (id?: string) =>
		editorSelection?.kind === 'video' && editorSelection.id === id;
	const isAddingVideo = () => editorSelection?.kind === 'video-library';
	const isEditingAnimation = (id?: string) =>
		editorSelection?.kind === 'animation' && editorSelection.id === id;
	const isEditingAnnouncement = (id?: string) =>
		editorSelection?.kind === 'announcement' && editorSelection.id === id;
	const isEditingQuiz = (id?: string) =>
		editorSelection?.kind === 'quiz' && editorSelection.id === id;
	const isEditingTaxonomy = (partId: string) =>
		editorSelection?.kind === 'taxonomy' && editorSelection.partId === partId;

	const reconcileEditorSelection = (selection: EditorSelection): EditorSelection => {
		if (!selection || selection.kind === 'video-library') return selection;
		if (selection.kind === 'taxonomy')
			return story.parts.some((part) => part.id === selection.partId && part.taxonomyDraftForPart)
				? selection
				: null;
		if (!selection.id) return selection;
		if (selection.kind === 'still')
			return story.stills.some((item) => item.id === selection.id) ? selection : null;
		if (selection.kind === 'animation')
			return story.animations.some((item) => item.id === selection.id) ? selection : null;
		if (selection.kind === 'video')
			return story.videos.some((item) => item.id === selection.id) ? selection : null;
		if (selection.kind === 'announcement')
			return story.announcements.some((item) => item.id === selection.id) ? selection : null;
		return story.quizzes.some((item) => item.id === selection.id) ? selection : null;
	};

	let preferences = $derived.by((): StoryFlowPreferences => ({
		version: STORY_FLOW_PREFERENCES_VERSION,
		mainTab,
		backgroundTab,
		foregroundTab,
		sidebarOpen,
		inspectorOpen,
		editorSelection,
		selectedPartId,
		partScrollPositions: { ...partScrollPositions },
		viewport,
		language: UI.language
	}));
	let serializedPreferences = $derived(JSON.stringify(preferences));

	const persistPreferences = (serialized = serializedPreferences) => {
		try {
			persistStoryFlowPreferences(localStorage, story.id, serialized);
		} catch {
			// Persistence is best-effort when storage is unavailable or full.
		}
	};
	const persistStoryFlowState: Attachment<HTMLDivElement> = () => {
		if (!preferencesHydrated) return;
		persistPreferences(serializedPreferences);
	};

	const applyPreferences = (preferences: StoryFlowPreferences) => {
		mainTab = preferences.mainTab;
		backgroundTab = preferences.backgroundTab;
		foregroundTab = preferences.foregroundTab;
		sidebarOpen = preferences.sidebarOpen;
		viewport = preferences.viewport;
		UI.language = preferences.language;
		partScrollPositions = Object.fromEntries(
			Object.entries(preferences.partScrollPositions).filter(([partId]) =>
				story.parts.some((part) => part.id === partId)
			)
		);
		selectedPartId = story.parts.some((part) => part.id === preferences.selectedPartId)
			? preferences.selectedPartId
			: undefined;
		editorSelection = reconcileEditorSelection(preferences.editorSelection);
		selectedTaxonomyPartId =
			editorSelection?.kind === 'taxonomy' ? editorSelection.partId : undefined;
		inspectorOpen = preferences.inspectorOpen && editorSelection !== null;
	};

	onMount(() => {
		EDITORS.videos = story.videos;
		EDITORS.stills = story.stills;
		EDITORS.animations = story.animations;
		EDITORS.announcements = story.announcements;
		EDITORS.quizzes = story.quizzes;
		EDITORS.taxonomies = story.taxonomies;

		try {
			const raw = localStorage.getItem(preferencesKey);
			const preferences = raw ? parseStoryFlowPreferences(raw) : undefined;
			if (preferences) applyPreferences(preferences);
		} catch {
			// Keep defaults when storage cannot be read.
		}
		preferencesHydrated = true;

		const flush = () => {
			if (!preferencesHydrated) return;
			persistPreferences();
		};
		window.addEventListener('pagehide', flush);
		return () => {
			window.removeEventListener('pagehide', flush);
			flush();
		};
	});

	const openStill = (id?: string) => {
		editorSelection = { kind: 'still', id };
		inspectorOpen = true;
	};
	const openAnimation = (id?: string) => {
		editorSelection = { kind: 'animation', id };
		inspectorOpen = true;
	};
	const openVideo = (id?: string) => {
		editorSelection = { kind: 'video', id };
		inspectorOpen = true;
	};
	const openVideoLibrary = () => {
		editorSelection = { kind: 'video-library' };
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
	const canKeepPartEditorOpen = () => {
		const rootFontSize = Number.parseFloat(
			window.getComputedStyle(document.documentElement).fontSize
		);
		const resourceInspectorRight = (sidebarOpen ? 24 : 0) * rootFontSize + 30 * rootFontSize;
		const partInspectorWidth = Math.min(44 * rootFontSize, window.innerWidth - 4 * rootFontSize);

		return resourceInspectorRight <= window.innerWidth - partInspectorWidth;
	};
	const openPartResource = (selection: PartResourceEditorSelection) => {
		if (selection.kind === 'still') {
			mainTab = 'backgrounds';
			backgroundTab = 'stills';
			openStill(selection.id);
		} else if (selection.kind === 'animation') {
			mainTab = 'backgrounds';
			backgroundTab = 'animations';
			openAnimation(selection.id);
		} else if (selection.kind === 'video') {
			mainTab = 'backgrounds';
			backgroundTab = 'videos';
			openVideo(selection.id);
		} else if (selection.kind === 'announcement') {
			mainTab = 'foregrounds';
			foregroundTab = 'announcements';
			openAnnouncement(selection.id);
		} else if (selection.kind === 'quiz') {
			mainTab = 'foregrounds';
			foregroundTab = 'quizzes';
			openQuiz(selection.id);
		} else {
			mainTab = 'foregrounds';
			foregroundTab = 'taxonomies';
			openTaxonomy(selection.partId);
		}

		if (!canKeepPartEditorOpen()) selectedPartId = undefined;
	};
	const addTaxonomyDraft = () => {
		const targetPart = selectedPart ?? story.parts[0];
		if (!targetPart) return;
		if (targetPart.taxonomyDraftForPart) {
			openTaxonomy(targetPart.id);
			return;
		}
		selectedPartId = targetPart.id;
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
	const addVideo = (video?: Awaited<ReturnType<typeof findOneVideoById>>) => {
		if (!video) {
			editorSelection = null;
			inspectorOpen = false;
			return;
		}

		EDITORS.videos = [...EDITORS.videos, video];
		story = { ...story, videos: [...story.videos, video] };
		editorSelection = { kind: 'video', id: video.id };
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
	const closeAnimation = ({ action, id, animation }: AnimationEditorOutput) => {
		if (action === 'persist' && animation) {
			EDITORS.animations = EDITORS.animations.some((item) => item.id === animation.id)
				? EDITORS.animations.map((item) => (item.id === animation.id ? animation : item))
				: [...EDITORS.animations, animation];
			story = { ...story, animations: EDITORS.animations };
			editorSelection = { kind: 'animation', id: animation.id };
		} else {
			if (action === 'delete' && id) {
				if (selectedPart?.animationId === id) selectedPartId = undefined;
				EDITORS.animations = EDITORS.animations.filter((item) => item.id !== id);
				story = {
					...story,
					animations: EDITORS.animations,
					parts: story.parts.map((part) =>
						part.animationId === id
							? { ...part, animationId: null, backgroundType: null, backgroundConfiguration: null }
							: part
					)
				};
			}
			editorSelection = null;
			inspectorOpen = false;
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

<Sidebar.Provider
	{@attach persistStoryFlowState}
	bind:open={sidebarOpen}
	class={preferencesHydrated ? undefined : 'invisible'}
	style="--sidebar-width: 24rem;"
>
	<Sidebar.Root collapsible="offcanvas" class="border-r">
		<Tabs.Root bind:value={mainTab} class="h-full min-h-0 gap-0">
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

			<Sidebar.Content class="muted-scrollbar px-3 py-4">
				<Tabs.Content value="settings" class="min-h-0 flex-1">
					<StorySettingsEditor
						storyId={story.id}
						story={{
							slug: story.slug,
							name: story.name,
							defaultBackgroundColor: story.defaultBackgroundColor,
							thumbnail: story.thumbnail,
							isPublished: story.isPublished,
							isPublic: story.isPublic
						}}
						close={closeSettings}
					/>
				</Tabs.Content>

				<Tabs.Content value="backgrounds">
					<Tabs.Root bind:value={backgroundTab} class="gap-3">
						<Tabs.List class="grid w-full grid-cols-3">
							<Tabs.Trigger value="stills"><ImageIcon />Stills</Tabs.Trigger>
							<Tabs.Trigger value="videos"><VideoIcon />Videos</Tabs.Trigger>
							<Tabs.Trigger value="animations"><ClapperboardIcon />Animations</Tabs.Trigger>
						</Tabs.List>
						<Tabs.Content value="stills">
							<Button
								type="button"
								variant={isEditingStill() ? 'default' : 'outline'}
								class="mb-3 w-full justify-start"
								onclick={() => openStill()}
							>
								<PlusIcon />Create still
							</Button>
							<Command.Root class="border bg-sidebar-accent/30">
								<Command.Input placeholder="Search stills..." />
								<Command.List class="max-h-auto">
									<Command.Empty>No stills found.</Command.Empty>
									<Command.Group>
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
						<Tabs.Content value="animations">
							<Button
								type="button"
								variant={isEditingAnimation() ? 'default' : 'outline'}
								class="mb-3 w-full justify-start"
								onclick={() => openAnimation()}
							>
								<PlusIcon />Create animation
							</Button>
							<Command.Root class="border bg-sidebar-accent/30">
								<Command.Input placeholder="Search animations..." />
								<Command.List class="max-h-auto">
									<Command.Empty>No animations found.</Command.Empty>
									<Command.Group>
										{#each EDITORS.animations as animation (animation.id)}
											<Command.Item
												value={`${animation.name} ${animation.id}`}
												class={isEditingAnimation(animation.id) ? activeCommandItemClass : ''}
												onSelect={() => openAnimation(animation.id)}
											>
												<ClapperboardIcon /><span class="truncate">{animation.name}</span>
											</Command.Item>
										{/each}
									</Command.Group>
								</Command.List>
							</Command.Root>
						</Tabs.Content>
						<Tabs.Content value="videos">
							<div class="mb-3 grid grid-cols-2 gap-2">
								<Button
									type="button"
									variant={isEditingVideo() ? 'default' : 'outline'}
									class="justify-start"
									onclick={() => openVideo()}
								>
									<PlusIcon />Create video
								</Button>
								<Button
									type="button"
									variant={isAddingVideo() ? 'default' : 'outline'}
									class="justify-start"
									onclick={openVideoLibrary}
								>
									<LibraryIcon />Add from library
								</Button>
							</div>
							<Command.Root class="border bg-sidebar-accent/30">
								<Command.Input placeholder="Search videos..." />
								<Command.List class="max-h-auto">
									<Command.Empty>No videos found.</Command.Empty>
									<Command.Group>
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
					<Tabs.Root bind:value={foregroundTab} class="gap-3">
						<Tabs.List class="grid w-full grid-cols-3">
							<Tabs.Trigger value="announcements"><MessageSquareIcon />Notes</Tabs.Trigger>
							<Tabs.Trigger value="quizzes"><ShapesIcon />Quizzes</Tabs.Trigger>
							<Tabs.Trigger value="taxonomies"><LayersIcon />Drafts</Tabs.Trigger>
						</Tabs.List>
						<Tabs.Content value="announcements">
							<Button
								type="button"
								variant={isEditingAnnouncement() ? 'default' : 'outline'}
								class="mb-3 w-full justify-start"
								onclick={() => openAnnouncement()}
							>
								<PlusIcon />Create announcement
							</Button>
							<Command.Root class="border bg-sidebar-accent/30">
								<Command.Input placeholder="Search announcements..." />
								<Command.List class="max-h-auto">
									<Command.Empty>No announcements found.</Command.Empty>
									<Command.Group>
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
							<Button
								type="button"
								variant={isEditingQuiz() ? 'default' : 'outline'}
								class="mb-3 w-full justify-start"
								onclick={() => openQuiz()}
							>
								<PlusIcon />Create quiz
							</Button>
							<Command.Root class="border bg-sidebar-accent/30">
								<Command.Input placeholder="Search quizzes..." />
								<Command.List class="max-h-auto">
									<Command.Empty>No quizzes found.</Command.Empty>
									<Command.Group>
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
							<Button
								type="button"
								variant={editorSelection?.kind === 'taxonomy' ? 'default' : 'outline'}
								class="mb-3 w-full justify-start"
								disabled={!story.parts.length}
								onclick={addTaxonomyDraft}
							>
								<PlusIcon />Add taxonomy draft
							</Button>
							<Command.Root class="border bg-sidebar-accent/30">
								<Command.Input placeholder="Search taxonomy drafts..." />
								<Command.List class="max-h-auto">
									<Command.Empty>No taxonomy drafts in this flow.</Command.Empty>
									<Command.Group>
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
		{closeAnimation}
		{closeVideo}
		{addVideo}
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
					href={resolve(`/edit/stories/${data.story.id}/analytics`)}
					target="_blank"
					variant="outline"
					size="icon"
					aria-label="Analyze story"
				>
					<ChartLineIcon />
				</Button>
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
			{#if preferencesHydrated}
				<SvelteFlowProvider>
					<Flow
						{story}
						{selectedPartId}
						{viewport}
						onViewportChange={(nextViewport) => (viewport = nextViewport)}
						onSelectPart={(partId) => (selectedPartId = partId)}
						onPartSaved={replacePart}
						onPartCreated={addPart}
						onPartDeleted={removePart}
						onConnectionChange={updateConnection}
					/>
				</SvelteFlowProvider>
			{/if}
		</div>
	</Sidebar.Inset>
	<PartInspector
		{story}
		bind:partId={selectedPartId}
		bind:scrollPositions={partScrollPositions}
		onSave={replacePart}
		onDelete={removePart}
		onOpenResource={openPartResource}
	/>
</Sidebar.Provider>
