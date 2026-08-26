<!--
	Installed from @ieedan/shadcn-svelte-extras
-->

<script lang="ts">
	import { buttonVariants, type ButtonSize, type ButtonVariant } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import { box } from 'svelte-toolbelt';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { useEmojiPickerSkinToneSelector } from './emoji-picker.svelte.js';
	import type { EmojiPickerSkinPropsWithoutHTML } from './types.js';

	type Props = EmojiPickerSkinPropsWithoutHTML &
		HTMLButtonAttributes & {
			ref?: HTMLButtonElement | null;
			variant?: ButtonVariant;
			size?: ButtonSize;
		};

	let {
		previewEmoji = '👋',
		variant = 'outline',
		size = 'icon',
		class: className,
		onclick,
		...rest
	}: Props = $props();

	const skinState = useEmojiPickerSkinToneSelector({
		previewEmoji: box.with(() => previewEmoji)
	});

	const handleClick: HTMLButtonAttributes['onclick'] = (e) => {
		onclick?.(e);
		skinState.cycleSkinTone();
	};
</script>

<button
	{...rest}
	type="button"
	class={cn(buttonVariants({ variant, size }), 'size-8', className)}
	onclick={handleClick}
>
	{skinState.preview}
</button>
