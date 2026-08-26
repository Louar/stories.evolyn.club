<script lang="ts">
	export type PatchErrorToastItem = {
		field: string;
		messages: string[];
	};

	interface Props {
		items: PatchErrorToastItem[];
	}

	let { items }: Props = $props();
</script>

<div class="grid gap-2">
	<p class="font-medium">Could not update row</p>
	{#if items.length}
		<ol class="list-decimal space-y-1 pl-4 text-xs">
			{#each items as item (item.field)}
				<li>
					<span class="font-medium capitalize">{item.field}</span>
					<ul class="list-disc space-y-0.5 pl-4">
						{#each item.messages as message (message)}
							<li class="font-normal">{message}</li>
						{/each}
					</ul>
				</li>
			{/each}
		</ol>
	{/if}
</div>
