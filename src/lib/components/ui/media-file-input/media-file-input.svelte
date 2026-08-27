<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { MediaFile } from '$lib/components/ui/media-file/index.js';
	import { MediaCollection, type Media } from '$lib/db/schemas/0-utils';
	import { cn } from '$lib/utils.js';
	import DeleteIcon from '@lucide/svelte/icons/delete';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import FileImageIcon from '@lucide/svelte/icons/file-image';
	import FileVideoIcon from '@lucide/svelte/icons/file-video';
	import LinkIcon from '@lucide/svelte/icons/link';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import { toast } from 'svelte-sonner';
	import Separator from '../separator/separator.svelte';

	type Props = {
		value?: Media | null;
		accept?: string;
		placeholder?: string;
		uploadCollection?: MediaCollection;
		preview?: 'image' | 'video' | 'file';
		disabled?: boolean;
		class?: string;
		onValueChange?: (value: Media | null) => void;
	};

	let {
		value = $bindable(null),
		accept,
		placeholder = 'https://',
		uploadCollection = MediaCollection.clients,
		preview = 'file',
		disabled = false,
		class: className,
		onValueChange
	}: Props = $props();

	const isExternal = $derived(value?.collection === MediaCollection.externals);
	const filename = $derived(value?.filename ?? '');
	const acceptedTypes = $derived(accept ? accept.split(',').map((type) => type.trim()) : null);

	let urlValue = $derived(isExternal ? filename : '');
	let isDragging = $state(false);
	let isUploading = $state(false);
	let fileInputRef = $state<HTMLInputElement | null>(null);

	function mediaUrl(media: Media): string {
		return media.collection === MediaCollection.externals
			? media.filename
			: `/api/media/${media.collection}/${media.filename}`;
	}

	function isUrl(input: string): boolean {
		try {
			const url = new URL(input);
			return url.protocol === 'http:' || url.protocol === 'https:';
		} catch {
			return false;
		}
	}

	function isAcceptedFile(file: File): boolean {
		if (!acceptedTypes?.length) return true;

		const fileType = file.type.toLowerCase();
		const fileName = file.name.toLowerCase();
		return acceptedTypes.some((type) => {
			const pattern = type.toLowerCase();
			if (pattern.endsWith('/*')) return fileType.startsWith(`${pattern.slice(0, -2)}/`);
			if (pattern.startsWith('.')) return fileName.endsWith(pattern);
			return fileType === pattern;
		});
	}

	function setValue(nextValue: Media | null) {
		value = nextValue;
		onValueChange?.(nextValue);
	}

	function addUrl() {
		if (disabled || isUploading) return;

		const trimmedUrl = urlValue.trim();
		if (!trimmedUrl) {
			setValue(null);
			return;
		}
		if (!isUrl(trimmedUrl)) {
			toast.error('Enter a valid http or https URL');
			return;
		}

		setValue({ collection: MediaCollection.externals, filename: trimmedUrl });
	}

	async function uploadFile(file: File) {
		if (disabled || isUploading) return;
		if (!isAcceptedFile(file)) {
			toast.error('File type not accepted');
			return;
		}

		const formData = new FormData();
		formData.set('file', file);
		const safeFilename = file.name.toLowerCase().replaceAll(' ', '-');

		isUploading = true;
		try {
			const result = await fetch(
				`/api/media/${uploadCollection}/${encodeURIComponent(safeFilename)}`,
				{ method: 'POST', body: formData }
			);
			if (!result.ok) throw new Error(result.statusText || 'Upload failed');

			setValue((await result.json()) as Media);
			urlValue = '';
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Upload failed');
		} finally {
			isUploading = false;
		}
	}

	function handleFileInputChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) void uploadFile(file);
		input.value = '';
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
		const file = event.dataTransfer?.files?.[0];
		if (file) void uploadFile(file);
	}

	function handleUrlKeyDown(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		addUrl();
	}

	function fileInputAttachment(node: HTMLInputElement) {
		fileInputRef = node;
		return () => {
			fileInputRef = null;
		};
	}
</script>

<div
	class={cn('space-y-2', className)}
	oninput={(event) => event.stopPropagation()}
	onchange={(event) => event.stopPropagation()}
>
	<div
		role="group"
		aria-label="Media file or URL input"
		class={cn(
			'rounded-md border border-dashed bg-muted/30 p-2 transition-colors',
			isDragging && 'border-primary bg-accent/40',
			disabled && 'opacity-60'
		)}
		ondragenter={(event) => {
			event.preventDefault();
			if (!disabled && !isUploading) isDragging = true;
		}}
		ondragover={(event) => event.preventDefault()}
		ondragleave={() => (isDragging = false)}
		ondrop={handleDrop}
	>
		<div class="flex items-center">
			<div class="relative size-18 shrink-0">
				<div
					class="grid size-full place-items-center overflow-hidden rounded-md border bg-background"
				>
					{#if isUploading}
						<LoaderCircleIcon class="size-5 animate-spin text-muted-foreground" />
					{:else if value && preview === 'image'}
						<MediaFile src={value} class="size-full" />
					{:else if value && preview === 'video'}
						<FileVideoIcon class="size-5 text-muted-foreground" />
					{:else if value && isExternal}
						<LinkIcon class="size-5 text-muted-foreground" />
					{:else if value}
						<FileImageIcon class="size-5 text-muted-foreground" />
					{:else}
						<UploadIcon class="size-5 text-muted-foreground" />
					{/if}
				</div>
				{#if value}
					<Badge
						variant="default"
						class="absolute -top-1 -right-1 shrink-0 px-1 py-0 text-[0.55rem] uppercase"
					>
						{isExternal ? 'URL' : 'Stored'}
					</Badge>
				{/if}
			</div>
			<div class="ml-1 flex shrink-0 flex-col justify-end gap-1">
				{#if value}
					<Button
						type="button"
						variant="destructive"
						size="icon-sm"
						disabled={disabled || isUploading}
						onclick={() => setValue(null)}
					>
						<DeleteIcon />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						href={mediaUrl(value)}
						target="_blank"
					>
						<ExternalLinkIcon />
					</Button>
				{/if}
			</div>
			<div class="ml-3 grow">
				{#if value}
					<p class="text-sm text-muted-foreground">
						{filename}
					</p>
				{:else}
					<p class="truncate text-sm text-muted-foreground italic">Drop file here&hellip;</p>
				{/if}
			</div>
		</div>

		<input
			{@attach fileInputAttachment}
			type="file"
			{accept}
			class="sr-only"
			disabled={disabled || isUploading}
			onchange={handleFileInputChange}
		/>
	</div>

	<div class="flex items-center">
		<Button
			type="button"
			variant="outline"
			size="sm"
			disabled={disabled || isUploading}
			onclick={() => fileInputRef?.click()}
		>
			Browse files
		</Button>
		<Separator orientation="vertical" class="mx-2 h-5" />
		<Input
			type="url"
			{placeholder}
			aria-label="Media URL"
			bind:value={urlValue}
			disabled={disabled || isUploading}
			onkeydown={handleUrlKeyDown}
			class="mr-1 h-8"
		/>
		<Button
			type="button"
			variant="outline"
			size="sm"
			disabled={disabled || isUploading}
			onclick={addUrl}
		>
			Add URL
		</Button>
	</div>
</div>
