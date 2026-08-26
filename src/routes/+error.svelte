<script lang="ts">
	import { page } from '$app/state';
	import Header from '$lib/components/app/header/app-header.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { LanguageSwitcher } from '$lib/components/ui/language-switcher';
	import * as m from '$lib/paraglide/messages';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import WindIcon from '@lucide/svelte/icons/wind';
</script>

<Header>
	<h1 class="overflow-hidden text-sm whitespace-nowrap">{m.error_title()}</h1>
	<LanguageSwitcher variant="ghost" class="mr-4 ml-auto" />
</Header>

<div class="w-full px-2">
	<Card.Root class="mx-auto w-full max-w-sm bg-muted">
		<Card.Content>
			<WindIcon class="mx-auto size-32 text-muted-foreground" />
		</Card.Content>
		<Card.Header class="text-center">
			<Card.Title>{m.error_title()}</Card.Title>
			<Card.Description class="font-mono text-xs font-light uppercase"
				>{m.error_status({ status: page.status })}</Card.Description
			>
		</Card.Header>
		<Card.Content class="empty:hidden">
			<p class="text-sm wrap-break-word whitespace-pre-line text-muted-foreground empty:hidden">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html page.error?.message}
			</p>
		</Card.Content>
		<Card.Content class="flex justify-center">
			<Button size="sm" onclick={() => window.location.reload()} class="w-fit">
				<RotateCcwIcon />
				{m.error_retry()}
			</Button>
		</Card.Content>
	</Card.Root>
</div>
