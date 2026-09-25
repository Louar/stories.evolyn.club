<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { demos, type DemoKind } from '$lib/demos/catalog';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import { toast } from 'svelte-sonner';

	let { kind }: { kind: DemoKind } = $props();
	let pending = $state<string | null>(null);
	let errorMessage = $state('');
	let status = $state('');

	async function create(slug: string, name: string) {
		if (pending) return;
		pending = slug;
		errorMessage = '';
		status = `Creating ${name} and any dependencies...`;
		try {
			const response = await fetch(`/api/demos/${kind}/${slug}`, { method: 'POST' });
			const result = await response.json().catch(() => null);
			if (!response.ok) throw new Error(result?.message ?? 'Demo creation failed');
			if (typeof result?.slug !== 'string') throw new Error('Invalid demo creation response');
			status = `Created ${name} as ${result.slug}.`;
			toast.success(`Created ${name}`);
		} catch (error) {
			status = '';
			errorMessage = error instanceof Error ? error.message : 'Demo creation failed';
			toast.error(errorMessage);
		} finally {
			try {
				await invalidateAll();
			} catch {
				errorMessage ||= 'Could not refresh the list. Reload the page to see imported records.';
			}
			pending = null;
		}
	}
</script>

<section aria-label="Demo examples" class="space-y-3">
	<div>
		<h2 class="text-base font-semibold">Start with an example</h2>
		<p class="text-sm text-muted-foreground">
			Create an independent copy to explore and edit. Existing records are never replaced.
			{#if kind !== 'taxonomies'}Stories and anthologies are created unpublished.{/if}
		</p>
	</div>
	<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each demos[kind] as demo (demo.slug)}
			<article class="flex flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground">
				<h3 class="font-medium">{demo.name}</h3>
				<p class="flex-1 text-sm text-muted-foreground">{demo.description}</p>
				<Button
					variant="outline"
					class="self-start"
					disabled={pending !== null}
					onclick={() => create(demo.slug, demo.name)}
					aria-label={`Create ${demo.name}`}
				>
					{#if pending === demo.slug}<LoaderCircleIcon class="animate-spin" />{:else}<PlusIcon
						/>{/if}
					{pending === demo.slug ? 'Creating...' : 'Create demo'}
				</Button>
			</article>
		{/each}
	</div>
	<p class="text-sm text-muted-foreground" role="status">{status}</p>
	{#if errorMessage}<p class="text-sm text-destructive" role="alert">{errorMessage}</p>{/if}
</section>
