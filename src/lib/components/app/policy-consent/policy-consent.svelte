<script lang="ts">
	import { afterNavigate, invalidate } from '$app/navigation';
	import { acceptLatestPolicy } from '$lib/client/policies';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as m from '$lib/paraglide/messages';
	import FileCheck2 from '@lucide/svelte/icons/file-check-2';
	import { toast } from 'svelte-sonner';

	const STORAGE_KEY = 'policy-consent.dismissed-version';

	let { policyState, authusr } = $props();
	let anonymousStateReady = $state(false);
	let dismissedVersion = $state<string | null>(null);
	let acceptedVersion = $state<string | null>(null);
	let isAccepting = $state(false);

	let latestLicense = $derived(policyState.latestLicense);
	let isAuthenticated = $derived(Boolean(authusr));
	let isLatestAccepted = $derived(
		Boolean(policyState.latestAgreement?.isAccepted) || acceptedVersion === latestLicense?.version
	);
	let isVisible = $derived(
		Boolean(latestLicense) &&
			(isAuthenticated
				? !isLatestAccepted
				: anonymousStateReady && dismissedVersion !== latestLicense?.version)
	);

	afterNavigate(() => {
		if (!isAuthenticated) {
			try {
				dismissedVersion = localStorage.getItem(STORAGE_KEY);
			} catch {
				dismissedVersion = null;
			}
		}
		anonymousStateReady = true;
	});

	const dismiss = () => {
		if (!latestLicense) return;
		try {
			localStorage.setItem(STORAGE_KEY, latestLicense.version);
		} catch {
			// Keep the popup dismissed for this page view when storage is unavailable.
		}
		dismissedVersion = latestLicense.version;
	};

	const accept = async () => {
		isAccepting = true;
		try {
			const result = await acceptLatestPolicy();
			acceptedVersion = result.license.version;
			void invalidate('app:policy-state');
			toast.success(m.policies_accept_success());
		} catch (error) {
			toast.error(error instanceof Error ? error.message : m.policies_accept_error());
		} finally {
			isAccepting = false;
		}
	};
</script>

{#if isVisible}
	<div
		class="fixed inset-x-0 bottom-0 z-40 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-[26rem] sm:p-0"
	>
		<Card.Root
			class="gap-4 rounded-b-none border-b-0 py-5 shadow-lg sm:rounded-xl sm:border-b"
			role="region"
			aria-label={m.policy_consent_region_label()}
		>
			<Card.Content class="flex gap-3 px-5 sm:px-6">
				<div
					class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
				>
					<FileCheck2 class="size-5" />
				</div>
				<div class="min-w-0 space-y-1">
					<p class="font-semibold">{m.policy_consent_title()}</p>
					<p class="text-sm leading-relaxed text-muted-foreground">
						{m.policy_consent_description({ version: latestLicense.version })}
					</p>
				</div>
			</Card.Content>
			<Card.Footer class="flex flex-col-reverse gap-2 px-5 sm:flex-row sm:justify-end sm:px-6">
				<Button href="/policies/terms" onclick={dismiss} variant="outline" class="w-full sm:w-auto">
					{m.policy_consent_view()}
				</Button>
				{#if isAuthenticated}
					<Button class="w-full sm:w-auto" disabled={isAccepting} onclick={accept}>
						{isAccepting ? m.policies_accepting() : m.policy_consent_accept()}
					</Button>
				{:else}
					<Button class="w-full sm:w-auto" onclick={dismiss}>{m.policy_consent_not_now()}</Button>
				{/if}
			</Card.Footer>
		</Card.Root>
	</div>
{/if}
