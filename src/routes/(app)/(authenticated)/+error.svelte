<script lang="ts">
	import PanelLeftIcon from '@lucide/svelte/icons/panel-left';
	import WindIcon from '@lucide/svelte/icons/wind';

	import Header from '$lib/components/nav/app-header.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	import { page } from '$app/state';
</script>

<Header>
	<h1 class="overflow-hidden text-sm whitespace-nowrap">Oeps, er ging iets mis&hellip;</h1>
</Header>

<div class="w-full px-2">
	<Card.Root class="mx-auto w-full max-w-sm bg-muted">
		<Card.Content>
			<WindIcon class="mx-auto size-32 text-muted-foreground" />
		</Card.Content>
		<Card.Header class="text-center">
			<Card.Title>Oeps, er ging iets mis&hellip;</Card.Title>
			<Card.Description class="empty:hidden">
				{@html page.error?.message}
			</Card.Description>
			<Button size="sm" onclick={() => window.location.reload()} class="mx-auto mt-2 w-fit">
				<PanelLeftIcon />
				Probeer opnieuw
			</Button>
		</Card.Header>
	</Card.Root>
</div>
