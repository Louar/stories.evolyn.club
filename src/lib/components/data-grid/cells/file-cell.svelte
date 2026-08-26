<script lang="ts" generics="TData">
	import {
		hasFileUploadHandler,
		isAcknowledgedCellValueCurrent
	} from '$lib/components/data-grid/data-grid-actions.js';
	import {
		getFileCellItems,
		isDeletableUploadedMedia,
		normalizeFiles
	} from '$lib/components/data-grid/data-grid-media.js';
	import type {
		CellVariantProps,
		DataGridMutationResult,
		FileCellData
	} from '$lib/components/data-grid/types/data-grid.js';
	import { getLineCount } from '$lib/components/data-grid/types/data-grid.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { PopoverContent } from '$lib/components/ui/popover/index.js';
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

	// Use centralized cellValue prop - fine-grained reactivity is handled by DataGridCell
	const initialCellValue = $derived(getFileCellItems(cellValue));

	type FileCellItem = FileCellData & {
		localFile?: File;
		isUploading?: boolean;
	};

	let filesState = $state<FileCellItem[]>([]);
	let isDraggingOver = $state(false);
	let isDragging = $state(false);
	let isUploading = $state(false);
	let error = $state<string | null>(null);
	let containerRef = $state<HTMLDivElement | null>(null);
	let fileInputRef = $state<HTMLInputElement | null>(null);
	let dropzoneRef = $state<HTMLButtonElement | null>(null);
	let editingSessionActive = false;
	let editingSessionGeneration = 0;
	let errorResetTimer: ReturnType<typeof setTimeout> | undefined;
	const cellOpts = $derived(cell.column.columnDef.meta?.cell);
	const sideOffset = $derived(-(containerRef?.clientHeight ?? 0));

	const fileCellOpts = $derived(cellOpts?.variant === 'file' ? cellOpts : null);
	const maxFileSize = $derived(fileCellOpts?.maxFileSize ?? 10 * 1024 * 1024);
	const maxFiles = $derived(fileCellOpts?.maxFiles ?? 10);
	const accept = $derived(fileCellOpts?.accept);
	const multiple = $derived(fileCellOpts?.multiple ?? true);
	const canUploadFiles = $derived(hasFileUploadHandler(table.options.meta?.onFilesUpload));

	const acceptedTypes = $derived(accept ? accept.split(',').map((t) => t.trim()) : null);

	const viewFiles = $derived(isEditing ? filesState : (initialCellValue as FileCellItem[]));
	const cloneInitialFiles = () => (initialCellValue as FileCellItem[]).map((file) => ({ ...file }));

	$effect(() => {
		if (isEditing && !editingSessionActive) {
			editingSessionActive = true;
			editingSessionGeneration++;
			filesState = cloneInitialFiles();
			error = null;
		} else if (!isEditing && editingSessionActive) {
			editingSessionActive = false;
			editingSessionGeneration++;
			filesState = cloneInitialFiles();
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

	function cancelEditingSession() {
		editingSessionGeneration++;
		filesState = cloneInitialFiles();
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

	async function deleteFileFromApi(file: FileCellItem): Promise<'deleted' | 'retained'> {
		if (!isDeletableUploadedMedia(file)) return 'retained';
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

	async function addFiles(newFiles: File[]) {
		if (readOnly || !canUploadFiles) return;
		const sessionGeneration = editingSessionGeneration;
		error = null;

		if (maxFiles && viewFiles.length + newFiles.length > maxFiles) {
			const errorMessage = `Maximum ${maxFiles} files allowed`;
			error = errorMessage;
			toast.error(errorMessage);
			if (errorResetTimer) clearTimeout(errorResetTimer);
			errorResetTimer = setTimeout(() => {
				error = null;
			}, 2000);
			return;
		}

		const rejectedFiles: Array<{ name: string; reason: string }> = [];
		const filesToValidate: File[] = [];

		for (const file of newFiles) {
			const validationError = validateFile(file);
			if (validationError) {
				rejectedFiles.push({ name: file.name, reason: validationError });
				continue;
			}
			filesToValidate.push(file);
		}

		if (rejectedFiles.length > 0) {
			const firstError = rejectedFiles[0];
			if (firstError) {
				error = firstError.reason;

				const truncatedName =
					firstError.name.length > 20 ? `${firstError.name.slice(0, 20)}...` : firstError.name;

				if (rejectedFiles.length === 1) {
					toast.error(firstError.reason, {
						description: `"${truncatedName}" has been rejected`
					});
				} else {
					toast.error(firstError.reason, {
						description: `"${truncatedName}" and ${rejectedFiles.length - 1} more rejected`
					});
				}

				if (errorResetTimer) clearTimeout(errorResetTimer);
				errorResetTimer = setTimeout(() => {
					error = null;
				}, 2000);
			}
		}

		if (filesToValidate.length > 0) {
			filesState = isEditing ? filesState : [...initialCellValue];
			const tempFiles: FileCellItem[] = filesToValidate.map((f) => ({
				id: crypto.randomUUID(),
				collection: MediaCollection.externals,
				filename: f.name,
				localFile: f,
				isUploading: false
			}));
			const filesWithTemp = [...filesState, ...tempFiles];
			filesState = filesWithTemp;

			const uploadingIds = new Set<string>(tempFiles.map((f) => f.id));

			let uploadedFiles: FileCellItem[] = [];
			const rowData = cell.row.original;

			if (table.options.meta?.onFilesUpload && rowData) {
				try {
					isUploading = true;
					uploadedFiles = await table.options.meta.onFilesUpload({
						files: filesToValidate,
						rowIndex,
						rowId: cell.row.id,
						columnId,
						row: rowData
					});
				} catch (err) {
					if (sessionGeneration !== editingSessionGeneration) return;
					toast.error(
						err instanceof Error
							? err.message
							: `Failed to upload ${filesToValidate.length} file${filesToValidate.length !== 1 ? 's' : ''}`
					);
					filesState = filesState.filter((f) => !uploadingIds.has(f.id));
					return;
				} finally {
					if (sessionGeneration === editingSessionGeneration) isUploading = false;
				}
			} else return;
			if (sessionGeneration !== editingSessionGeneration) {
				await cleanupStaleUploads(uploadedFiles, rowData);
				return;
			}

			const uploadedByTempId = new SvelteMap<string, FileCellItem>();
			tempFiles.forEach((temp, index) => {
				const uploaded = uploadedFiles[index];
				if (uploaded) uploadedByTempId.set(temp.id, uploaded);
			});

			const finalFiles = filesWithTemp.flatMap((f) => {
				if (uploadingIds.has(f.id)) {
					const uploaded = uploadedByTempId.get(f.id);
					return uploaded ? [uploaded] : [];
				}
				return [f];
			});

			filesState = finalFiles;
			table.options.meta?.onDataUpdate?.({
				rowIndex,
				rowId: cell.row.id,
				columnId,
				value: normalizeFiles(finalFiles)
			});
		}
	}

	async function removeFile(fileId: string) {
		if (readOnly) return;
		error = null;

		const fileToRemove = filesState.find((f) => f.id === fileId);
		if (!fileToRemove) return;
		const updatedFiles = filesState.filter((f) => f.id !== fileId);
		await persistFileRemoval(updatedFiles, [fileToRemove]);
	}

	async function persistFileRemoval(updatedFiles: FileCellItem[], removedFiles: FileCellItem[]) {
		const sessionGeneration = editingSessionGeneration;
		const previousFiles = [...filesState];
		const value = normalizeFiles(updatedFiles);
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
		filesState = updatedFiles;

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
		const filesToDelete = removedFiles.filter(isDeletableUploadedMedia);
		if (!filesToDelete.length) return;

		if (table.options.meta?.onFilesDelete && rowData) {
			try {
				await table.options.meta.onFilesDelete({
					fileIds: filesToDelete.map((file) => file.id),
					rowIndex,
					rowId: cell.row.id,
					columnId,
					row: rowData
				});
			} catch (err) {
				toast.error(err instanceof Error ? err.message : 'Failed to delete files');
			}
		} else {
			const deletions = await Promise.allSettled(filesToDelete.map(deleteFileFromApi));
			const failed = deletions.find((result) => result.status === 'rejected');
			if (failed) {
				toast.error(
					failed.reason instanceof Error ? failed.reason.message : 'Failed to delete files'
				);
			}
		}
	}

	async function clearAll() {
		if (readOnly) return;
		error = null;
		await persistFileRemoval([], [...filesState]);
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

	function handleOpenChange(isOpen: boolean) {
		if (isOpen && !readOnly) {
			error = null;
			table.options.meta?.onCellEditingStart?.(rowIndex, columnId);
		} else {
			editingSessionGeneration++;
			error = null;
			table.options.meta?.onCellEditingStop?.();
		}
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
			dropzoneRef?.focus();
		});
	}

	function handleWrapperKeyDown(event: KeyboardEvent) {
		if (isEditing) {
			if (event.key === 'Escape') {
				event.preventDefault();
				cancelEditingSession();
			} else if (event.key === ' ') {
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

	// Use the badge overflow hook for accurate measurement
	// File badges have an icon (12px) and truncated name (max 100px)
	const badgeOverflow = useBadgeOverflow(() => ({
		items: viewFiles,
		getLabel: (file) => file.filename,
		containerRef: containerRef,
		lineCount: lineCount,
		cacheKeyPrefix: 'file',
		iconSize: 12, // size-3 = 12px
		maxWidth: 100 // max-w-[100px] on truncated text
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
					<span class="sr-only">File upload</span>
					{#if canUploadFiles}
						<button
							type="button"
							aria-label="Drop files here or click to browse"
							data-dragging={isDragging ? '' : undefined}
							data-invalid={error ? '' : undefined}
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
					{#if viewFiles.length > 0}
						<div class="flex flex-col gap-2">
							<div class="flex items-center justify-between">
								<p class="text-xs font-medium text-muted-foreground">
									{viewFiles.length}
									{viewFiles.length === 1 ? 'file' : 'files'}
								</p>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									class="h-6 text-xs text-muted-foreground"
									onclick={clearAll}
								>
									Clear all
								</Button>
							</div>
							<div class="max-h-50 space-y-1 overflow-y-auto">
								{#each viewFiles as file (file.id)}
									{@const FileIcon = getFileIcon(file.filename)}
									<div class="flex items-center gap-2 rounded-md border bg-muted/50 px-2 py-1.5">
										<FileIcon class="size-4 shrink-0 text-muted-foreground" />
										<div class="flex-1 overflow-hidden">
											<p class="truncate text-sm">{file.filename}</p>
											{#if file.localFile?.size}
												<p class="text-xs text-muted-foreground">
													{formatFileSize(file.localFile.size)}
												</p>
											{/if}
										</div>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											class="size-5 rounded-sm"
											onclick={() => removeFile(file.id)}
										>
											<X class="size-3" />
										</Button>
									</div>
								{/each}
							</div>
						</div>
					{/if}
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
		{#if viewFiles.length > 0}
			<div class="flex flex-wrap items-center gap-1 overflow-hidden">
				{#each visibleFiles as file (file.id)}
					{@const FileIcon = getFileIcon(file.filename)}
					<Badge variant="secondary" class="h-5 shrink-0 gap-1 px-1.5 text-xs">
						<FileIcon class="size-3 shrink-0" />
						<span class="max-w-25 truncate">{file.filename}</span>
					</Badge>
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
