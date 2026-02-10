<script lang="ts">
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import WindIcon from '@lucide/svelte/icons/wind';

	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	import { page } from '$app/state';
</script>

<div class="w-full p-4">
	<Card.Root class="mx-auto w-full max-w-sm bg-muted">
		<Card.Content>
			<WindIcon class="mx-auto size-32 text-muted-foreground" />
		</Card.Content>
		<Card.Header class="text-center">
			<Card.Title>Oops, something went wrong&hellip;</Card.Title>
			<Card.Description class="empty:hidden">
				{@html page.error?.message}
			</Card.Description>
			<Button size="sm" onclick={() => window.location.reload()} class="mx-auto mt-2 w-fit">
				<RotateCcwIcon />
				Try again
			</Button>
		</Card.Header>
	</Card.Root>
</div>
