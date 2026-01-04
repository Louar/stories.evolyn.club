<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import QuizEditor from './QuizEditor.svelte';
	import Slider from './Slider.svelte';

	let { data }: NodeProps & { data: { duration: number; range: number[] } } = $props();

	let duration = $state(data.duration ?? 300);
	let range = $state(data.range ?? [0, 50, 100]);

	const overlayOptions = [
		{ value: 'text', label: 'Text' },
		{ value: 'quiz', label: 'Quiz' }
	];
	let overlayType = $state('quiz');

	let overlayTypeLabel = $derived(
		overlayOptions.find((o) => o.value === overlayType)?.label ?? 'None'
	);
	let hasOverlay = $derived(overlayOptions.find((o) => o.value === overlayType) ? true : false);
</script>

<div class="flex w-64 flex-col rounded-lg border border-stone-400 bg-white py-3 shadow-md">
	<div class="relative grid w-full gap-2">
		<div class="relative px-2">
			<Dialog.Root>
				<Dialog.Trigger
					class="flex w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground"
					data-placeholder
				>
					Select media&hellip;
					<ChevronDownIcon class="size-4 opacity-50" />
				</Dialog.Trigger>
				<Dialog.Content class="sm:max-w-106.25">
					<Dialog.Header>
						<Dialog.Title>Edit profile</Dialog.Title>
						<Dialog.Description>
							Make changes to your profile here. Click save when you're done.
						</Dialog.Description>
					</Dialog.Header>
					<div class="grid gap-4">
						<div class="grid gap-3">
							<Label for="name-1">Name</Label>
							<Input id="name-1" name="name" defaultValue="Pedro Duarte" />
						</div>
						<div class="grid gap-3">
							<Label for="username-1">Username</Label>
							<Input id="username-1" name="username" defaultValue="@peduarte" />
						</div>
					</div>
					<Dialog.Footer>
						<Dialog.Close class={buttonVariants({ variant: 'outline' })}>Cancel</Dialog.Close>
						<Button type="submit">Save changes</Button>
					</Dialog.Footer>
				</Dialog.Content>
			</Dialog.Root>

			<Handle type="target" position={Position.Left} class="size-4! bg-blue-400!" />
			<Handle type="source" position={Position.Right} id="default" class="size-4! bg-orange-300!" />
		</div>
		<div class="px-2">
			<Dialog.Root>
				<Dialog.Trigger
					class="flex w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground"
					data-placeholder
				>
					Select overlay&hellip;
					<ChevronDownIcon class="size-4 opacity-50" />
				</Dialog.Trigger>
				<QuizEditor />
			</Dialog.Root>
		</div>

		<div class="flex gap-3 p-4">
			<Slider bind:range {duration} {hasOverlay} />
		</div>
	</div>

	{#if overlayType === 'quiz'}
		<Separator class="mt-1 mb-3" />
		<div class="grid w-full gap-2">
			<div class="relative px-2">
				<p class="text-sm">All correct</p>
				<Handle
					type="source"
					position={Position.Right}
					id="correct"
					class="size-4! bg-amber-300!"
				/>
			</div>
			<div class="relative px-2">
				<p class="text-sm">Some incorrect</p>
				<Handle
					type="source"
					position={Position.Right}
					id="incorrect"
					class="size-4! bg-amber-300!"
				/>
			</div>
		</div>
	{/if}
	<!-- <div class="flex p-2">
		<div class="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
			{data.emoji}
		</div>
		<div class="ml-2">
			<div class="text-lg font-bold">{data.name}</div>
			<div class="text-gray-500">{data.job}</div>
		</div>
	</div> -->
</div>
