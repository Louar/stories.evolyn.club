<script lang="ts" generics="TData">
	import type {
		CellVariantProps,
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
	import type { Component } from 'svelte';
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
	const initialCellValue = $derived.by(() => {
		if (!cellValue) return [];
		return Array.isArray(cellValue) ? cellValue : [cellValue];
	});

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
	const cellOpts = $derived(cell.column.columnDef.meta?.cell);
	const sideOffset = $derived(-(containerRef?.clientHeight ?? 0));

	const fileCellOpts = $derived(cellOpts?.variant === 'file' ? cellOpts : null);
	const maxFileSize = $derived(fileCellOpts?.maxFileSize ?? 10 * 1024 * 1024);
	const maxFiles = $derived(fileCellOpts?.maxFiles ?? 10);
	const accept = $derived(fileCellOpts?.accept);
	const multiple = $derived(fileCellOpts?.multiple ?? true);

	const acceptedTypes = $derived(accept ? accept.split(',').map((t) => t.trim()) : null);

	const viewFiles = $derived(isEditing ? filesState : (initialCellValue as FileCellItem[]));

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

	function normalizeFiles(items: FileCellItem[]): FileCellData[] {
		return items.map(({ id, collection, filename }) => ({ id, collection, filename }));
	}

	function getMissionTemplateId(rowData: unknown): string | null {
		if (!rowData || typeof rowData !== 'object') return null;
		const record = rowData as Record<string, unknown>;
		if (typeof record.missionTemplateId === 'string') return record.missionTemplateId;
		const missionTemplate = record.missionTemplate;
		if (missionTemplate && typeof missionTemplate === 'object') {
			const id = (missionTemplate as Record<string, unknown>).id;
			return typeof id === 'string' ? id : null;
		}
		return null;
	}

	async function deleteFileFromApi(file: FileCellItem, rowData: unknown) {
		if (file.isUploading) return;
		const encodedFilename = encodeURIComponent(file.filename);
		const missionTemplateId =
			file.collection === MediaCollection.missions ? getMissionTemplateId(rowData) : null;
		const query = missionTemplateId ? `?id=${encodeURIComponent(missionTemplateId)}` : '';
		const res = await fetch(`/api/media/${file.collection}/${encodedFilename}${query}`, {
			method: 'DELETE'
		});
		if (!res.ok) {
			throw new Error(`Failed to delete ${file.filename}`);
		}
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

	async function addFiles(newFiles: File[], skipUpload = false) {
		if (readOnly) return;
		error = null;

		if (maxFiles && viewFiles.length + newFiles.length > maxFiles) {
			const errorMessage = `Maximum ${maxFiles} files allowed`;
			error = errorMessage;
			toast.error(errorMessage);
			setTimeout(() => {
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

				setTimeout(() => {
					error = null;
				}, 2000);
			}
		}

		if (filesToValidate.length > 0) {
			if (!skipUpload) {
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
				const rowData = table.options.data[rowIndex];

				if (table.options.meta?.onFilesUpload && rowData) {
					try {
						isUploading = true;
						uploadedFiles = await table.options.meta.onFilesUpload({
							files: filesToValidate,
							rowIndex,
							columnId,
							row: rowData
						});
					} catch (err) {
						toast.error(
							err instanceof Error
								? err.message
								: `Failed to upload ${filesToValidate.length} file${filesToValidate.length !== 1 ? 's' : ''}`
						);
						filesState = filesState.filter((f) => !uploadingIds.has(f.id));
						return;
					} finally {
						isUploading = false;
					}
				} else {
					await new Promise((resolve) => setTimeout(resolve, 800));
					uploadedFiles = filesToValidate.map((f, i) => ({
						id: tempFiles[i]?.id ?? crypto.randomUUID(),
						collection: MediaCollection.externals,
						filename: f.name,
						localFile: f,
						isUploading: false
					}));
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
					columnId,
					value: normalizeFiles(finalFiles)
				});
			} else {
				const newFilesData: FileCellItem[] = filesToValidate.map((f) => ({
					id: crypto.randomUUID(),
					collection: MediaCollection.externals,
					filename: f.name,
					localFile: f,
					isUploading: false
				}));
				const updatedFiles = [...filesState, ...newFilesData];
				filesState = updatedFiles;
				table.options.meta?.onDataUpdate?.({
					rowIndex,
					columnId,
					value: normalizeFiles(updatedFiles)
				});
			}
		}
	}

	async function removeFile(fileId: string) {
		if (readOnly) return;
		error = null;

		const fileToRemove = filesState.find((f) => f.id === fileId);
		if (!fileToRemove) return;

		const rowData = table.options.data[rowIndex];
		if (table.options.meta?.onFilesDelete && rowData) {
			try {
				await table.options.meta.onFilesDelete({
					fileIds: [fileId],
					rowIndex,
					columnId,
					row: rowData
				});
			} catch (err) {
				toast.error(
					err instanceof Error ? err.message : `Failed to delete ${fileToRemove.filename}`
				);
				return;
			}
		} else {
			try {
				await deleteFileFromApi(fileToRemove, rowData);
			} catch (err) {
				toast.error(
					err instanceof Error ? err.message : `Failed to delete ${fileToRemove.filename}`
				);
				return;
			}
		}

		const updatedFiles = filesState.filter((f) => f.id !== fileId);
		filesState = updatedFiles;
		table.options.meta?.onDataUpdate?.({
			rowIndex,
			columnId,
			value: normalizeFiles(updatedFiles)
		});
	}

	async function clearAll() {
		if (readOnly) return;
		error = null;

		const rowData = table.options.data[rowIndex];
		if (filesState.length > 0) {
			if (table.options.meta?.onFilesDelete && rowData) {
				try {
					await table.options.meta.onFilesDelete({
						fileIds: filesState.map((f) => f.id),
						rowIndex,
						columnId,
						row: rowData
					});
				} catch (err) {
					toast.error(err instanceof Error ? err.message : 'Failed to delete files');
					return;
				}
			} else {
				try {
					await Promise.all(filesState.map((file) => deleteFileFromApi(file, rowData)));
				} catch (err) {
					toast.error(err instanceof Error ? err.message : 'Failed to delete files');
					return;
				}
			}
		}
		filesState = [];
		table.options.meta?.onDataUpdate?.({ rowIndex, columnId, value: [] });
	}

	function handleCellDragEnter(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (event.dataTransfer?.types.includes('Files')) {
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
			addFiles(droppedFiles, false);
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
		addFiles(droppedFiles, false);
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
		addFiles(selectedFiles, false);
		target.value = '';
	}

	function handleOpenChange(isOpen: boolean) {
		if (isOpen && !readOnly) {
			error = null;
			table.options.meta?.onCellEditingStart?.(rowIndex, columnId);
		} else {
			error = null;
			table.options.meta?.onCellEditingStop?.();
		}
	}

	function handleEscapeKeyDown(event: KeyboardEvent) {
		event.stopPropagation();
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
				filesState = [...initialCellValue];
				error = null;
				table.options.meta?.onCellEditingStop?.();
			} else if (event.key === ' ') {
				event.preventDefault();
				handleDropzoneClick();
			}
		} else if (isFocused && event.key === 'Enter') {
			event.preventDefault();
			table.options.meta?.onCellEditingStart?.(rowIndex, columnId);
		} else if (!isEditing && isFocused && event.key === 'Tab') {
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
	ondragenter={handleCellDragEnter}
	ondragleave={handleCellDragLeave}
	ondragover={handleCellDragOver}
	ondrop={handleCellDrop}
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
