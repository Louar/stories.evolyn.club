<script lang="ts">
	import highlighter from '$lib/client/shiki';
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';
	import { translateLocalizedField, type Translatable } from '$lib/db/schemas/0-utils';
	import { UI } from '$lib/states/ui.svelte';
	import { cn, type WithElementRef, type WithoutChildren } from '$lib/utils.js';
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import LanguageSelector from '../language-selector/language-selector.svelte';

	type Props = {
		value?: Translatable | null;
		languageselector?: boolean;
		ismarkdown?: boolean;
	} & Omit<WithoutChildren<WithElementRef<HTMLTextareaAttributes>>, 'value'>;
	let {
		ref = $bindable(null),
		value = $bindable(),
		languageselector = false,
		ismarkdown = true,
		class: className,
		placeholder,
		oninput,
		...restProps
	}: Props = $props();

	let preview: HTMLDivElement | null = $state(null);
	const localize = (text?: string) => {
		if (ismarkdown) {
			return highlighter.codeToHtml(text ?? '', {
				lang: 'markdown',
				themes: {
					light: 'snazzy-light',
					dark: 'aurora-x'
				},
				defaultColor: 'light-dark()'
			});
		}
	};

	const previewHtml = $derived.by(() => (ismarkdown ? (localize(value?.[UI.language]) ?? '') : ''));

	const previewAttachment = (node: HTMLDivElement) => {
		preview = node;
		$effect(() => {
			node.innerHTML = previewHtml;
		});
		return () => {
			if (preview === node) preview = null;
		};
	};
</script>

<div class="relative w-full">
	{#if ismarkdown}
		<div
			{@attach previewAttachment}
			class="absolute inset-0 -z-10 overflow-hidden rounded-md [&>pre]:h-full [&>pre]:px-3 [&>pre]:py-2 [&>pre]:font-mono! [&>pre]:text-sm! [&>pre]:wrap-break-word [&>pre]:whitespace-pre-wrap"
		></div>
		<Textarea
			bind:ref
			spellcheck="false"
			value={value?.[UI.language] ?? ''}
			oninput={(e) => {
				value = { ...(value ?? {}), [UI.language]: e.currentTarget.value };
				oninput?.(e);
			}}
			class={cn(
				'scrollbar-none max-h-196 bg-transparent font-mono text-sm! text-transparent caret-foreground',
				className,
				{
					'opacity-40': !value?.[UI.language]
				}
			)}
			onscroll={(e) => {
				if (!preview) return;
				preview.scrollTop = e.currentTarget.scrollTop;
				preview.scrollLeft = e.currentTarget.scrollLeft;
			}}
			placeholder={translateLocalizedField(value) ?? placeholder}
			{...restProps}
		/>
	{:else}
		<Textarea
			bind:ref
			value={value?.[UI.language] ?? ''}
			oninput={(e) => {
				value = { ...(value ?? {}), [UI.language]: e.currentTarget.value };
				oninput?.(e);
			}}
			placeholder={translateLocalizedField(value)?.length
				? translateLocalizedField(value)
				: placeholder}
			class={cn('', className)}
			{...restProps}
		/>
	{/if}

	{#if languageselector}
		<LanguageSelector />
	{/if}
</div>
