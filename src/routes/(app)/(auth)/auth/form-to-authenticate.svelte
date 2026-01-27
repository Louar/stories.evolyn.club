<script lang="ts">
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';

	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Form from '$lib/components/ui/form/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { cn } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';
	import { fly } from 'svelte/transition';

	import { page } from '$app/state';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import type { PageData } from './$types';
	import { schemaToAuthenticate } from './schemas';

	type Props = HTMLAttributes<HTMLDivElement> & {
		data: PageData;
		segment: 'authenticate' | 'register';
	};
	let { data, segment = $bindable(), class: className, ...restProps }: Props = $props();

	const form = superForm(data.formToAuthenticate, {
		validators: zod4Client(schemaToAuthenticate),
		taintedMessage: false,
		resetForm: false,
		dataType: 'json',
		scrollToError: 'smooth'
	});

	const { form: fd, enhance, delayed, message } = form;
</script>

<div class={cn('flex flex-col gap-6', className)} {...restProps} in:fly={{ y: 25, duration: 300 }}>
	<Card.Root>
		<Card.Header class="text-center">
			<Card.Title class="text-xl">Welkom terug</Card.Title>
			<Card.Description>Log in met je accountgegevens</Card.Description>
		</Card.Header>
		<Card.Content>
			<form action="?/authenticate" method="POST" use:enhance class="grid gap-6">
				<Form.Field {form} name="email">
					<Form.Control>
						{#snippet children({ props })}
							<div class="space-y-2">
								<Form.Label>Email</Form.Label>
								<Input {...props} type="email" bind:value={$fd.email} />
								<Form.FieldErrors />
							</div>
						{/snippet}
					</Form.Control>
				</Form.Field>

				<Form.Field {form} name="password">
					<Form.Control>
						{#snippet children({ props })}
							<div class="space-y-2">
								<div class="flex items-center">
									<Form.Label>Wachtwoord</Form.Label>
									<!-- <a
										href="##"
										tabindex="-1"
										class="ml-auto text-sm underline-offset-4 hover:underline"
									>
										Wachtwoord vergeten?
									</a> -->
								</div>
								<Input {...props} type="password" bind:value={$fd.password} />
								<Form.FieldErrors />
							</div>
						{/snippet}
					</Form.Control>
				</Form.Field>

				<div class="space-y-2">
					<Button type="submit" class="w-full" disabled={$delayed}>
						{#if $delayed}<LoaderCircleIcon class="animate-spin" />{/if}
						<span>Inloggen</span>
						<ArrowRightIcon />
					</Button>
					{#if $message?.error}
						<p class="text-center text-sm font-medium text-destructive">{$message.reason}</p>
					{/if}
				</div>

				<div class="text-center text-sm">
					Heb je nog geen account?
					<Button variant="link" size="sm" class="px-0" onclick={() => (segment = 'register')}>
						<span>Registreren</span>
						<ArrowRightIcon />
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
	<div
		class="text-center text-xs text-balance text-muted-foreground *:[a]:underline *:[a]:underline-offset-4 *:[a]:hover:text-primary"
	>
		Door op 'Inloggen' te klikken, ga je akkoord met onze
		<a href="/policies/terms{page.url.search}">Servicevoorwaarden</a>
		en ons <a href="/policies/privacy{page.url.search}">Privacybeleid</a>.
	</div>
</div>
