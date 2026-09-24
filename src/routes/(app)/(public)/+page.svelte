<script lang="ts">
	import { resolve } from '$app/paths';
	import Header from '$lib/components/app/header/app-header-blank.svelte';
	import AppIcon from '$lib/components/app/icon/app-icon.svelte';
	import AvatarMedia from '$lib/components/ui/avatar-media/avatar-media.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { LanguageSwitcher } from '$lib/components/ui/language-switcher';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let client = $derived(data.client);
	let user = $derived(data.authusr);
	let canAuthenticateWithPassword = $derived(data.canAuthenticateWithPassword);
	let title = $derived(client.name ?? 'Client information');
	let userDisplayName = $derived(user?.name ?? user?.email ?? 'Signed in user');
	let userInitials = $derived(user?.abbreviation ?? user?.email?.slice(0, 1).toUpperCase() ?? '?');
	let clientInitials = $derived(client.name?.slice(0, 1).toUpperCase() ?? '?');
</script>

<Header>
	<h1 class="overflow-hidden text-sm whitespace-nowrap">
		{title}
	</h1>
	<LanguageSwitcher class="ml-auto" />
</Header>

<main class="mx-auto w-full max-w-6xl space-y-4 px-3 py-4 sm:px-6 lg:py-8">
	<section class="grid auto-rows-[minmax(10rem,auto)] gap-4 lg:grid-cols-4">
		<Card.Root
			class="relative overflow-hidden border-primary/20 bg-primary text-primary-foreground lg:col-span-2 lg:row-span-2"
		>
			<div
				class="absolute inset-0 z-10 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.35),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.18),transparent)]"
			></div>
			<Card.Header class="min-h-52 justify-between">
				<div class="flex items-start justify-between gap-4">
					<AvatarMedia
						src={client.logo}
						fallback={clientInitials}
						class="size-16 border-primary-foreground/30"
					/>
				</div>
				<div class="space-y-3">
					<Card.Title class="text-3xl tracking-tight sm:text-4xl">{client.name}</Card.Title>
					{#if client.description}
						<Card.Description class="max-w-xl text-primary-foreground/80">
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							{@html client.description}
						</Card.Description>
					{/if}
				</div>
			</Card.Header>
		</Card.Root>

		<Card.Root class="lg:col-span-2">
			<Card.Header>
				<Card.Title class="flex items-center gap-2 text-lg">
					<AppIcon icon="User" />
					Current user
				</Card.Title>
				<Card.Description>Session details for the logged-in visitor.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				{#if user}
					<div class="flex items-center gap-4">
						<AvatarMedia src={user.picture} fallback={userInitials} class="size-14" />
						<div class="min-w-0 flex-1">
							<p class="truncate text-lg font-semibold">{userDisplayName}</p>
							<p class="truncate text-sm text-muted-foreground">
								{user.email ?? 'No email address'}
							</p>
						</div>
					</div>
					<Button href={resolve('/edit/stories')} class="w-full">
						<AppIcon icon="Pencil" class="text-primary-foreground" />
						Open editor
					</Button>
				{:else}
					<div class="space-y-4 rounded-xl border border-dashed p-4">
						<div>
							<p class="font-medium">No user is signed in.</p>
							<p class="text-sm text-muted-foreground">
								There is no authenticated user for this session.
							</p>
						</div>
						{#if canAuthenticateWithPassword}
							<Button href={resolve('/auth')} class="w-full">
								<AppIcon icon="User" class="text-primary-foreground" />
								Sign in
							</Button>
						{/if}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</section>
</main>
