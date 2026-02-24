<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import {
		BYTE,
		displaySize,
		FileDropZone,
		MEGABYTE,
		type FileDropZoneProps
	} from '$lib/components/ui/file-drop-zone';
	import * as Form from '$lib/components/ui/form/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { cn } from '$lib/utils.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import FileUpIcon from '@lucide/svelte/icons/file-up';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import XIcon from '@lucide/svelte/icons/x';
	import { Popover as PopoverPrimitive } from 'bits-ui';
	import { toast } from 'svelte-sonner';
	import { zod4, zod4Client } from 'sveltekit-superforms/adapters';
	import { defaults, filesProxy, setError, superForm } from 'sveltekit-superforms/client';
	import YAML from 'yaml';
	import z from 'zod/v4';

	type Props = {
		endpoint: string;
		maxFileSize?: number;
		maxFiles?: number;
		class?: string;
	} & PopoverPrimitive.ContentProps;
	let {
		endpoint,
		maxFileSize = 5 * MEGABYTE,
		maxFiles = 10,
		align = 'end',
		class: className
	}: Props = $props();

	const schemaOfAttachments = z.object({
		attachments: z
			.file()
			.refine((file) => /\.(ya?ml)$/i.test(file.name), 'Only .yml or .yaml files are allowed')
			.min(1 * BYTE)
			.max(5 * MEGABYTE)
			.array()
			.min(1)
	});

	const initial = defaults(zod4(schemaOfAttachments));

	let isUploadPanelOpen = $state(false);
	let attachmentIssues: number[] = $state([]);

	const form = superForm(initial, {
		SPA: true,
		validators: zod4Client(schemaOfAttachments),
		resetForm: false,
		dataType: 'form',
		onUpdate: async ({ form: validated }) => {
			if (!validated.valid) return;
			attachmentIssues = [];
			const attachments = validated.data.attachments;

			for (let i = 0; i < attachments.length; i++) {
				const attachment = attachments[i];

				try {
					const yaml = YAML.parse(await attachment.text());
					const res = await fetch(endpoint, {
						method: 'POST',
						body: JSON.stringify(yaml)
					});

					if (!res.ok) {
						attachmentIssues.push(i);
						setError(validated, `attachments[${i}]`, 'Upload failed');
					}
				} catch {
					attachmentIssues.push(i);
					setError(validated, `attachments[${i}]`, 'Attachment failed to parse');
				}
			}
			if (!attachmentIssues?.length) {
				isUploadPanelOpen = false;
				toast.success('The attachments were uploaded successfully');
			} else {
				toast.error(`${attachmentIssues?.length} attachment(s) were not uploaded`);
			}
		}
	});
	const { form: sf, enhance, delayed } = form;

	const onUpload: FileDropZoneProps['onUpload'] = async (uploadedFiles) => {
		files.set([...Array.from($files), ...uploadedFiles]);
	};
	const onFileRejected: FileDropZoneProps['onFileRejected'] = async ({ reason, file }) => {
		toast.error(`${file.name} failed to upload!`, { description: reason });
	};
	let files = filesProxy(sf, 'attachments');
</script>

<Popover.Root bind:open={isUploadPanelOpen}>
	<Popover.Trigger
		class={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 font-normal')}
	>
		<FileUpIcon class="text-muted-foreground" />
		Upload
	</Popover.Trigger>
	<Popover.Content class="w-80" {align}>
		<div class="grid gap-4">
			<div class="space-y-2">
				<h4 class="leading-none font-medium">Upload</h4>
				<p class="text-sm text-muted-foreground">Upload .YAMLs.</p>
			</div>
			<div class="grid gap-2">
				<form use:enhance enctype="multipart/form-data" class="flex w-full flex-col gap-2">
					<Form.Fieldset {form} name="attachments">
						<Form.Control>
							{#snippet children({ props })}
								<div class="space-y-2">
									<FileDropZone
										{onUpload}
										{onFileRejected}
										{maxFileSize}
										accept=".yml,.yaml,application/yaml,application/x-yaml"
										{maxFiles}
										fileCount={$files.length ?? 0}
									/>
									<input name={props.name} type="file" bind:files={$files} class="hidden" />
									{#if $files.length}
										<ScrollArea class="h-32 rounded-md border p-2">
											<div class="flex flex-col gap-1">
												{#each Array.from($files) as file, i (file.name)}
													<Form.ElementField
														{form}
														name="attachments[{i}]"
														class="flex items-center gap-2"
													>
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
															<Form.FieldErrors class="text-xs text-destructive/60" />
														</div>
														<Button
															variant="ghost"
															size="icon-sm"
															onclick={() => {
																// we use set instead of an assignment since it accepts a File[]
																files.set([
																	...Array.from($files).slice(0, i),
																	...Array.from($files).slice(i + 1)
																]);
															}}
														>
															<XIcon />
														</Button>
													</Form.ElementField>
												{/each}
											</div>
										</ScrollArea>
									{/if}
								</div>
							{/snippet}
						</Form.Control>
					</Form.Fieldset>
					<Button type="submit" class="w-full" disabled={$delayed}>
						{#if $delayed}<LoaderCircleIcon class="size-5 animate-spin" />
						{:else}<CheckIcon class="size-5" />{/if}
						<span>Upload</span>
					</Button>
				</form>
			</div>
		</div>
	</Popover.Content>
</Popover.Root>
