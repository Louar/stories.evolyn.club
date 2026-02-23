<script lang="ts">
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

	function handleKeyDown(event: KeyboardEvent) {
		if (
			event.target instanceof HTMLInputElement ||
			event.target instanceof HTMLTextAreaElement ||
			(event.target instanceof HTMLElement && event.target.contentEditable === 'true')
		) {
			return;
		}

		if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'l') {
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
				aria-label="Toggle columns"
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
					<Command.Item value="default" onSelect={() => (UI.language = 'default')}>
						<span class="truncate">Default</span>
						<CheckIcon
							class={cn(
								'ml-auto size-4 shrink-0',
								UI.language === 'default' ? 'opacity-100' : 'opacity-0'
							)}
						/>
					</Command.Item>
					<Command.Separator class="my-1" />
					{#each Object.values(Language) as l}
						<Command.Item value={LanguageReverse[l]} onSelect={() => (UI.language = l)}>
							<span class="truncate">{LanguageReverse[l]}</span>
							<CheckIcon
								class={cn(
									'ml-auto size-4 shrink-0',
									UI.language === l ? 'opacity-100' : 'opacity-0'
								)}
							/>
						</Command.Item>
					{/each}
				</Command.Group>
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
