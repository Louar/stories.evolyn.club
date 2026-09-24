<script lang="ts">
	import * as Message from '$lib/components/ai/message';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
</script>

<Message.Root class="mx-auto flex w-full max-w-3xl flex-col items-start gap-2 px-0 md:px-10">
	<div class="group flex w-full flex-col gap-0">
		<div class="prose w-full min-w-0 flex-1 rounded-lg bg-transparent p-0 text-foreground">
			<LoaderCircleIcon class="size-4 animate-spin text-muted-foreground" />
		</div>
	</div>
</Message.Root>
