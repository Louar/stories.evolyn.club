<script lang="ts">
	import { resolve } from '$app/paths';
	import AvatarMedia from '$lib/components/ui/avatar-media/avatar-media.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { LanguageSwitcher } from '$lib/components/ui/language-switcher';
	import type {
		findOneAuthenticatedUser,
		findOneClientByOrigin
	} from '$lib/db/repositories/1-client-user-module';
	import { ClientAuthenticationMethod, UserRole } from '$lib/db/schemas/1-client-user-module.js';
	import * as m from '$lib/paraglide/messages';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import HomeIcon from '@lucide/svelte/icons/home';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import SunIcon from '@lucide/svelte/icons/sun';
	import UserIcon from '@lucide/svelte/icons/user';
	import { toggleMode } from 'mode-watcher';

	type Props = {
		client?: Awaited<ReturnType<typeof findOneClientByOrigin>>;
		authusr?: Awaited<ReturnType<typeof findOneAuthenticatedUser>>;
	};
	let { client, authusr }: Props = $props();

	let canAuthenticateWithPassword = $derived(
		client?.authenticationMethods.includes(ClientAuthenticationMethod.password)
	);
</script>

<div class="mr-4 ml-auto flex justify-center gap-2">
	{#if client?.locales?.length !== 1}
		<LanguageSwitcher variant="ghost" />
	{/if}
	<Button variant="ghost" onclick={toggleMode}>
		<SunIcon class="scale-100 transition-all! dark:scale-0 dark:-rotate-90" />
		<MoonIcon class="absolute scale-0 transition-all! dark:scale-100 dark:rotate-0" />
	</Button>
	{#if authusr}
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button {...props} variant="ghost">
						<SettingsIcon />
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content class="min-w-56" align="end" sideOffset={6} collisionPadding={4}>
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
							<a href={resolve('/edit/assistant')} {...props}>
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
	{:else if canAuthenticateWithPassword}
		<Button href={resolve('/auth')} variant="ghost">
			<UserIcon />
		</Button>
	{/if}
</div>
