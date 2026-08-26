<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import {
		BYTE,
		displaySize,
		FileDropZone,
		MEGABYTE,
		type FileDropZoneProps
	} from '$lib/components/ui/file-drop-zone';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { useSubmissionState } from '$lib/hooks/use-submission-state.svelte.js';
	import { cn } from '$lib/utils.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import FileUpIcon from '@lucide/svelte/icons/file-up';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import XIcon from '@lucide/svelte/icons/x';
	import { Popover as PopoverPrimitive } from 'bits-ui';
	import { toast } from 'svelte-sonner';
	import YAML from 'yaml';
	import z from 'zod/v4';

	type Props = {
		endpoint: string;
		description?: string;
		maxFileSize?: number;
		maxFiles?: number;
		class?: string;
	} & PopoverPrimitive.ContentProps;
	let {
		endpoint,
		description = 'Upload .YAMLs.',
		maxFileSize = 5 * MEGABYTE,
		maxFiles = 10,
		align = 'end',
		class: className
	}: Props = $props();

	const schemaOfAttachments = () =>
		z.object({
			attachments: z
				.file()
				.refine((file) => /\.(ya?ml)$/i.test(file.name), 'Only .yml or .yaml files are allowed')
				.min(1 * BYTE, 'Empty files are not allowed')
				.max(maxFileSize, `Maximum file size is ${displaySize(maxFileSize)}`)
				.array()
				.min(1, 'Upload at least one attachment')
				.max(maxFiles, `Upload up to ${maxFiles} attachments`)
		});

	let isUploadPanelOpen = $state(false);
	let attachmentIssues: number[] = $state([]);
	let attachmentErrors: Record<number, string[]> = $state({});
	let attachmentFieldErrors: string[] = $state([]);
	let attachments: File[] = $state([]);
	const submission = useSubmissionState();

	const formatSummary = (value: unknown) => {
		if (!value || typeof value !== 'object') return undefined;
		const summary = value as {
			created?: Record<string, string[]>;
			updated?: Record<string, string[]>;
		};
		const lines = [
			...Object.entries(summary.created ?? {}).map(
				([key, items]) =>
					`${key}: ${items.length} created${items.length ? ` (${items.join(', ')})` : ''}`
			),
			...Object.entries(summary.updated ?? {}).map(
				([key, items]) =>
					`${key}: ${items.length} updated${items.length ? ` (${items.join(', ')})` : ''}`
			)
		];
		return lines.length ? lines.join('\n') : undefined;
	};

	const submit = async (event: SubmitEvent) => {
		event.preventDefault();
		if (submission.submitting) return;

		attachmentIssues = [];
		attachmentErrors = {};
		const validated = schemaOfAttachments().safeParse({ attachments });
		if (!validated.success) {
			const attachmentTree = z.treeifyError(validated.error).properties?.attachments;
			attachmentFieldErrors = attachmentTree?.errors ?? [];
			attachmentErrors = Object.fromEntries(
				(attachmentTree?.items ?? []).flatMap((item, index) =>
					item?.errors.length ? [[index, item.errors]] : []
				)
			);
			return;
		}

		attachmentFieldErrors = [];
		const submissionId = submission.start();
		try {
			const summaries: string[] = [];
			for (let i = 0; i < validated.data.attachments.length; i++) {
				const attachment = validated.data.attachments[i];

				try {
					const yaml = YAML.parse(await attachment.text());
					const res = await fetch(endpoint, {
						method: 'POST',
						body: JSON.stringify(yaml)
					});

					if (!res.ok) {
						attachmentIssues.push(i);
						attachmentErrors[i] = ['Upload failed'];
					}
					const summary = formatSummary(await res.json().catch(() => undefined));
					if (summary) summaries.push(summary);
				} catch {
					attachmentIssues.push(i);
					attachmentErrors[i] = ['Attachment failed to parse'];
				}
			}
			if (!attachmentIssues?.length) {
				isUploadPanelOpen = false;
				toast.success('The attachments were uploaded successfully', {
					description: summaries.join('\n\n') || undefined,
					closeButton: !!summaries.length,
					duration: summaries.length ? Infinity : undefined
				});
			} else {
				toast.error(`${attachmentIssues?.length} attachment(s) were not uploaded`);
			}
		} finally {
			submission.finish(submissionId);
		}
	};

	const onUpload: FileDropZoneProps['onUpload'] = async (uploadedFiles) => {
		attachments = [...attachments, ...uploadedFiles];
	};
	const onFileRejected: FileDropZoneProps['onFileRejected'] = async ({ reason, file }) => {
		toast.error(`${file.name} failed to upload!`, { description: reason });
	};
</script>

<Popover.Root bind:open={isUploadPanelOpen}>
	<Popover.Trigger
		class={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 font-normal', className)}
	>
		<FileUpIcon class="text-muted-foreground" />
		Upload
	</Popover.Trigger>
	<Popover.Content class="w-80" {align}>
		<div class="grid gap-4">
			<div class="space-y-2">
				<h4 class="leading-none font-medium">Upload</h4>
				<p class="text-sm text-muted-foreground">{description}</p>
			</div>
			<div class="grid gap-2">
				<form
					onsubmit={submit}
					novalidate
					class="flex w-full flex-col gap-2"
					aria-busy={submission.submitting}
				>
					<div class="space-y-2">
						<FileDropZone
							name="attachments"
							{onUpload}
							{onFileRejected}
							{maxFileSize}
							accept=".yml,.yaml,application/yaml,application/x-yaml"
							{maxFiles}
							fileCount={attachments.length}
							disabled={submission.submitting}
						/>
						{#if attachmentFieldErrors.length}<div class="text-xs text-destructive/60" role="alert">
								{#each attachmentFieldErrors as error, i (`${error}-${i}`)}<div>{error}</div>{/each}
							</div>{/if}
						{#if attachments.length}
							<ScrollArea class="h-32 rounded-md border p-2">
								<div class="flex flex-col gap-1">
									{#each attachments as file, i (`${file.name}-${file.lastModified}`)}
										<div class="flex items-center gap-2">
											<div class="grow">
												<p
													class="line-clamp-1 text-sm"
													class:text-destructive={attachmentIssues.includes(i)}
												>
													{file.name}
												</p>
												<p class="line-clamp-1 text-xs text-muted-foreground">
													{displaySize(file.size)}
												</p>
												{#if attachmentErrors[i]?.length}<div
														class="text-xs text-destructive/60"
														role="alert"
													>
														{#each attachmentErrors[i] as error, errorIndex (`${error}-${errorIndex}`)}<div
															>
																{error}
															</div>{/each}
													</div>{/if}
											</div>
											<Button
												type="button"
												variant="ghost"
												size="icon-sm"
												onclick={() => {
													attachments = [...attachments.slice(0, i), ...attachments.slice(i + 1)];
												}}
											>
												<XIcon />
											</Button>
										</div>
									{/each}
								</div>
							</ScrollArea>
						{/if}
					</div>
					<Button type="submit" class="w-full" disabled={submission.submitting}>
						{#if submission.delayed}<LoaderCircleIcon class="size-5 animate-spin" />
						{:else}<CheckIcon class="size-5" />{/if}
						<span>Upload</span>
					</Button>
					{#if submission.timeout}<p
							class="text-center text-xs text-muted-foreground"
							aria-live="polite"
						>
							Uploading is taking longer than expected.
						</p>{/if}
				</form>
			</div>
		</div>
	</Popover.Content>
</Popover.Root>
