<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import { translateLocalizedField, type Translatable } from '$lib/db/schemas/0-utils';
	import { EDITORS } from '$lib/states/editors.svelte';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from 'svelte/elements';
	import LanguageSelector from '../language-selector/language-selector.svelte';
	import { UI } from '$lib/states/ui.svelte';

	type Props = {
		value?: Translatable | null;
		languageselector?: boolean;
	} & WithElementRef<
		Omit<HTMLInputAttributes, 'type' | 'value'> &
			(
				| { type: 'file'; files?: FileList }
				| { type?: Exclude<HTMLInputTypeAttribute, 'file'>; files?: undefined }
			)
	>;
	let {
		ref = $bindable(null),
		value = $bindable(),
		languageselector = false,
		class: className,
		placeholder,
		...restProps
	}: Props = $props();
</script>

<div class="flex gap-2">
	<Input
		class={cn('w-full', className)}
		type="text"
		value={value?.[UI.language] ?? ''}
		oninput={(e) => (value = { ...value, [UI.language]: e.currentTarget.value })}
		placeholder={translateLocalizedField(value)?.length
			? translateLocalizedField(value)
			: placeholder}
		{...restProps}
	/>

	{#if languageselector}
		<LanguageSelector />
	{/if}
</div>
