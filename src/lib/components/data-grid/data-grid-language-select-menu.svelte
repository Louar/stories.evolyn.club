<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Language, LanguageReverse } from '$lib/db/schemas/0-utils';
	import { UI } from '$lib/states/ui.svelte';
	import { cn } from '$lib/utils.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import LanguageIcon from '@lucide/svelte/icons/languages';

	interface Props {
		align?: 'start' | 'center' | 'end';
		class?: string;
	}

	let { align = 'end', class: className }: Props = $props();

	let open = $state(false);
	const languages = $derived.by<Array<Language | 'default'>>(() => {
		const locales = (page.data.client?.locales ?? []).filter(
			(locale: Language): locale is Language => Object.values(Language).includes(locale)
		);
		if (locales.length === 1) {
			return locales[0] === Language.English ? [Language.English] : (['default'] as const);
		}
		return ['default', ...locales] as const;
	});

	$effect(() => {
		let isSupported = false;
		for (const language of languages) {
			if (language === UI.language) isSupported = true;
		}
		if (!isSupported) UI.language = languages[0] ?? 'default';
	});

	function handleKeyDown(event: KeyboardEvent) {
		if (!(event.ctrlKey || event.metaKey)) return;

		if (event.key.toLowerCase() === 'k') {
			event.preventDefault();
			const currentIndex = languages.indexOf(UI.language);
			UI.language = languages[(currentIndex + 1) % languages.length];
			return;
		}

		if (event.shiftKey && event.key.toLowerCase() === 'l') {
			event.preventDefault();
			open = !open;
		}
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				aria-label="Select language"
				role="combobox"
				variant="outline"
				size="sm"
				class={cn('h-8 font-normal', className)}
			>
				<LanguageIcon class="text-muted-foreground" />
				{UI.language === 'default' ? 'Default' : LanguageReverse[UI.language]}
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content {align} class="w-44 p-0">
		<Command.Root>
			<Command.Input placeholder="Search languages..." />
			<Command.List>
				<Command.Empty>No languages found.</Command.Empty>
				<Command.Group>
					{#each languages as language, index (language)}
						{#if index === 1 && languages[0] === 'default'}
							<Command.Separator class="my-1" />
						{/if}
						<Command.Item
							value={language === 'default' ? 'default' : LanguageReverse[language]}
							onSelect={() => (UI.language = language)}
						>
							<span class="truncate">
								{language === 'default' ? 'Default' : LanguageReverse[language]}
							</span>
							<CheckIcon
								class={cn(
									'ml-auto size-4 shrink-0',
									UI.language === language ? 'opacity-100' : 'opacity-0'
								)}
							/>
						</Command.Item>
					{/each}
				</Command.Group>
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
