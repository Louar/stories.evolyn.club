<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { AvatarMedia } from '$lib/components/ui/avatar-media';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { LanguageSwitcher } from '$lib/components/ui/language-switcher';
	import * as m from '$lib/paraglide/messages';
	import GalleryVerticalEndIcon from '@lucide/svelte/icons/gallery-vertical-end';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const client = $derived(data.client);
</script>

<svelte:head>
	<title>{m.auth_reset_title()} | {client.name}</title>
</svelte:head>

<LanguageSwitcher class="absolute top-0 right-0 mt-4 mr-4" />

<div class="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
	<div class="w-full max-w-sm">
		<a href={resolve('/')} class="mb-6 flex items-center justify-center gap-2 font-medium">
			{#if client.favicon}
				<AvatarMedia src={client.favicon} class="size-7 rounded-md border shadow-xs" />
			{:else}
				<span
					class="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground"
				>
					<GalleryVerticalEndIcon class="size-4" />
				</span>
			{/if}
			{client.name}
		</a>

		<section class="rounded-xl border bg-background p-6 shadow-sm">
			{#if form?.success}
				<h1 class="text-xl font-semibold">{m.auth_password_updated()}</h1>
				<p class="mt-2 text-sm leading-6 text-muted-foreground">
					{m.auth_password_updated_description()}
				</p>
				<Button href={resolve('/auth')} class="mt-6 w-full">{m.auth_login()}</Button>
			{:else if data.valid}
				<h1 class="text-xl font-semibold">{m.auth_choose_new_password()}</h1>
				<p class="mt-2 text-sm leading-6 text-muted-foreground">
					{m.auth_new_password_description({ clientName: client.name })}
				</p>

				<form method="POST" use:enhance class="mt-6 space-y-4">
					<div class="space-y-2">
						<Label for="password">{m.auth_new_password()}</Label>
						<Input
							id="password"
							name="password"
							type="password"
							autocomplete="new-password"
							required
							minlength={5}
						/>
					</div>
					<div class="space-y-2">
						<Label for="passwordConfirm">{m.auth_confirm_new_password()}</Label>
						<Input
							id="passwordConfirm"
							name="passwordConfirm"
							type="password"
							autocomplete="new-password"
							required
							minlength={5}
						/>
					</div>
					{#if form?.message}
						<p class="text-sm text-destructive" role="alert">{form.message}</p>
					{/if}
					<Button type="submit" class="w-full">{m.auth_update_password()}</Button>
				</form>
			{:else}
				<h1 class="text-xl font-semibold">{m.auth_reset_link_unavailable()}</h1>
				<p class="mt-2 text-sm leading-6 text-muted-foreground">
					{m.auth_reset_link_invalid()}
					{#if client.administrationEmail}
						{m.auth_contact()}
						<a class="text-primary underline" href={`mailto:${client.administrationEmail}`}>
							{client.administrationEmail}
						</a>
						{m.auth_for_new_link()}
					{:else}
						{m.auth_contact_admin_for_new_link()}
					{/if}
				</p>
			{/if}
		</section>
	</div>
</div>
