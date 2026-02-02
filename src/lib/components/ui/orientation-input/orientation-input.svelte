<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import {
		orientateOrientationableField,
		Orientation,
		type Orientationable
	} from '$lib/db/schemas/0-utils';
	import { EDITORS } from '$lib/states/editors.svelte';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import GalleryHorizontalIcon from '@lucide/svelte/icons/gallery-horizontal';
	import GalleryVerticalIcon from '@lucide/svelte/icons/gallery-vertical';
	import SquareIcon from '@lucide/svelte/icons/square';
	import SquareAsteriskIcon from '@lucide/svelte/icons/square-asterisk';
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from 'svelte/elements';

	type Props = {
		value?: Orientationable | null;
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
		class: className,
		placeholder,
		oninput,
		...restProps
	}: Props = $props();
</script>

<div class="flex gap-2">
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="outline" class={cn('', className)}>
					{#if EDITORS.orientation === 'default'}
						<SquareAsteriskIcon />
					{:else if EDITORS.orientation === Orientation.portrait}
						<GalleryHorizontalIcon />
					{:else if EDITORS.orientation === Orientation.landscape}
						<GalleryVerticalIcon />
					{:else}
						<SquareIcon />
					{/if}
					<ChevronsUpDownIcon class="opacity-50" />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content class="w-56" align="start">
			<DropdownMenu.Group>
				<DropdownMenu.Label>Orientation</DropdownMenu.Label>
				<DropdownMenu.Separator />
				<DropdownMenu.RadioGroup bind:value={EDITORS.orientation}>
					<DropdownMenu.RadioItem value="default">Default</DropdownMenu.RadioItem>
					<DropdownMenu.Separator />
					{#each Object.values(Orientation) as l}
						<DropdownMenu.RadioItem value={l} class="space-x-0.5">
							<span class="first-letter:uppercase">
								{Object.entries(Orientation).find(([key, value]) => value === l)?.[0]}
							</span>
						</DropdownMenu.RadioItem>
					{/each}
				</DropdownMenu.RadioGroup>
			</DropdownMenu.Group>
		</DropdownMenu.Content>
	</DropdownMenu.Root>

	<Input
		class={cn('w-full', className)}
		type="text"
		value={value?.[EDITORS.orientation] ?? ''}
		oninput={(e) => {
			value = { ...value, [EDITORS.orientation]: e.currentTarget.value };
			oninput?.(e);
		}}
		placeholder={orientateOrientationableField(value)?.length
			? orientateOrientationableField(value)
			: placeholder}
		{...restProps}
	/>
</div>
