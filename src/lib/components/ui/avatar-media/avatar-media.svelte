<script lang="ts">
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import type { Media, MediaCollection } from '$lib/db/schemas/0-utils';
	import { cn } from '$lib/utils.js';

	type Props = {
		src?: Media | null;
		fallback?: string | null;
		class?: string;
	};
	let { src, fallback, class: className, ...restProps }: Props = $props();

	let isLoading: boolean = $state(true);
	let source: string | null = $state(null);
	let extension: string = $state('(null)');

	$effect(() => {
		extension = src?.filename?.split('.')?.at(-1) || '(null)';
		if (src?.collection?.length && src?.filename?.length) load(src.collection, src.filename);
	});

	const load = async (collection: MediaCollection, filename: string) => {
		isLoading = true;
		let url = `/api/media/${collection}/${filename}`;
		if (collection === 'externals') {
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

<Avatar.Root class={cn('[container-type:size] relative aspect-square', className)} {...restProps}>
	<Avatar.Image src={source} class="object-cover" />
	<Avatar.Fallback class={cn('border text-[60cqi] text-muted-foreground', className)}
		>{fallback || '?'}</Avatar.Fallback
	>
</Avatar.Root>
