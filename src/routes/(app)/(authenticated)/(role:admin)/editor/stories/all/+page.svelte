<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import * as Item from '$lib/components/ui/item/index.js';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import Header from '$lib/components/app/header/app-header.svelte';

	let { data } = $props();
	let stories = $derived(data.stories);
</script>

<div class="mx-auto w-full max-w-xl">
	<Header>
		<h1 class="overflow-hidden text-sm whitespace-nowrap">All stories</h1>
	</Header>
</div>

<div class="mx-auto w-full max-w-xl">
	{#if stories.length}
		<div class="grid w-full gap-4 p-4">
			{#each stories as story}
				<a href="/edit/stories/{story.id}">
					<Item.Root variant="outline">
						<Item.Content>
							<Item.Title>{story.name}</Item.Title>
							<Item.Description>
								Status: {story.isPublished ? 'Published' : 'Draft'}, Visibility: {story.isPublic
									? 'Public'
									: 'Private'}
							</Item.Description>
						</Item.Content>
						<Item.Actions>
							<ChevronRightIcon class="size-4" />
						</Item.Actions>
					</Item.Root>
				</a>
			{/each}
		</div>
	{:else}
		<Empty.Root>
			<Empty.Header>
				<Empty.Media variant="icon">
					<BookOpenIcon />
				</Empty.Media>
				<Empty.Title>No stories yet</Empty.Title>
				<Empty.Description>Create your first story to get started.</Empty.Description>
			</Empty.Header>
			<Empty.Content>
				<div class="flex gap-2">
					<Button href="/edit/stories/new/flow">Create story</Button>
				</div>
			</Empty.Content>
		</Empty.Root>
	{/if}
</div>
