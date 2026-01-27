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
	import { schemaToRegister } from './schemas';

	type Props = HTMLAttributes<HTMLDivElement> & {
		data: PageData;
		segment: 'authenticate' | 'register';
	};
	let { data, segment = $bindable(), class: className, ...restProps }: Props = $props();

	const form = superForm(data.formToRegister, {
		validators: zod4Client(schemaToRegister),
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
			<Card.Title class="text-xl">Hey nieuwkomer</Card.Title>
			<Card.Description>Maak een nieuw account</Card.Description>
		</Card.Header>
		<Card.Content>
			<form action="?/register" method="POST" use:enhance class="grid gap-6">
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
								<Form.Label>Wachtwoord</Form.Label>
								<Input
									{...props}
									type="password"
									autocomplete="new-password"
									bind:value={$fd.password}
								/>
								<Form.FieldErrors />
							</div>
						{/snippet}
					</Form.Control>
				</Form.Field>

				<Form.Field {form} name="passwordConfirm">
					<Form.Control>
						{#snippet children({ props })}
							<div class="space-y-2">
								<Form.Label>Wachtwoord (bevestiging)</Form.Label>
								<Input
									{...props}
									type="password"
									autocomplete="new-password"
									bind:value={$fd.passwordConfirm}
								/>
								<Form.FieldErrors />
							</div>
						{/snippet}
					</Form.Control>
				</Form.Field>

				<Form.Field {form} name="firstName">
					<Form.Control>
						{#snippet children({ props })}
							<div class="space-y-2">
								<Form.Label>Voornaam</Form.Label>
								<Input {...props} type="text" bind:value={$fd.firstName} />
								<Form.FieldErrors />
							</div>
						{/snippet}
					</Form.Control>
				</Form.Field>

				<Form.Field {form} name="lastName">
					<Form.Control>
						{#snippet children({ props })}
							<div class="space-y-2">
								<Form.Label>Achternaam</Form.Label>
								<Input {...props} type="text" bind:value={$fd.lastName} />
								<Form.FieldErrors />
							</div>
						{/snippet}
					</Form.Control>
				</Form.Field>

				<div class="space-y-2">
					<Button type="submit" class="w-full" disabled={$delayed}>
						{#if $delayed}<LoaderCircleIcon class="animate-spin" />{/if}
						<span>Registreren</span>
						<ArrowRightIcon />
					</Button>
					{#if $message?.error}
						<p class="text-center text-sm font-medium text-destructive">{$message.reason}</p>
					{/if}
				</div>

				<div class="text-center text-sm">
					Heb je al een account?
					<Button variant="link" class="px-0" onclick={() => (segment = 'authenticate')}>
						<span>Inloggen</span>
						<ArrowRightIcon />
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
	<div
		class="text-center text-xs text-balance text-muted-foreground *:[a]:underline *:[a]:underline-offset-4 *:[a]:hover:text-primary"
	>
		Door op 'Registreren' te klikken, ga je akkoord met onze
		<a href="/policies/terms{page.url.search}">Servicevoorwaarden</a>
		en ons <a href="/policies/privacy{page.url.search}">Privacybeleid</a>.
	</div>
</div>
