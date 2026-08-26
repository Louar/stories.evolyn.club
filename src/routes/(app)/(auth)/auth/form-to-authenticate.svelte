<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Password from '$lib/components/ui/password/index.js';
	import { useSubmissionState } from '$lib/hooks/use-submission-state.svelte.js';
	import * as m from '$lib/paraglide/messages';
	import { cn } from '$lib/utils.js';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { tick } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { fly } from 'svelte/transition';
	import { z } from 'zod/v4';
	import type { ActionData } from './$types';
	import { schemaToAuthenticate } from './schemas';

	type Props = HTMLAttributes<HTMLDivElement> & {
		segment: 'authenticate' | 'register';
	};
	let { segment = $bindable(), class: className, ...restProps }: Props = $props();

	type AuthenticateActionData = Extract<NonNullable<ActionData>, { form: 'authenticate' }>;
	const initialAction = page.form?.form === 'authenticate' ? page.form : undefined;
	let email = $state(initialAction?.values.email ?? '');
	let password = $state(initialAction?.values.password ?? '');
	let errors: Record<string, string[] | undefined> = $state(initialAction?.errors ?? {});
	let message = $state(initialAction?.message);
	const submission = useSubmissionState();

	const enhanceForm: SubmitFunction = ({ formData, cancel }) => {
		if (submission.submitting) {
			cancel();
			return;
		}

		const values = {
			email: String(formData.get('email') ?? ''),
			password: String(formData.get('password') ?? '')
		};
		const result = schemaToAuthenticate.safeParse(values);
		if (!result.success) {
			cancel();
			errors = z.flattenError(result.error).fieldErrors;
			message = m.auth_login_failed();
			void tick().then(() =>
				document
					.querySelector<HTMLElement>('[aria-invalid="true"]')
					?.scrollIntoView({ behavior: 'smooth' })
			);
			return;
		}

		errors = {};
		message = undefined;
		const submissionId = submission.start();
		return async ({ result: actionResult, update }) => {
			try {
				if (
					(actionResult.type === 'failure' || actionResult.type === 'success') &&
					actionResult.data
				) {
					const data = actionResult.data as AuthenticateActionData;
					if (data.form === 'authenticate') {
						email = data.values.email;
						password = data.values.password;
						errors = data.errors;
						message = data.message;
					}
				}
				await update({ reset: false });
			} finally {
				submission.finish(submissionId);
			}
		};
	};
</script>

<div class={cn('flex flex-col gap-6', className)} {...restProps} in:fly={{ y: 25, duration: 300 }}>
	<Card.Root>
		<Card.Header class="text-center">
			<Card.Title class="text-xl">{m.auth_welcome_back_title()}</Card.Title>
			<Card.Description>{m.auth_login_description()}</Card.Description>
		</Card.Header>
		<Card.Content>
			<form
				action="?/authenticate"
				method="POST"
				use:enhance={enhanceForm}
				novalidate
				class="grid gap-6"
				aria-busy={submission.submitting}
			>
				<div class="space-y-2">
					<Label
						for="authenticate-email"
						class={errors.email?.length ? 'text-destructive' : undefined}>{m.common_email()}</Label
					>
					<Input
						id="authenticate-email"
						name="email"
						type="email"
						autocomplete="email"
						required
						bind:value={email}
						aria-invalid={errors.email?.length ? 'true' : undefined}
						aria-describedby={errors.email?.length ? 'authenticate-email-errors' : undefined}
					/>
					{#if errors.email?.length}<div
							id="authenticate-email-errors"
							class="text-sm font-medium text-destructive"
							role="alert"
						>
							{#each errors.email as error, i (`${error}-${i}`)}<div>{error}</div>{/each}
						</div>{/if}
				</div>

				<div class="space-y-2">
					<div class="flex items-center">
						<Label
							for="authenticate-password"
							class={errors.password?.length ? 'text-destructive' : undefined}
							>{m.common_password()}</Label
						>
						<!-- <a
										href="##"
										tabindex="-1"
										class="ml-auto text-sm underline-offset-4 hover:underline"
									>
										Wachtwoord vergeten?
									</a> -->
					</div>
					<Password.Root>
						<Password.Input
							id="authenticate-password"
							name="password"
							autocomplete="current-password"
							required
							bind:value={password}
							aria-invalid={errors.password?.length ? 'true' : undefined}
							aria-describedby={errors.password?.length
								? 'authenticate-password-errors'
								: undefined}
						>
							<Password.ToggleVisibility />
						</Password.Input>
					</Password.Root>
					{#if errors.password?.length}<div
							id="authenticate-password-errors"
							class="text-sm font-medium text-destructive"
							role="alert"
						>
							{#each errors.password as error, i (`${error}-${i}`)}<div>{error}</div>{/each}
						</div>{/if}
				</div>

				<div class="space-y-2">
					<Button type="submit" class="w-full" disabled={submission.submitting}>
						{#if submission.delayed}<LoaderCircleIcon class="animate-spin" />{/if}
						<span>{m.auth_login()}</span>
						<ArrowRightIcon />
					</Button>
					{#if message}
						<p class="text-center text-sm font-medium text-destructive" role="alert">{message}</p>
					{/if}
					{#if submission.timeout}<p
							class="text-center text-xs text-muted-foreground"
							aria-live="polite"
						>
							{m.auth_login_slow()}
						</p>{/if}
				</div>

				<div class="text-center text-sm">
					{m.auth_no_account()}
					<Button variant="link" size="sm" class="px-0" onclick={() => (segment = 'register')}>
						<span>{m.auth_register()}</span>
						<ArrowRightIcon />
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
	<div
		class="text-center text-xs text-balance text-muted-foreground *:[a]:underline *:[a]:underline-offset-4 *:[a]:hover:text-primary"
	>
		{m.auth_terms_prefix_login()}
		<a href={resolve(`/policies/terms?${page.url.searchParams.toString()}`)}>{m.auth_terms()}</a>
		{m.auth_terms_and()}
		<a href={resolve(`/policies/privacy?${page.url.searchParams.toString()}`)}>{m.auth_privacy()}</a
		>.
	</div>
</div>
