<script lang="ts">
	import * as NavigationMenu from '$lib/components/ui/navigation-menu/index.js';
	import { navigationMenuTriggerStyle } from '$lib/components/ui/navigation-menu/navigation-menu-trigger.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import House from '@lucide/svelte/icons/house';
	import TvMinimalPlay from '@lucide/svelte/icons/tv-minimal-play';
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import Flow from './Flow.svelte';

	let { data } = $props();
	let story = $derived(data.story);
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
							<NavigationMenu.Link href="##">
								<div class="font-medium">Announcements</div>
								<div class="text-muted-foreground">
									Browse and update announcements for this story.
								</div>
							</NavigationMenu.Link>
							<NavigationMenu.Link href="##">
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

<div class="mx-auto h-screen w-screen overflow-hidden">
	<SvelteFlowProvider>
		<Flow {story} />
	</SvelteFlowProvider>
</div>
