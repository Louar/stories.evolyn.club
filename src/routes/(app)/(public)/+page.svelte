<script lang="ts">
	import { resolve } from '$app/paths';
	import Header from '$lib/components/app/header/app-header-blank.svelte';
	import AppIcon from '$lib/components/app/icon/app-icon.svelte';
	import AvatarMedia from '$lib/components/ui/avatar-media/avatar-media.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { LanguageSwitcher } from '$lib/components/ui/language-switcher';
	import MediaFile from '$lib/components/ui/media-file/media-file.svelte';
	import { UserRole } from '$lib/db/schemas/1-client-user-module.js';
	import { cn } from '$lib/utils';
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import LibraryIcon from '@lucide/svelte/icons/library';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import SunIcon from '@lucide/svelte/icons/sun';
	import { toggleMode } from 'mode-watcher';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let client = $derived(data.client);
	let anthologies = $derived(data.anthologies);
	let user = $derived(data.authusr);
	let canAuthenticateWithPassword = $derived(data.canAuthenticateWithPassword);
	let title = $derived(client.name ?? 'Client information');
	let userDisplayName = $derived(user?.name ?? user?.email ?? 'Signed in user');
	let userInitials = $derived(user?.abbreviation ?? user?.email?.slice(0, 1).toUpperCase() ?? '?');
	let clientInitials = $derived(client.name?.slice(0, 1).toUpperCase() ?? '?');
	let canEdit = $derived(
		user?.roles?.includes(UserRole.admin) || user?.roles?.includes(UserRole.editor)
	);

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
		<div class="ml-auto flex items-center gap-2">
			<LanguageSwitcher />
			<Button onclick={toggleMode} size="icon" variant="outline" aria-label="Toggle theme">
				<SunIcon class="scale-100 transition-all! dark:scale-0 dark:-rotate-90" />
				<MoonIcon class="absolute scale-0 transition-all! dark:scale-100 dark:rotate-0" />
			</Button>

			{#if user}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								size="icon"
								variant="outline"
								aria-label={`Account: ${userDisplayName}`}
							>
								<AvatarMedia
									src={user.picture}
									fallback={userInitials}
									class="size-7 border-0 shadow-none"
								/>
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content class="min-w-64" align="end" sideOffset={6} collisionPadding={8}>
						<DropdownMenu.Label class="p-0 font-normal">
							<div class="flex items-center gap-3 px-2 py-2 text-left">
								<AvatarMedia
									src={user.picture}
									fallback={userInitials}
									class="size-10 rounded-full"
								/>
								<div class="grid min-w-0 flex-1 leading-tight">
									<span class="truncate font-medium">{userDisplayName}</span>
									<span class="truncate text-xs text-muted-foreground"
										>{user.email ?? 'Signed in'}</span
									>
								</div>
							</div>
						</DropdownMenu.Label>
						<DropdownMenu.Separator />
						{#if canEdit}
							<DropdownMenu.Item>
								{#snippet child({ props })}
									<a href={resolve('/edit/stories')} {...props}>
										<PencilIcon />
										<span>Open editor</span>
										<ChevronRightIcon class="ml-auto" />
									</a>
								{/snippet}
							</DropdownMenu.Item>
						{/if}
						<DropdownMenu.Item>
							{#snippet child({ props })}
								<a href={resolve('/auth/logout')} data-sveltekit-reload {...props}>
									<LogOutIcon />
									<span>Sign out</span>
									<ChevronRightIcon class="ml-auto" />
								</a>
							{/snippet}
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			{:else if canAuthenticateWithPassword}
				<Button href={resolve('/auth')} variant="outline">
					<AppIcon icon="User" />
					<span class="hidden sm:inline">Sign in</span>
				</Button>
			{/if}
		</div>
	</div>
</Header>

<main class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
	<section class="grid auto-rows-max gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
		<Card.Root
			class="relative overflow-hidden border-primary/20 bg-primary text-primary-foreground sm:col-span-2"
		>
			<div
				class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.3),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.16),transparent)]"
			></div>
			<Card.Header class="relative min-h-56 justify-between gap-8 sm:flex-row sm:items-center">
				<div class="space-y-4">
					<AvatarMedia
						src={client.logo}
						fallback={clientInitials}
						class="size-14 border-primary-foreground/30"
					/>
					<div class="space-y-2">
						<Card.Title class="text-2xl tracking-tight sm:text-3xl">{client.name}</Card.Title>
						{#if client.description}
							<Card.Description
								class="prose prose-sm line-clamp-3 max-w-2xl text-primary-foreground/75 prose-invert"
							>
								<!-- eslint-disable-next-line svelte/no-at-html-tags -->
								{@html client.description}
							</Card.Description>
						{/if}
					</div>
				</div>
				<div
					class="flex shrink-0 items-center gap-3 rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 p-4 backdrop-blur-sm"
				>
					<LibraryIcon class="size-6" />
					<div>
						<p class="text-2xl leading-none font-semibold">{anthologies.length}</p>
						<p class="mt-1 text-xs text-primary-foreground/70">
							Public {anthologies.length === 1 ? 'anthology' : 'anthologies'}
						</p>
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
							<BookOpenIcon class="size-3" />
							{anthology.storyCount}
							{anthology.storyCount === 1 ? 'story' : 'stories'}
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
						<p class="font-medium">No public anthologies yet</p>
						<p class="mt-1 text-sm text-muted-foreground">
							Published anthologies will appear here.
						</p>
					</div>
				</Card.Content>
			</Card.Root>
		{/each}
	</section>
</main>
