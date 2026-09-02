<script lang="ts" module>
	export type LanguageOption = {
		/** Language code (e.g., 'en', 'de') */
		code: string;
		/** Display name (e.g., 'English', 'Deutsch') */
		label: string;
	};
	export type Language = LanguageOption;

	export type LanguageSwitcherProps = {
		/** List of available languages */
		languages?: LanguageOption[];

		/** Current selected language code */
		value?: string;

		/** Dropdown alignment */
		align?: 'start' | 'center' | 'end';

		/** Button variant */
		variant?: 'outline' | 'ghost';

		/** Called when the language changes */
		onChange?: (code: string) => void;

		class?: string;
	};
</script>

<script lang="ts">
	import { page } from '$app/state';
	import { buttonVariants } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { LanguageReverse, type Language as DbLanguage } from '$lib/db/schemas/0-utils';
	import {
		locales as availableLocales,
		getLocale,
		isLocale,
		setLocale
	} from '$lib/paraglide/runtime';
	import { cn } from '$lib/utils.js';
	import GlobeIcon from '@lucide/svelte/icons/globe';

	let {
		languages,
		value = $bindable(page.data.language ?? getLocale()),
		align = 'end',
		variant = 'outline',
		onChange,
		class: className
	}: LanguageSwitcherProps = $props();

	const defaultOnChange = (code: string) => {
		if (isLocale(code) && code !== getLocale()) setLocale(code);
	};

	const resolvedLanguages: LanguageOption[] = $derived.by(() => {
		if (languages) return languages;

		return ((page.data.client?.locales ?? availableLocales) as string[])
			.filter((code: string) => isLocale(code))
			.map((code: string) => ({
				code,
				label: LanguageReverse[code as DbLanguage] ?? code.toUpperCase()
			}));
	});
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		class={cn(buttonVariants({ variant, size: 'icon' }), className)}
		aria-label="Change language"
	>
		<GlobeIcon class="size-4" />
		<span class="sr-only">Change language</span>
	</DropdownMenu.Trigger>
	<DropdownMenu.Content {align}>
		<DropdownMenu.RadioGroup {value} onValueChange={onChange ?? defaultOnChange}>
			{#each resolvedLanguages as language (language.code)}
				<DropdownMenu.RadioItem value={language.code}>
					{language.label}
				</DropdownMenu.RadioItem>
			{/each}
		</DropdownMenu.RadioGroup>
	</DropdownMenu.Content>
</DropdownMenu.Root>
