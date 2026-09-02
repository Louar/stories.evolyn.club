<script lang="ts">
	import { resolve } from '$app/paths';
	import AvatarMedia from '$lib/components/ui/avatar-media/avatar-media.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { useSidebar } from '$lib/components/ui/sidebar';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { UserRole } from '$lib/db/schemas/1-client-user-module.js';
	import * as m from '$lib/paraglide/messages';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import HomeIcon from '@lucide/svelte/icons/home';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import SunIcon from '@lucide/svelte/icons/sun';
	import { toggleMode } from 'mode-watcher';
	import type { ComponentProps } from 'svelte';

	type MenuAccountUser = Pick<
		NonNullable<App.Locals['authusr']>,
		'abbreviation' | 'name' | 'roles'
	> & {
		picture: ComponentProps<typeof AvatarMedia>['src'];
	};

	type Props = { authusr: MenuAccountUser | null | undefined };
	let { authusr }: Props = $props();
	const sidebar = useSidebar();
</script>

{#if authusr}
	<Sidebar.MenuItem>
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
							class="size-9 rounded-full"
						/>
						<div class="grid flex-1 text-left text-sm leading-tight">
							<span class="truncate text-xs text-muted-foreground">{m.menu_my_account()}</span>
							<span class="truncate font-medium">{authusr.name ?? m.menu_anonymous_account()}</span>
						</div>
						<ChevronsUpDownIcon class="ml-auto size-4" />
					</Sidebar.MenuButton>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content
				class="min-w-56"
				side={sidebar?.isMobile ? 'bottom' : 'right'}
				align="end"
				sideOffset={6}
				collisionPadding={4}
			>
				<DropdownMenu.Label class="p-0 font-normal">
					<div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
						<AvatarMedia
							src={authusr.picture}
							fallback={authusr.abbreviation}
							class="size-8 rounded-full"
						/>
						<div class="grid flex-1 text-left text-sm leading-tight">
							<span class="truncate text-xs text-muted-foreground">{m.menu_my_account()}</span>
							<span class="truncate font-medium">{authusr.name ?? m.menu_anonymous_account()}</span>
						</div>
					</div>
				</DropdownMenu.Label>
				<DropdownMenu.Separator />
				<DropdownMenu.Group>
					<DropdownMenu.Item onclick={toggleMode}>
						<SunIcon class="scale-100 transition-all! dark:scale-0 dark:-rotate-90" />
						<MoonIcon class="absolute scale-0 transition-all! dark:scale-100 dark:rotate-0" />
						{m.menu_change_theme()}
					</DropdownMenu.Item>
				</DropdownMenu.Group>
				<DropdownMenu.Separator />
				{#if authusr.roles?.includes(UserRole.admin) || authusr.roles?.includes(UserRole.editor)}
					<DropdownMenu.Item>
						{#snippet child({ props })}
							<a href={resolve('/')} {...props}>
								<HomeIcon />
								<span>{m.menu_home()}</span>
								<ChevronRightIcon class="ml-auto" />
							</a>
						{/snippet}
					</DropdownMenu.Item>
					<DropdownMenu.Item>
						{#snippet child({ props })}
							<a href={resolve('/edit')} {...props}>
								<ShieldIcon />
								<span>{m.menu_editor()}</span>
								<ChevronRightIcon class="ml-auto" />
							</a>
						{/snippet}
					</DropdownMenu.Item>
				{/if}
				<DropdownMenu.Item>
					{#snippet child({ props })}
						<a href={resolve('/auth/logout')} data-sveltekit-reload {...props}>
							<LogOutIcon />
							<span>{m.menu_sign_out()}</span>
							<ChevronRightIcon class="ml-auto" />
						</a>
					{/snippet}
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</Sidebar.MenuItem>
{/if}
