<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Account from '$lib/components/app/menu/items/account.svelte';
	import { useSidebar } from '$lib/components/ui/sidebar';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import RocketIcon from '@lucide/svelte/icons/rocket';

	let { data } = $props();

	let authusr = $derived(data.authusr!);

	const sidebar = useSidebar();
</script>

<Sidebar.Root>
	<Sidebar.Header
		class="-mt-px muted-scrollbar overscroll-y-none border-b px-0 py-0 empty:border-0"
	>
		<Sidebar.Group>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					<Account {authusr} />
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Header>
	<Sidebar.Content class="muted-scrollbar overscroll-y-none py-4">
		<Sidebar.Group class="p-0">
			<Sidebar.Menu>
				<Sidebar.MenuItem class="px-2">
					<Sidebar.MenuButton
						onclick={() => sidebar?.setOpenMobile(false)}
						isActive={page.url.pathname === '/edit'}
					>
						{#snippet child({ props })}
							<a href={resolve('/edit')} {...props}>Assistant</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</Sidebar.Group>
		<Sidebar.Group class="p-0">
			<Sidebar.GroupLabel
				class="flex h-10 w-full items-center gap-2 rounded-none bg-sidebar px-3 pb-2 text-sm text-muted-foreground backdrop-blur-sm supports-backdrop-filter:bg-sidebar/80"
			>
				<RocketIcon />
				Client
			</Sidebar.GroupLabel>
			<Sidebar.Menu>
				<Sidebar.MenuItem class="px-2">
					<Sidebar.MenuButton
						onclick={() => sidebar?.setOpenMobile(false)}
						isActive={page.url.pathname?.startsWith('/edit/users')}
					>
						{#snippet child({ props })}
							<a href={resolve('/edit/users')} {...props}>Users</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
				<Sidebar.MenuItem class="px-2">
					<Sidebar.MenuButton
						onclick={() => sidebar?.setOpenMobile(false)}
						isActive={page.url.pathname?.startsWith('/edit/policies')}
					>
						{#snippet child({ props })}
							<a href={resolve('/edit/policies')} {...props}>Policies</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
				<Sidebar.MenuItem class="px-2">
					<Sidebar.MenuButton
						onclick={() => sidebar?.setOpenMobile(false)}
						isActive={page.url.pathname?.startsWith('/edit/clients')}
					>
						{#snippet child({ props })}
							<a href={resolve('/edit/clients')} {...props}>Clients</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
				<Sidebar.MenuItem class="px-2">
					<Sidebar.MenuButton
						onclick={() => sidebar?.setOpenMobile(false)}
						isActive={page.url.pathname?.startsWith('/edit/domains')}
					>
						{#snippet child({ props })}
							<a href={resolve('/edit/domains')} {...props}>Domains</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</Sidebar.Group>
		<Sidebar.Group class="p-0">
			<Sidebar.GroupLabel
				class="flex h-10 w-full items-center gap-2 rounded-none bg-sidebar px-3 pb-2 text-sm text-muted-foreground backdrop-blur-sm supports-backdrop-filter:bg-sidebar/80"
			>
				<RocketIcon />
				Stories
			</Sidebar.GroupLabel>
			<Sidebar.Menu>
				<Sidebar.MenuItem class="px-2">
					<Sidebar.MenuButton
						onclick={() => sidebar?.setOpenMobile(false)}
						isActive={page.url.pathname?.startsWith('/edit/anthologies')}
					>
						{#snippet child({ props })}
							<a href={resolve('/edit/anthologies')} {...props}>Anthologies</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
				<Sidebar.MenuItem class="px-2">
					<Sidebar.MenuButton
						onclick={() => sidebar?.setOpenMobile(false)}
						isActive={page.url.pathname?.startsWith('/edit/stories')}
					>
						{#snippet child({ props })}
							<a href={resolve('/edit/stories')} {...props}>Stories</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</Sidebar.Group>
		<Sidebar.Group class="p-0">
			<Sidebar.GroupLabel
				class="flex h-10 w-full items-center gap-2 rounded-none bg-sidebar px-3 pb-2 text-sm text-muted-foreground backdrop-blur-sm supports-backdrop-filter:bg-sidebar/80"
			>
				<RocketIcon />
				Taxonomies
			</Sidebar.GroupLabel>
			<Sidebar.Menu>
				<Sidebar.MenuItem class="px-2">
					<Sidebar.MenuButton
						onclick={() => sidebar?.setOpenMobile(false)}
						isActive={page.url.pathname?.startsWith('/edit/taxonomies')}
					>
						{#snippet child({ props })}
							<a href={resolve('/edit/taxonomies')} {...props}>Taxonomies</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</Sidebar.Group>
	</Sidebar.Content>
	<Sidebar.Footer class="border-t px-0 pb-safe empty:border-0"></Sidebar.Footer>
</Sidebar.Root>
