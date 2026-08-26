<script lang="ts" generics="TData">
	import {
		hasFileUploadHandler,
		isAcknowledgedCellValueCurrent
	} from '$lib/components/data-grid/data-grid-actions.js';
	import {
		getFileCellItems,
		isDeletableUploadedMedia,
		isExternalMedia,
		normalizeFiles
	} from '$lib/components/data-grid/data-grid-media.js';
	import type {
		CellVariantProps,
		DataGridMutationResult,
		FileCellData
	} from '$lib/components/data-grid/types/data-grid.js';
	import { getLineCount } from '$lib/components/data-grid/types/data-grid.js';
	import { AvatarMedia } from '$lib/components/ui/avatar-media/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { PopoverContent } from '$lib/components/ui/popover/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { MediaCollection } from '$lib/db/schemas/0-utils.js';
	import { useBadgeOverflow } from '$lib/hooks/use-badge-overflow.svelte.js';
	import { cn } from '$lib/utils.js';
	import FileIcon from '@lucide/svelte/icons/file';
	import FileArchive from '@lucide/svelte/icons/file-archive';
	import FileImage from '@lucide/svelte/icons/file-image';
	import FileMusic from '@lucide/svelte/icons/file-music';
	import FileSpreadsheet from '@lucide/svelte/icons/file-spreadsheet';
	import FileText from '@lucide/svelte/icons/file-text';
	import FileVideo from '@lucide/svelte/icons/file-video';
	import Link from '@lucide/svelte/icons/link';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import Presentation from '@lucide/svelte/icons/presentation';
	import Upload from '@lucide/svelte/icons/upload';
	import X from '@lucide/svelte/icons/x';
	import { Popover as PopoverPrimitive } from 'bits-ui';
	import { onDestroy, type Component } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { SvelteMap } from 'svelte/reactivity';
	import DataGridCellWrapper from '../data-grid-cell-wrapper.svelte';

	let {
		cell,
		table,
		rowIndex,
		columnId,
		isEditing,
		isFocused,
		isSelected,
		readOnly = false,
		cellValue
	}: CellVariantProps<TData> = $props();

	const initialCellValue = $derived.by(() => {
		const files = getFileCellItems(cellValue);
		return files.length ? files : null;
	});

	type FileCellItem = FileCellData & {
		localFile?: File;
		isUploading?: boolean;
	};

	let filesState = $state<FileCellItem[] | null>(null);
	let urlValue = $state('');
	let isDraggingOver = $state(false);
	let isDragging = $state(false);
	let isUploading = $state(false);
	let error = $state<string | null>(null);
	let containerRef = $state<HTMLDivElement | null>(null);
	let fileInputRef = $state<HTMLInputElement | null>(null);
	let dropzoneRef = $state<HTMLButtonElement | null>(null);
	let urlInputRef = $state<HTMLInputElement | null>(null);
	const cellOpts = $derived(cell.column.columnDef.meta?.cell);
	const sideOffset = $derived(-(containerRef?.clientHeight ?? 0));

	const fileCellOpts = $derived(cellOpts?.variant === 'file-or-url' ? cellOpts : null);
	const maxFileSize = $derived(fileCellOpts?.maxFileSize ?? 10 * 1024 * 1024);
	const maxFiles = $derived(fileCellOpts?.maxFiles ?? 10);
	const accept = $derived(fileCellOpts?.accept);
	const multiple = $derived(fileCellOpts?.multiple ?? true);
	const canUploadFiles = $derived(hasFileUploadHandler(table.options.meta?.onFilesUpload));

	const acceptedTypes = $derived(accept ? accept.split(',').map((t) => t.trim()) : null);
	const acceptsImages = $derived(acceptedTypes?.includes('image/*') ?? false);

	let editingSessionActive = false;
	let editingSessionGeneration = 0;
	let errorResetTimer: ReturnType<typeof setTimeout> | undefined;

	const cloneInitialFiles = () =>
		((initialCellValue as FileCellItem[] | null) ?? []).map((file) => ({ ...file }));

	const viewFiles = $derived(isEditing ? filesState : (initialCellValue as FileCellItem[]));

	// A controlled popover does not necessarily emit an initial `onOpenChange(true)`.
	// Initialize the editable state when the cell enters edit mode instead.
	$effect(() => {
		if (isEditing && !editingSessionActive) {
			editingSessionActive = true;
			editingSessionGeneration++;
			filesState = cloneInitialFiles();
			urlValue = '';
			error = null;
		} else if (!isEditing && editingSessionActive) {
			editingSessionActive = false;
			editingSessionGeneration++;
			filesState = cloneInitialFiles();
			urlValue = '';
		}
	});

	onDestroy(() => {
		editingSessionGeneration++;
		if (errorResetTimer) clearTimeout(errorResetTimer);
	});

	const setFileInputRef = (el: HTMLInputElement | null) => {
		fileInputRef = el;
	};

	const setDropzoneRef = (el: HTMLButtonElement | null) => {
		dropzoneRef = el;
	};

	const setUrlInputRef = (el: HTMLInputElement | null) => {
		urlInputRef = el;
	};

	function attachRef<T extends HTMLElement>(set: (el: T | null) => void) {
		return (node: T) => {
			set(node);
			return () => {
				set(null);
			};
		};
	}

	function formatFileSize(bytes?: number): string {
		if (!bytes) return '';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
	}

	function getFileIcon(filename: string): Component {
		if (isUrl(filename)) return Link;
		const extension = filename.split('.').pop()?.toLowerCase() ?? '';
		if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'tiff'].includes(extension))
			return FileImage;
		if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(extension)) return FileVideo;
		if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(extension)) return FileMusic;
		if (['pdf', 'txt', 'md', 'rtf', 'doc', 'docx'].includes(extension)) return FileText;
		if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) return FileArchive;
		if (['xls', 'xlsx', 'csv', 'ods'].includes(extension)) return FileSpreadsheet;
		if (['ppt', 'pptx', 'odp'].includes(extension)) return Presentation;
		return FileIcon;
	}

	function isUrl(value: string): boolean {
		try {
			const url = new URL(value);
			return url.protocol === 'http:' || url.protocol === 'https:';
		} catch {
			return false;
		}
	}

	function isExternalUrlMedia(file: FileCellItem): boolean {
		return isExternalMedia(file) && !file.localFile;
	}

	function requiresServerDelete(file: FileCellItem): boolean {
		return isDeletableUploadedMedia(file);
	}

	function showTemporaryError(message: string, description?: string) {
		error = message;
		toast.error(message, description ? { description } : undefined);

		if (errorResetTimer) clearTimeout(errorResetTimer);
		errorResetTimer = setTimeout(() => {
			error = null;
		}, 2000);
	}

	async function deleteFileFromApi(file: FileCellItem): Promise<'deleted' | 'retained'> {
		if (!requiresServerDelete(file)) return 'retained';

		const encodedFilename = encodeURIComponent(file.filename);
		const res = await fetch(`/api/media/${file.collection}/${encodedFilename}`, {
			method: 'DELETE'
		});
		if (res.status === 409) return 'retained';
		if (!res.ok) {
			throw new Error(`Failed to delete ${file.filename}`);
		}
		return 'deleted';
	}

	function validateFile(file: File): string | null {
		if (maxFileSize && file.size > maxFileSize) {
			return `File size exceeds ${formatFileSize(maxFileSize)}`;
		}
		if (acceptedTypes) {
			const fileExtension = `.${file.name.split('.').pop()}`;
			const isAccepted = acceptedTypes.some((type) => {
				if (type.endsWith('/*')) {
					const baseType = type.slice(0, -2);
					return file.type.startsWith(`${baseType}/`);
				}
				if (type.startsWith('.')) {
					return fileExtension.toLowerCase() === type.toLowerCase();
				}
				return file.type === type;
			});
			if (!isAccepted) {
				return 'File type not accepted';
			}
		}
		return null;
	}

	function validateUrl(value: string): string | null {
		if (!value.trim()) return 'Enter a URL';
		if (!isUrl(value.trim())) return 'Enter a valid http or https URL';
		if (viewFiles?.some((file) => file.filename === value.trim())) return 'URL already added';
		return null;
	}

	function validateInlineUrl(value: string, fileId: string): string | null {
		if (!value.trim()) return 'Enter a URL';
		if (!isUrl(value.trim())) return 'Enter a valid http or https URL';
		if (viewFiles?.some((file) => file.id !== fileId && file.filename === value.trim())) {
			return 'URL already added';
		}
		return null;
	}

	function updateExternalUrl(fileId: string, nextUrl: string, input?: HTMLInputElement) {
		if (readOnly) return;

		const currentFile = filesState?.find((file) => file.id === fileId);
		if (!currentFile || !isExternalUrlMedia(currentFile)) return;

		const trimmedUrl = nextUrl.trim();
		const validationError = validateInlineUrl(trimmedUrl, fileId);
		if (validationError) {
			if (input) input.value = currentFile.filename;
			showTemporaryError(validationError);
			return;
		}

		if (trimmedUrl === currentFile.filename) return;

		syncFiles(
			filesState?.map((file) => (file.id === fileId ? { ...file, filename: trimmedUrl } : file)) ??
				null
		);
	}

	function handleInlineUrlKeyDown(event: KeyboardEvent, fileId: string) {
		const input = event.currentTarget as HTMLInputElement;

		if (event.key === 'Enter') {
			event.preventDefault();
			event.stopPropagation();
			input.blur();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			input.value = filesState?.find((file) => file.id === fileId)?.filename ?? '';
			cancelEditingSession();
		}
	}

	function handleInlineUrlBlur(event: FocusEvent, fileId: string) {
		const input = event.currentTarget as HTMLInputElement;
		updateExternalUrl(fileId, input.value, input);
	}

	function isImagePreview(file: FileCellItem): boolean {
		if (file.localFile) return file.localFile.type.startsWith('image/');
		if (/\.(avif|bmp|gif|jpe?g|png|svg|tiff?|webp)(?:$|[?#])/i.test(file.filename)) {
			return true;
		}
		return acceptsImages && isExternalUrlMedia(file);
	}

	function syncFiles(updatedFiles: FileCellItem[] | null) {
		filesState = updatedFiles;
		table.options.meta?.onDataUpdate?.({
			rowIndex,
			rowId: cell.row.id,
			columnId,
			value: normalizeFiles(updatedFiles)
		});
	}

	function cancelEditingSession() {
		editingSessionGeneration++;
		filesState = cloneInitialFiles();
		urlValue = '';
		error = null;
		table.options.meta?.onCellEditingCancel?.();
	}

	async function cleanupStaleUploads(uploadedFiles: FileCellItem[], rowData: TData | undefined) {
		if (!uploadedFiles.length || !table.options.meta?.onFilesDelete || !rowData) return;
		try {
			await table.options.meta.onFilesDelete({
				fileIds: uploadedFiles.map((file) => file.id),
				rowIndex,
				rowId: cell.row.id,
				columnId,
				row: rowData
			});
		} catch {
			// The cancelled edit must stay cancelled even if best-effort cleanup fails.
		}
	}

	function addUrl() {
		if (readOnly) return;
		error = null;

		const trimmedUrl = urlValue.trim();
		const validationError = validateUrl(trimmedUrl);
		if (validationError) {
			showTemporaryError(validationError);
			return;
		}

		const currentFiles = filesState ?? [];
		if (maxFiles && currentFiles.length + 1 > maxFiles) {
			showTemporaryError(`Maximum ${maxFiles} files allowed`);
			return;
		}

		const updatedFiles = [
			...currentFiles,
			{
				id: crypto.randomUUID(),
				collection: MediaCollection.externals,
				filename: trimmedUrl
			}
		];
		syncFiles(updatedFiles);
		urlValue = '';
		urlInputRef?.focus();
	}

	async function addFiles(newFiles: File[]) {
		if (readOnly || !canUploadFiles || newFiles.length === 0) return;
		const sessionGeneration = editingSessionGeneration;
		error = null;

		const incomingFiles = multiple ? newFiles : newFiles.slice(0, 1);
		if (!filesState?.length) filesState = [];
		if (maxFiles && filesState.length + incomingFiles.length > maxFiles) {
			showTemporaryError(`Maximum ${maxFiles} files allowed`);
			return;
		}

		const rejectedFiles: Array<{ name: string; reason: string }> = [];
		const acceptedFiles: File[] = [];

		for (const file of incomingFiles) {
			const validationError = validateFile(file);
			if (validationError) {
				rejectedFiles.push({ name: file.name, reason: validationError });
			} else {
				acceptedFiles.push(file);
			}
		}

		const firstRejectedFile = rejectedFiles[0];
		if (firstRejectedFile) {
			const truncatedName =
				firstRejectedFile.name.length > 20
					? `${firstRejectedFile.name.slice(0, 20)}...`
					: firstRejectedFile.name;
			const description =
				rejectedFiles.length === 1
					? `"${truncatedName}" has been rejected`
					: `"${truncatedName}" and ${rejectedFiles.length - 1} more rejected`;

			showTemporaryError(firstRejectedFile.reason, description);
		}

		if (acceptedFiles.length === 0) return;

		const tempFiles: FileCellItem[] = acceptedFiles.map((file) => ({
			id: crypto.randomUUID(),
			collection: MediaCollection.externals,
			filename: file.name,
			localFile: file,
			isUploading: true
		}));
		const filesWithTemp = [...filesState, ...tempFiles];
		const uploadingIds = new Set(tempFiles.map((file) => file.id));
		filesState = filesWithTemp;
		isUploading = true;

		let uploadedFiles: FileCellItem[];
		const rowData = cell.row.original;

		try {
			if (table.options.meta?.onFilesUpload && rowData) {
				uploadedFiles = await table.options.meta.onFilesUpload({
					files: acceptedFiles,
					rowIndex,
					rowId: cell.row.id,
					columnId,
					row: rowData
				});
			} else return;
		} catch (err) {
			if (sessionGeneration !== editingSessionGeneration) return;
			filesState = filesState.filter((file) => !uploadingIds.has(file.id));
			toast.error(
				err instanceof Error
					? err.message
					: `Failed to upload ${acceptedFiles.length} file${acceptedFiles.length === 1 ? '' : 's'}`
			);
			return;
		} finally {
			if (sessionGeneration === editingSessionGeneration) isUploading = false;
		}
		if (sessionGeneration !== editingSessionGeneration) {
			await cleanupStaleUploads(uploadedFiles, rowData);
			return;
		}

		const uploadedByTempId = new SvelteMap<string, FileCellItem>();
		tempFiles.forEach((tempFile, index) => {
			const uploadedFile = uploadedFiles[index];
			if (uploadedFile) uploadedByTempId.set(tempFile.id, uploadedFile);
		});

		syncFiles(
			filesWithTemp.flatMap((file) => {
				if (!uploadingIds.has(file.id)) return [file];
				const uploadedFile = uploadedByTempId.get(file.id);
				return uploadedFile ? [{ ...uploadedFile, isUploading: false }] : [];
			})
		);
	}

	async function removeFile(fileId: string) {
		if (readOnly) return;
		error = null;

		const fileToRemove = filesState?.find((f) => f.id === fileId);
		if (!fileToRemove) return;
		const updatedFiles = filesState?.filter((f) => f.id !== fileId) ?? [];
		await persistFileRemoval(updatedFiles, [fileToRemove]);
	}

	async function persistFileRemoval(updatedFiles: FileCellItem[], removedFiles: FileCellItem[]) {
		const sessionGeneration = editingSessionGeneration;
		const previousFiles = filesState ? [...filesState] : null;
		const nextFiles = updatedFiles.length ? updatedFiles : null;
		const value = normalizeFiles(nextFiles);
		const mutation = table.options.meta?.onDataUpdateAwaited;
		if (!mutation) return;

		const persistence = mutation({
			rowIndex,
			rowId: cell.row.id,
			columnId,
			value
		});
		const attemptGeneration = table.options.meta?.getCellMutationSnapshot?.(
			cell.row.id,
			columnId
		)?.generation;
		filesState = nextFiles;

		const restorePreviousFiles = (generation: number | undefined) => {
			if (
				generation !== undefined &&
				sessionGeneration === editingSessionGeneration &&
				isAcknowledgedCellValueCurrent(
					generation,
					table.options.meta?.getCellMutationSnapshot?.(cell.row.id, columnId),
					normalizeFiles(previousFiles)
				)
			) {
				filesState = previousFiles;
			}
		};
		let mutationResult: DataGridMutationResult | undefined;
		try {
			[mutationResult] = await persistence;
		} catch {
			restorePreviousFiles(attemptGeneration);
			return;
		}
		if (!mutationResult?.success || mutationResult.superseded) {
			restorePreviousFiles(mutationResult?.generation ?? attemptGeneration);
			return;
		}
		const rowData = cell.row.original;
		const filesToDelete = removedFiles.filter(requiresServerDelete);
		if (!filesToDelete.length) return;

		try {
			if (table.options.meta?.onFilesDelete && rowData) {
				await table.options.meta.onFilesDelete({
					fileIds: filesToDelete.map((file) => file.id),
					rowIndex,
					rowId: cell.row.id,
					columnId,
					row: rowData
				});
			} else {
				const deletions = await Promise.allSettled(filesToDelete.map(deleteFileFromApi));
				const failed = deletions.find((result) => result.status === 'rejected');
				if (failed) throw failed.reason;
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to delete files');
		}
	}

	async function clearAll() {
		if (readOnly) return;
		error = null;
		await persistFileRemoval([], filesState ? [...filesState] : []);
	}

	function handleCellDragEnter(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (canUploadFiles && event.dataTransfer?.types.includes('Files')) {
			isDraggingOver = true;
		}
	}

	function handleCellDragLeave(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const x = event.clientX;
		const y = event.clientY;

		if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
			isDraggingOver = false;
		}
	}

	function handleCellDragOver(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
	}

	function handleCellDrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		isDraggingOver = false;

		const droppedFiles = Array.from(event.dataTransfer?.files ?? []);
		if (droppedFiles.length > 0) {
			addFiles(droppedFiles);
		}
	}

	function handleDropzoneDragEnter(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		isDragging = true;
	}

	function handleDropzoneDragLeave(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const x = event.clientX;
		const y = event.clientY;

		if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
			isDragging = false;
		}
	}

	function handleDropzoneDragOver(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
	}

	function handleDropzoneDrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		isDragging = false;

		const droppedFiles = Array.from(event.dataTransfer?.files ?? []);
		addFiles(droppedFiles);
	}

	function handleDropzoneClick() {
		fileInputRef?.click();
	}

	function handleDropzoneKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleDropzoneClick();
		}
	}

	function handleFileInputChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const selectedFiles = Array.from(target.files ?? []);
		addFiles(selectedFiles);
		target.value = '';
	}

	function handleUrlKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			addUrl();
		}
	}

	function handleOpenChange(isOpen: boolean) {
		if (isOpen) return;

		editingSessionGeneration++;
		error = null;
		urlValue = '';
		table.options.meta?.onCellEditingStop?.();
	}

	function handleEscapeKeyDown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		event.stopPropagation();
		cancelEditingSession();
	}

	function handleOpenAutoFocus(event: Event) {
		event.preventDefault();
		queueMicrotask(() => {
			(dropzoneRef ?? urlInputRef)?.focus();
		});
	}

	function handleWrapperKeyDown(event: KeyboardEvent) {
		if (isEditing) {
			if (event.key === 'Escape') {
				event.preventDefault();
				cancelEditingSession();
			} else if (event.key === ' ' && event.target === dropzoneRef) {
				event.preventDefault();
				handleDropzoneClick();
			}
		} else if (isFocused && event.key === 'Enter') {
			event.preventDefault();
			table.options.meta?.onCellEditingStart?.(rowIndex, columnId);
		} else if (!isEditing && isFocused && event.key === 'Tab') {
			if (
				!table.options.meta?.canNavigateToCell?.(
					rowIndex,
					columnId,
					event.shiftKey ? 'left' : 'right'
				)
			)
				return;
			event.preventDefault();
			table.options.meta?.onCellEditingStop?.({
				direction: event.shiftKey ? 'left' : 'right'
			});
		}
	}

	const rowHeight = $derived(table.options.meta?.rowHeight ?? 'short');
	const lineCount = $derived(getLineCount(rowHeight));

	const badgeOverflow = useBadgeOverflow(() => ({
		items: viewFiles ?? [],
		getLabel: (file) => file.filename,
		containerRef: containerRef,
		lineCount: lineCount,
		cacheKeyPrefix: 'file-or-url',
		iconSize: 12,
		maxWidth: 94
	}));

	const visibleFiles = $derived(badgeOverflow.value.visibleItems);
	const hiddenFileCount = $derived(badgeOverflow.value.hiddenCount);
