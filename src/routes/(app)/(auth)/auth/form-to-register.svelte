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
	import { schemaToRegister } from './schemas';

	type Props = HTMLAttributes<HTMLDivElement> & {
		segment: 'authenticate' | 'register';
	};
	let { segment = $bindable(), class: className, ...restProps }: Props = $props();

	type RegisterActionData = Extract<NonNullable<ActionData>, { form: 'register' }>;
	const initialAction = page.form?.form === 'register' ? page.form : undefined;
	let email = $state(initialAction?.values.email ?? '');
	let password = $state(initialAction?.values.password ?? '');
	let passwordConfirm = $state(initialAction?.values.passwordConfirm ?? '');
	let firstName = $state(initialAction?.values.firstName ?? '');
	let lastName = $state(initialAction?.values.lastName ?? '');
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
			password: String(formData.get('password') ?? ''),
			passwordConfirm: String(formData.get('passwordConfirm') ?? ''),
			firstName: String(formData.get('firstName') ?? ''),
			lastName: String(formData.get('lastName') ?? '')
		};
		const result = schemaToRegister.safeParse(values);
		if (!result.success) {
			cancel();
			errors = z.flattenError(result.error).fieldErrors;
			message = m.auth_registration_failed();
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
					const data = actionResult.data as RegisterActionData;
					if (data.form === 'register') {
						email = data.values.email;
						password = data.values.password;
						passwordConfirm = data.values.passwordConfirm;
						firstName = data.values.firstName;
						lastName = data.values.lastName;
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
			<Card.Title class="text-xl">{m.auth_register_title()}</Card.Title>
			<Card.Description>{m.auth_register_description()}</Card.Description>
		</Card.Header>
		<Card.Content>
			<form
				action="?/register"
				method="POST"
				use:enhance={enhanceForm}
				novalidate
				class="grid gap-6"
				aria-busy={submission.submitting}
			>
				<div class="space-y-2">
					<Label for="register-email" class={errors.email?.length ? 'text-destructive' : undefined}
						>{m.common_email()}</Label
					>
					<Input
						id="register-email"
						name="email"
						type="email"
						autocomplete="email"
						required
						bind:value={email}
						aria-invalid={errors.email?.length ? 'true' : undefined}
						aria-describedby={errors.email?.length ? 'register-email-errors' : undefined}
					/>
					{#if errors.email?.length}<div
							id="register-email-errors"
							class="text-sm font-medium text-destructive"
							role="alert"
						>
							{#each errors.email as error, i (`${error}-${i}`)}<div>{error}</div>{/each}
						</div>{/if}
				</div>

				<div class="space-y-2">
					<Label
						for="register-password"
						class={errors.password?.length ? 'text-destructive' : undefined}
						>{m.common_password()}</Label
					>
					<Password.Root>
						<Password.Input
							id="register-password"
							name="password"
							autocomplete="new-password"
							required
							minlength={5}
							bind:value={password}
							aria-invalid={errors.password?.length ? 'true' : undefined}
							aria-describedby={errors.password?.length ? 'register-password-errors' : undefined}
						>
							<Password.ToggleVisibility />
						</Password.Input>
						<Password.Strength />
					</Password.Root>
					{#if errors.password?.length}<div
							id="register-password-errors"
							class="text-sm font-medium text-destructive"
							role="alert"
						>
							{#each errors.password as error, i (`${error}-${i}`)}<div>{error}</div>{/each}
						</div>{/if}
				</div>

				<div class="space-y-2">
					<Label
						for="register-password-confirm"
						class={errors.passwordConfirm?.length ? 'text-destructive' : undefined}
						>{m.auth_password_confirm()}</Label
					>
					<Password.Root>
						<Password.Input
							id="register-password-confirm"
							name="passwordConfirm"
							autocomplete="new-password"
							required
							bind:value={passwordConfirm}
							aria-invalid={errors.passwordConfirm?.length ? 'true' : undefined}
							aria-describedby={errors.passwordConfirm?.length
								? 'register-password-confirm-errors'
								: undefined}
						>
							<Password.ToggleVisibility />
						</Password.Input>
					</Password.Root>
					{#if errors.passwordConfirm?.length}<div
							id="register-password-confirm-errors"
							class="text-sm font-medium text-destructive"
							role="alert"
						>
							{#each errors.passwordConfirm as error, i (`${error}-${i}`)}<div>{error}</div>{/each}
						</div>{/if}
				</div>

				<div class="space-y-2">
					<Label
						for="register-first-name"
						class={errors.firstName?.length ? 'text-destructive' : undefined}
						>{m.auth_first_name()}</Label
					>
					<Input
						id="register-first-name"
						name="firstName"
						type="text"
						autocomplete="given-name"
						required
						maxlength={128}
						bind:value={firstName}
						aria-invalid={errors.firstName?.length ? 'true' : undefined}
						aria-describedby={errors.firstName?.length ? 'register-first-name-errors' : undefined}
					/>
					{#if errors.firstName?.length}<div
							id="register-first-name-errors"
							class="text-sm font-medium text-destructive"
							role="alert"
						>
							{#each errors.firstName as error, i (`${error}-${i}`)}<div>{error}</div>{/each}
						</div>{/if}
				</div>

				<div class="space-y-2">
					<Label
						for="register-last-name"
						class={errors.lastName?.length ? 'text-destructive' : undefined}
						>{m.auth_last_name()}</Label
					>
					<Input
						id="register-last-name"
						name="lastName"
						type="text"
						autocomplete="family-name"
						maxlength={128}
						bind:value={lastName}
						aria-invalid={errors.lastName?.length ? 'true' : undefined}
						aria-describedby={errors.lastName?.length ? 'register-last-name-errors' : undefined}
					/>
					{#if errors.lastName?.length}<div
							id="register-last-name-errors"
							class="text-sm font-medium text-destructive"
							role="alert"
						>
							{#each errors.lastName as error, i (`${error}-${i}`)}<div>{error}</div>{/each}
						</div>{/if}
				</div>

				<div class="space-y-2">
					<Button type="submit" class="w-full" disabled={submission.submitting}>
						{#if submission.delayed}<LoaderCircleIcon class="animate-spin" />{/if}
						<span>{m.auth_register()}</span>
						<ArrowRightIcon />
					</Button>
					{#if message}
						<p class="text-center text-sm font-medium text-destructive" role="alert">{message}</p>
					{/if}
					{#if submission.timeout}<p
							class="text-center text-xs text-muted-foreground"
							aria-live="polite"
						>
							{m.auth_register_slow()}
						</p>{/if}
				</div>

				<div class="text-center text-sm">
					{m.auth_have_account()}
					<Button variant="link" class="px-0" onclick={() => (segment = 'authenticate')}>
						<span>{m.auth_login()}</span>
						<ArrowRightIcon />
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
	<div
		class="text-center text-xs text-balance text-muted-foreground *:[a]:underline *:[a]:underline-offset-4 *:[a]:hover:text-primary"
	>
		{m.auth_terms_prefix_register()}
		<a href={resolve(`/policies/terms?${page.url.searchParams.toString()}`)}>{m.auth_terms()}</a>
		{m.auth_terms_and()}
		<a href={resolve(`/policies/privacy?${page.url.searchParams.toString()}`)}>{m.auth_privacy()}</a
		>.
	</div>
</div>
