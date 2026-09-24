<script lang="ts">
	import { cn } from '$lib/utils';
	import type { IconProps } from '@lucide/svelte';
	import { Icon } from './app-icon';

	type Props = IconProps & {
		icon: keyof typeof Icon;
		class?: string;
	};
	const { icon, class: className, ...restProps }: Props = $props();

	const Component = $derived(Icon[icon]);
</script>

<Component class={cn('shrink-0 text-muted-foreground', className)} {...restProps} />
