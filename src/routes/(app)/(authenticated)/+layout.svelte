<script lang="ts">
	import { page } from '$app/state';
	import AvatarMedia from '$lib/components/ui/avatar-media/avatar-media.svelte';

	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { useSidebar } from '$lib/components/ui/sidebar';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { UserRole } from '$lib/db/schemas/1-client-user-module.js';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SunIcon from '@lucide/svelte/icons/sun';
	import { toggleMode } from 'mode-watcher';

	let { children, data } = $props();

	let authusr = $derived(data.authusr!);

	const sidebar = useSidebar();
</script>

<Sidebar.Provider>
	<Sidebar.Root>
		<Sidebar.Header class="border-b px-0 empty:border-0">
			<Sidebar.Menu>
				<Sidebar.MenuItem class="px-2">
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							{#snippet child({ props })}
								<Sidebar.MenuButton
									{...props}
									size="lg"
									class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
								>
									<AvatarMedia
										src={authusr.picture}
										fallback={authusr.abbreviation}
										class="size-8 rounded-full"
									/>
									<div class="grid flex-1 text-left text-sm leading-tight">
										<span class="truncate text-xs text-muted-foreground">Mijn account</span>
										<span class="truncate font-medium">{authusr.name ?? 'Anoniem account'}</span>
									</div>
									<ChevronsUpDownIcon class="ml-auto size-4" />
								</Sidebar.MenuButton>
							{/snippet}
						</DropdownMenu.Trigger>
						<DropdownMenu.Content
							class="w-(--bits-dropdown-menu-anchor-width) min-w-56 rounded-lg"
							side={sidebar?.isMobile ? 'bottom' : 'right'}
							align="end"
							sideOffset={4}
						>
							<DropdownMenu.Label class="p-0 font-normal">
								<div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
									<AvatarMedia
										src={authusr.picture}
										fallback={authusr.abbreviation}
										class="size-8 rounded-full"
									/>
									<div class="grid flex-1 text-left text-sm leading-tight">
										<span class="truncate text-xs text-muted-foreground">Mijn account</span>
										<span class="truncate font-medium">{authusr.name ?? 'Anoniem account'}</span>
									</div>
								</div>
							</DropdownMenu.Label>
							<DropdownMenu.Separator />
							<DropdownMenu.Group>
								<!-- <DropdownMenu.Item onclick={() => setOpenMobile(false)}>
						{#snippet child({ props })}
							<a href="/{page.params.x}/settings/account" {...props}>
								<BadgeCheckIcon />
								<span>Account</span>
								<ChevronRightIcon class="ml-auto" />
							</a>
						{/snippet}
					</DropdownMenu.Item> -->
							</DropdownMenu.Group>
							<DropdownMenu.Separator />
							<DropdownMenu.Group>
								<DropdownMenu.Item onclick={toggleMode}>
									<SunIcon class="scale-100 transition-all! dark:scale-0 dark:-rotate-90" />
									<MoonIcon class="absolute scale-0 transition-all! dark:scale-100 dark:rotate-0" />
									Wijzig thema
								</DropdownMenu.Item>
							</DropdownMenu.Group>
							<DropdownMenu.Separator />
							<DropdownMenu.Item>
								{#snippet child({ props })}
									<a href="/auth/logout" {...props}>
										<LogOutIcon />
										<span>Uitloggen</span>
										<ChevronRightIcon class="ml-auto" />
									</a>
								{/snippet}
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
			<Sidebar.Separator class="separator mx-0 last-of-type:hidden" />
		</Sidebar.Header>
		<Sidebar.Content class="pt-2">
			<Sidebar.Menu>
				<Sidebar.MenuItem class="px-2">
					<Sidebar.MenuButton isActive={page.route.id?.endsWith('/editor/stories')}>
						{#snippet child({ props })}
							<a href="/editor/stories" {...props}>My stories</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
				{#if authusr.roles?.includes(UserRole.admin)}
					<Sidebar.MenuItem class="px-2">
						<Sidebar.MenuButton isActive={page.route.id?.endsWith('/editor/stories/all')}>
							{#snippet child({ props })}
								<a href="/editor/stories/all" {...props}>All stories</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				{/if}
			</Sidebar.Menu>
		</Sidebar.Content>
		<Sidebar.Footer class="pb-safe-or-2 border-t px-0 empty:border-0"></Sidebar.Footer>
	</Sidebar.Root>

	<Sidebar.Inset>
		<div class="w-full">
			{@render children?.()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