</script>

<DataGridCellWrapper
	bind:wrapperRef={containerRef}
	{cell}
	{table}
	{rowIndex}
	{columnId}
	{isEditing}
	{isFocused}
	{isSelected}
	class={cn({
		'ring-1 ring-primary/80 ring-inset': isDraggingOver
	})}
	ondragenter={canUploadFiles ? handleCellDragEnter : undefined}
	ondragleave={canUploadFiles ? handleCellDragLeave : undefined}
	ondragover={canUploadFiles ? handleCellDragOver : undefined}
	ondrop={canUploadFiles ? handleCellDrop : undefined}
	onkeydown={handleWrapperKeyDown}
>
	{#if isEditing}
		<PopoverPrimitive.Root open={isEditing} onOpenChange={handleOpenChange}>
			<PopoverContent
				data-grid-cell-editor=""
				align="start"
				{sideOffset}
				class="w-100 rounded-none p-0"
				onkeydown={handleEscapeKeyDown}
				onOpenAutoFocus={handleOpenAutoFocus}
				customAnchor={containerRef}
			>
				<div class="flex flex-col gap-2 p-3">
					<span class="sr-only">File or URL upload</span>
					{#if filesState?.length}
						<section class="flex flex-col gap-2" aria-label="Current media">
							<div class="flex items-center justify-between">
								<div>
									<p class="text-sm font-medium">Current files</p>
									<p class="text-xs text-muted-foreground">
										{filesState.length}
										{filesState.length === 1 ? 'media item' : 'media items'}
									</p>
								</div>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									class="h-7 text-xs text-muted-foreground"
									disabled={isUploading}
									onclick={clearAll}
								>
									Clear all
								</Button>
							</div>

							<div class="max-h-60 space-y-2 overflow-y-auto pr-1">
								{#each filesState as file (file.id)}
									{@const FileIcon = getFileIcon(file.filename)}
									<div class="flex items-start gap-2 rounded-md border bg-muted/40 p-2">
										<div
											class="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background"
										>
											{#if file.isUploading}
												<LoaderCircleIcon class="size-4 animate-spin text-muted-foreground" />
											{:else if isImagePreview(file)}
												<AvatarMedia src={file} class="size-full rounded-none" />
											{:else}
												<FileIcon class="size-4 text-muted-foreground" />
											{/if}
										</div>

										<div class="min-w-0 flex-1 space-y-1">
											{#if isExternalUrlMedia(file)}
												<Input
													type="url"
													value={file.filename}
													aria-label="External media URL"
													class="h-8 text-xs"
													onkeydown={(event) => handleInlineUrlKeyDown(event, file.id)}
													onblur={(event) => handleInlineUrlBlur(event, file.id)}
												/>
											{:else}
												<p class="truncate text-sm font-medium">{file.filename}</p>
											{/if}

											<p class="truncate text-xs text-muted-foreground">
												{#if file.isUploading}
													Uploading…
												{:else if file.localFile?.size}
													{formatFileSize(file.localFile.size)}
												{:else}
													Collection = {file.collection}
												{/if}
											</p>
										</div>

										<Button
											type="button"
											variant="ghost"
											size="icon"
											class="size-7 rounded-sm"
											disabled={file.isUploading}
											aria-label={`Remove ${file.filename}`}
											onclick={() => removeFile(file.id)}
										>
											<X class="size-3.5" />
										</Button>
									</div>
								{/each}
							</div>
						</section>
						<Separator />
					{/if}
					{#if canUploadFiles}
						<button
							type="button"
							aria-label="Drop files here or click to browse"
							data-dragging={isDragging ? '' : undefined}
							data-invalid={error ? '' : undefined}
							disabled={isUploading}
							class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 transition-colors outline-none hover:bg-accent/30 focus-visible:border-ring/50 data-dragging:border-primary/30 data-dragging:bg-accent/30 data-invalid:border-destructive data-invalid:ring-destructive/20"
							{@attach attachRef(setDropzoneRef)}
							onclick={handleDropzoneClick}
							ondragenter={handleDropzoneDragEnter}
							ondragleave={handleDropzoneDragLeave}
							ondragover={handleDropzoneDragOver}
							ondrop={handleDropzoneDrop}
							onkeydown={handleDropzoneKeyDown}
						>
							<Upload class="size-8 text-muted-foreground" />
							<div class="text-center text-sm">
								<p class="font-medium">
									{isDragging ? 'Drop files here' : 'Drag files here'}
								</p>
								<p class="text-xs text-muted-foreground">or click to browse</p>
							</div>
							<p class="text-xs text-muted-foreground">
								{maxFileSize
									? `Max size: ${formatFileSize(maxFileSize)}${maxFiles ? ` • Max ${maxFiles} file(s)` : ''}`
									: maxFiles
										? `Max ${maxFiles} file(s)`
										: 'Select files to upload'}
							</p>
						</button>
						<input
							type="file"
							{multiple}
							{accept}
							class="sr-only"
							{@attach attachRef(setFileInputRef)}
							onchange={handleFileInputChange}
						/>
					{/if}
					<div class="flex gap-2">
						<Input
							type="url"
							placeholder="https://"
							aria-label="Media URL"
							bind:value={urlValue}
							{@attach attachRef(setUrlInputRef)}
							onkeydown={handleUrlKeyDown}
						/>
						<Button type="button" variant="secondary" disabled={isUploading} onclick={addUrl}
							>Add URL</Button
						>
					</div>
				</div>
			</PopoverContent>
		</PopoverPrimitive.Root>
	{/if}
	{#if isDraggingOver}
		<div class="flex items-center justify-center gap-2 text-sm text-primary">
			<Upload class="size-4" />
			<span>Drop files here</span>
		</div>
	{:else}
		{#if isUploading}
			<LoaderCircleIcon class="size-4 animate-spin" />
		{/if}
		{#if viewFiles?.length}
			<div class="flex flex-wrap items-center gap-1 overflow-hidden">
				{#each visibleFiles as file (file.id)}
					{@const FileIcon = getFileIcon(file.filename)}
					{#if acceptsImages}
						<Badge variant="secondary" class="h-5 shrink-0 gap-1 px-1.5 text-xs">
							<AvatarMedia src={file} class="size-3 rounded-sm" />
							<span class="max-w-24 truncate">{file.filename}</span>
						</Badge>
					{:else}
						<Badge variant="secondary" class="h-5 shrink-0 gap-1 px-1.5 text-xs">
							<FileIcon class="size-3 shrink-0" />
							<span class="max-w-24 truncate">{file.filename}</span>
						</Badge>
					{/if}
				{/each}
				{#if hiddenFileCount > 0}
					<Badge variant="outline" class="h-5 shrink-0 px-1.5 text-xs text-muted-foreground">
						+{hiddenFileCount}
					</Badge>
				{/if}
			</div>
		{/if}
	{/if}
</DataGridCellWrapper>
