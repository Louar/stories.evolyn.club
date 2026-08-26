<script lang="ts">
	import { resolve } from '$app/paths';
	import { AvatarMedia } from '$lib/components/ui/avatar-media';
	import { LanguageSwitcher } from '$lib/components/ui/language-switcher';
	import GalleryVerticalEndIcon from '@lucide/svelte/icons/gallery-vertical-end';
	import { untrack } from 'svelte';
	import type { PageProps } from './$types';
	import FormToAuthenticate from './form-to-authenticate.svelte';
	import FormToRegister from './form-to-register.svelte';

	let { data, form }: PageProps = $props();
	let client = $derived(data.client);
	let segment: 'authenticate' | 'register' = $state(untrack(() => form?.form ?? 'authenticate'));
</script>

<LanguageSwitcher class="absolute top-0 right-0 mt-4 mr-4" />

<div class="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
	<div class="flex w-full max-w-sm flex-col gap-6">
		<a href={resolve('/')} class="flex items-center gap-2 self-center font-medium">
			{#if client.favicon}
				<AvatarMedia src={client.favicon} class="size-6 rounded-md border shadow-xs" />
			{:else}
				<div
					class="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"
				>
					<GalleryVerticalEndIcon class="size-4" />
				</div>
			{/if}
			{client.name}
		</a>
		{#if segment === 'authenticate'}
			<FormToAuthenticate bind:segment />
		{/if}
		{#if segment === 'register'}
			<FormToRegister bind:segment />
		{/if}
	</div>
</div>
