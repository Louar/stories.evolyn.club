<script lang="ts">
	import { resolve } from '$app/paths';
	import Header from '$lib/components/app/header/app-header-blank.svelte';
	import AppHeaderControls from '$lib/components/app/header/app-header-controls.svelte';
	import AvatarMedia from '$lib/components/ui/avatar-media/avatar-media.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card/index.js';
	import MediaFile from '$lib/components/ui/media-file/media-file.svelte';
	import * as m from '$lib/paraglide/messages';
	import { cn } from '$lib/utils';
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import LibraryIcon from '@lucide/svelte/icons/library';
	import PlayIcon from '@lucide/svelte/icons/square-play';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let authclient = $derived(data.authclient);
	let client = $derived(data.client);
	let anthologies = $derived(
		[...data.anthologies].sort(
			(a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
		)
	);
	let user = $derived(data.authusr);
	let title = $derived(client.name ?? 'Client information');
	let clientInitials = $derived(client.name?.slice(0, 1).toUpperCase() ?? '?');

	const anthologyCardClass = (index: number) =>
		cn(
			'group relative min-h-0 overflow-hidden border-border/70 bg-card shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg',
			index % 7 === 0 && 'sm:col-span-2 md:col-span-1 xl:col-span-2',
			index % 7 === 3 && 'md:col-span-2 xl:col-span-2',
			index % 7 === 5 && 'sm:col-span-2 md:col-span-1 xl:col-span-1'
		);
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<Header>
	<div class="mx-auto flex h-16 max-w-7xl shrink-0 grow items-center gap-2 px-4 sm:px-6 lg:px-8">
		<h1 class="overflow-hidden text-sm whitespace-nowrap">
			{title}
		</h1>
		<AppHeaderControls client={authclient} authusr={user} />
	</div>
</Header>

<main class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
	<section class="grid auto-rows-max gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
		<Card.Root
			class="relative overflow-hidden border-accent/20 bg-accent text-accent-foreground sm:col-span-2"
		>
			<div
				class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.3),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.16),transparent)]"
			></div>
			<Card.Header class="relative min-h-56 justify-between gap-8 sm:flex-row sm:items-center">
				<div class="space-y-4">
					<AvatarMedia
						src={client.logo}
						fallback={clientInitials}
						class="size-14 border-accent-foreground/30"
					/>
					<div class="space-y-2">
						<Card.Title class="text-2xl tracking-tight sm:text-3xl">{client.name}</Card.Title>
						{#if client.description}
							<Card.Description
								class="prose prose-sm max-w-2xl text-accent-foreground/75"
							>
								<!-- eslint-disable-next-line svelte/no-at-html-tags -->
								{@html client.description}
							</Card.Description>
						{/if}
					</div>
				</div>
			</Card.Header>
		</Card.Root>

		{#each anthologies as anthology, index (anthology.id)}
			<Card.Root class="pt-0 {anthologyCardClass(index)}">
				<a
					href={resolve('/(app)/(public)/(2-story-module)/[anthologySlug]/[...settings]', {
						anthologySlug: anthology.slug,
						settings: ''
					})}
					class="flex h-full flex-col focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
				>
					<div
						class="relative aspect-video overflow-hidden bg-muted sm:aspect-16/8 md:aspect-4/3 xl:aspect-video"
					>
						{#if anthology.thumbnail}
							<MediaFile
								src={anthology.thumbnail}
								class="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.03]"
							/>
							<div
								class="absolute inset-0 bg-linear-to-t from-black/20 via-transparent to-transparent"
							></div>
						{:else}
							<div
								class="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,var(--color-primary),transparent_55%)] opacity-15 transition duration-500 group-hover:scale-110 group-hover:opacity-25"
							></div>
							<LibraryIcon
								class="absolute top-1/2 left-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/35 transition duration-300 group-hover:scale-110 group-hover:text-primary/60"
							/>
						{/if}

						<Badge
							variant="secondary"
							class="absolute top-3 left-3 gap-1.5 border border-border/50 bg-background/85 shadow-sm backdrop-blur-md"
						>
							<PlayIcon class="size-3" />
							{anthology.storyCount}
							{anthology.storyCount === 1
								? m.public_anthology_item_singular()
								: m.public_anthology_item_plural()}
						</Badge>
					</div>

					<div class="flex items-start gap-4 p-4 sm:p-5">
						<div class="min-w-0 flex-1">
							<Card.Title class="line-clamp-2 text-lg leading-snug sm:text-xl">
								{anthology.name ?? anthology.slug}
							</Card.Title>
							{#if anthology.description}
								<Card.Description
									class="prose prose-sm mt-2 line-clamp-2 max-w-none text-muted-foreground dark:prose-invert"
								>
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									{@html anthology.description}
								</Card.Description>
							{/if}
						</div>
						<ArrowUpRightIcon
							class="mt-0.5 size-4.5 shrink-0 text-muted-foreground/70 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary"
						/>
					</div>
				</a>
			</Card.Root>
		{:else}
			<Card.Root
				class="grid min-h-56 place-items-center border-dashed bg-muted/20 text-center sm:col-span-2"
			>
				<Card.Content class="max-w-sm space-y-3 pt-6">
					<LibraryIcon class="mx-auto size-10 text-muted-foreground/50" />
					<div>
						<p class="font-medium">{m.public_anthologies_empty_title()}</p>
						<p class="mt-1 text-sm text-muted-foreground">
							{m.public_anthologies_empty_description()}
						</p>
					</div>
				</Card.Content>
			</Card.Root>
		{/each}
	</section>
</main>
