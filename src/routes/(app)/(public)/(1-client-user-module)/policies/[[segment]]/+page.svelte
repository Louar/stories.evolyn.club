<script lang="ts">
	import HeaderBlank from '$lib/components/app/header/app-header-blank.svelte';
	import { acceptLatestPolicy, type PolicyAcceptance } from '$lib/client/policies';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';

	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';

	let { data } = $props();
	let license = $derived(data.license);
	let acceptedPolicy = $state<PolicyAcceptance | null>(null);
	let isAccepting = $state(false);
	let latestAgreement = $derived(
		acceptedPolicy && acceptedPolicy.license.version === license?.version
			? acceptedPolicy.agreement
			: data.policyState.latestAgreement
	);
	let mostRecentAgreement = $derived(
		acceptedPolicy
			? {
					version: acceptedPolicy.license.version,
					acceptedAt: acceptedPolicy.agreement.acceptedAt
				}
			: data.policyState.mostRecentAgreement
	);

	let segment = $derived(page.params.segment ?? 'terms');

	const formatDateTime = (value: Date | string) =>
		new Intl.DateTimeFormat(getLocale(), {
			dateStyle: 'long',
			timeStyle: 'short'
		}).format(new Date(value));

	const accept = async () => {
		isAccepting = true;
		try {
			acceptedPolicy = await acceptLatestPolicy();
			void invalidate('app:policy-state');
			toast.success(m.policies_accept_success());
		} catch (error) {
			toast.error(error instanceof Error ? error.message : m.policies_accept_error());
		} finally {
			isAccepting = false;
		}
	};
</script>

<div class="mx-auto w-full max-w-2xl">
	<HeaderBlank>
		<Button variant="ghost" size="icon" class="-ml-1 size-7" onclick={() => window.history.back()}>
			<ArrowLeft class="size-6" />
		</Button>
		<Separator orientation="vertical" class="mr-2 data-[orientation=vertical]:h-4" />
		<h1 class="overflow-hidden text-sm whitespace-nowrap">{m.policies_title()}</h1>
	</HeaderBlank>

	{#if license?.termsOfUse || license?.privacyPolicy}
		{#if data.authusr}
			<section
				class="mx-4 mb-8 rounded-xl border bg-muted/30 p-4"
				aria-labelledby="policy-status-title"
			>
				<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div class="space-y-2 text-sm">
						<div>
							<h2 id="policy-status-title" class="font-semibold">{m.policies_status_title()}</h2>
							<p class="text-muted-foreground">
								{m.policies_latest_version({ version: license.version })}
							</p>
						</div>
						{#if latestAgreement?.isAccepted}
							<p class="text-foreground">
								{m.policies_accepted_version_at({
									date: formatDateTime(latestAgreement.acceptedAt)
								})}
							</p>
						{:else if mostRecentAgreement}
							<p class="text-muted-foreground">
								{m.policies_recent_accepted_version({
									version: mostRecentAgreement.version,
									date: formatDateTime(mostRecentAgreement.acceptedAt)
								})}
							</p>
						{:else}
							<p class="text-muted-foreground">{m.policies_none_accepted()}</p>
						{/if}
					</div>
					{#if !latestAgreement?.isAccepted}
						<Button class="w-full sm:w-auto" disabled={isAccepting} onclick={accept}>
							{isAccepting
								? m.policies_accepting()
								: m.policies_accept_version({ version: license.version })}
						</Button>
					{/if}
				</div>
			</section>
		{/if}

		<Tabs.Root bind:value={segment} class="w-full pb-12">
			<Tabs.List class="mx-auto mb-12">
				<Tabs.Trigger value="terms">{m.auth_terms()}</Tabs.Trigger>
				<Tabs.Trigger value="privacy">{m.auth_privacy()}</Tabs.Trigger>
			</Tabs.List>
			<Tabs.Content value="terms">
				{#if license.termsOfUse}
					<div class="prose prose-lg w-full px-4">
						<p class="mb-1 text-sm font-medium text-muted-foreground">{license.version}</p>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html license.termsOfUse}
					</div>
				{:else}
					<Empty.Root class="mx-auto min-h-84 max-w-md border border-dashed">
						<Empty.Header>
							<Empty.Title>{m.policies_not_found()}</Empty.Title>
							<Empty.Description>{m.policies_terms_missing()}</Empty.Description>
						</Empty.Header>
					</Empty.Root>
				{/if}
			</Tabs.Content>
			<Tabs.Content value="privacy">
				{#if license.privacyPolicy}
					<div class="prose prose-lg w-full px-4">
						<p class="mb-1 text-sm font-medium text-muted-foreground">{license.version}</p>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html license.privacyPolicy}
					</div>
				{:else}
					<Empty.Root class="mx-auto min-h-84 max-w-md border border-dashed">
						<Empty.Header>
							<Empty.Title>{m.policies_not_found()}</Empty.Title>
							<Empty.Description>{m.policies_privacy_missing()}</Empty.Description>
						</Empty.Header>
					</Empty.Root>
				{/if}
			</Tabs.Content>
		</Tabs.Root>
	{:else}
		<Empty.Root class="mx-auto max-w-sm bg-muted">
			<Empty.Header>
				<Empty.Title>{m.policies_not_found()}</Empty.Title>
				<Empty.Description>{m.policies_both_missing()}</Empty.Description>
			</Empty.Header>
		</Empty.Root>
	{/if}
</div>
