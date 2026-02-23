<script lang="ts">
	import { page } from '$app/state';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import type { WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = {
		menus: {
			type?: 'url';
			label: string;
			url: string;
			isActive?: boolean;
			isTrigger?: boolean;
		}[][];
	} & WithElementRef<HTMLAttributes<HTMLElement>>;
	let {
		ref = $bindable(null),
		menus: rawMenus,
		class: className,
		children,
		...restProps
	}: Props = $props();

	const menus = $derived(
		rawMenus.map((group) =>
			group.map((item) => {
				const type = item.type ?? 'url';
				return {
					...item,
					type,
					isActive:
						type === 'url' && item.isActive == null
							? page.url.pathname.startsWith(item.url)
							: item.isActive
				};
			})
		)
	);
</script>

<nav
	bind:this={ref}
	data-slot="breadcrumb"
	class={className}
	aria-label="breadcrumb"
	{...restProps}
>
	{@render children?.()}
</nav>

<Breadcrumb.Root class={className}>
	<Breadcrumb.List>
		{#each menus as menu, i}
			{@const trigger = menu.find((item) => item.isTrigger)?.label}
			<Breadcrumb.Item>
				<Breadcrumb.Page>
					<DropdownMenu.Root>
						<DropdownMenu.Trigger class="max-w-48 truncate md:max-w-none">
							<Breadcrumb.Link class={i !== menus.length - 1 ? 'text-muted-foreground' : ''}>
								{trigger ?? '?'}
							</Breadcrumb.Link>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="start">
							<DropdownMenu.Group>
								{#each menu as item}
									<DropdownMenu.Item>
										{#snippet child({ props })}
											<a href={item.url} class:bg-muted={item.isActive} {...props}>
												{item.label}
											</a>
										{/snippet}
									</DropdownMenu.Item>
								{/each}
							</DropdownMenu.Group>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</Breadcrumb.Page>
			</Breadcrumb.Item>
			{#if i !== menus.length - 1}
				<Breadcrumb.Separator />
			{/if}
		{/each}
	</Breadcrumb.List>
</Breadcrumb.Root>
