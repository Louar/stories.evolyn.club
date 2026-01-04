<script lang="ts">
	import type { ClassValue } from 'clsx';
	import { fade, fly } from 'svelte/transition';

	type Props = {
		title?: string | null | undefined;
		message?: string | null | undefined;
		class?: ClassValue | null | undefined;
	};
	let { title, message, class: className }: Props = $props();
</script>

<div class="absolute inset-0 z-20 bg-black/20 backdrop-blur-md" in:fade={{ duration: 250 }}></div>

<div class="absolute inset-0 z-30 flex overflow-y-auto px-8 py-16 text-white md:py-20">
	<div class="mx-auto mt-auto flex min-h-min w-full max-w-sm flex-col gap-4">
		<!-- <p transition:fade>{i}</p> -->
		<div
			in:fly|global={{
				y: 20,
				duration: 250,
				delay: 250
			}}
			out:fly|global={{
				y: 20,
				duration: 250
			}}
		>
			{#if title?.length}
				<h3 class="text-lg font-medium md:text-2xl">
					{@html title}
				</h3>
			{/if}
			{#if message?.length}
				<h3 class="text-lg md:text-xl">
					{@html message}
				</h3>
			{/if}
		</div>
	</div>
</div>
