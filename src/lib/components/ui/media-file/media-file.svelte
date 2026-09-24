<script lang="ts">
	import { MediaCollection, type Media } from '$lib/db/schemas/0-utils';
	import { cn } from '$lib/utils';
	import FileVideoIcon from '@lucide/svelte/icons/file-video-camera';

	type Props = {
		src?: Media | null;
		class?: string;
	};
	let { src, class: className }: Props = $props();

	let isLoading: boolean = $state(true);
	let source: string | null = $state(null);
	let extension: string = $state('(null)');

	$effect(() => {
		if (src?.collection?.length && src?.filename?.length) {
			extension = src?.filename?.split('.')?.at(-1) || '(null)';
			load(src.collection, src.filename);
		}
	});

	const load = async (collection: MediaCollection, filename: string) => {
		isLoading = true;
		let url = `/api/media/${collection}/${filename}`;
		if (collection === MediaCollection.externals) {
			source = filename;
		} else {
			try {
				const res = await fetch(url);
				if (res.ok) {
					const blob = await res.blob();
					source = URL.createObjectURL(blob);
				}
			} catch {
				//
			}
		}
		isLoading = false;
	};
</script>

{#if source}
	{#if src?.collection === MediaCollection.externals || ['jpeg', 'jpg', 'png', 'svg', 'gif', 'webp'].includes(extension)}
		<img class={cn('w-full object-cover', className)} src={source} alt={src?.filename} />
	{:else if ['mp4', 'mov'].includes(extension)}
		<FileVideoIcon class={cn('size-12 text-primary', className)} />
	{:else}
		<span class="font-semibold text-muted">?</span>
	{/if}
{:else}
	<span class={cn('h-auto font-semibold text-muted', className)}> &mdash; </span>
{/if}
