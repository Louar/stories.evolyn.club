<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import QuizEditor from './QuizEditor.svelte';
	import Slider from './Slider.svelte';

	let { data }: NodeProps = $props();

	let duration = 60;
	let range: number[] = $state([0, 50, 100]);

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

<div class="flex w-64 flex-col rounded-lg border border-stone-400 bg-white py-4 shadow-md">
	<div class="grid w-full gap-2 px-4">
		<div class="">
			<h3 class="text-lg font-semibold uppercase">Media</h3>
		</div>
		<div class="">
			<Dialog.Root>
				<form>
					<Dialog.Trigger
						class="{buttonVariants({ variant: 'outline', size: 'default' })} w-full justify-start"
					>
						Media
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
				</form>
			</Dialog.Root>
		</div>
		<div class="">
			<Input type="text" placeholder="URL" class="" />
		</div>
		<div class="flex gap-3 py-4">
			<!-- <span class="text-sm text-gray-500">{range[0]}s</span> -->
			<Slider bind:range {duration} {hasOverlay} />
			<!-- <span class="text-sm text-gray-500">{range[2]}s</span> -->
		</div>
	</div>

	<div class="relative py-2">
		<Separator />
		<Handle type="target" position={Position.Left} class="size-5! bg-sky-500!" />
		<Handle type="source" position={Position.Right} id="default" class="size-5! bg-indigo-500!" />
	</div>

	<div class="grid w-full gap-2">
		<div class="flex items-center justify-between gap-3 px-4">
			<h3 class="text-lg font-semibold uppercase">Overlay</h3>
			<Select.Root type="single" name="overlayType" bind:value={overlayType}>
				<Select.Trigger class="min-w-12">
					{overlayTypeLabel}
				</Select.Trigger>
				<Select.Content>
					<Select.Group>
						<Select.Item value="">None</Select.Item>
						{#each overlayOptions as option (option.value)}
							<Select.Item value={option.value}>
								{option.label}
							</Select.Item>
						{/each}
					</Select.Group>
				</Select.Content>
			</Select.Root>
		</div>
		{#if overlayType === 'text'}
			<div class="px-4">
				<Textarea />
			</div>
		{:else if overlayType === 'quiz'}
			<div class="px-4">
				<Dialog.Root>
					<Dialog.Trigger class="{buttonVariants({ variant: 'default', size: 'sm' })} w-full">
						Configure quiz
					</Dialog.Trigger>
					<QuizEditor />
				</Dialog.Root>
			</div>
			<div class="relative px-4">
				<p>All correct</p>
				<Handle
					type="source"
					position={Position.Right}
					id="correct"
					class="size-5! bg-emerald-500!"
				/>
			</div>
			<div class="relative px-4">
				<p>Incorrect</p>
				<Handle
					type="source"
					position={Position.Right}
					id="incorrect"
					class="size-5! bg-rose-500!"
				/>
			</div>
		{/if}
	</div>
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
