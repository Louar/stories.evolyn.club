<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { useSubmissionState } from '$lib/hooks/use-submission-state.svelte.js';
	import { cn } from '$lib/utils.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import DatabaseZapIcon from '@lucide/svelte/icons/database-zap';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import { Popover as PopoverPrimitive } from 'bits-ui';
	import { toast } from 'svelte-sonner';
	import z from 'zod/v4';

	type Props = {
		endpoint: string;
		entityLabel?: string;
		maxCount?: number;
		onSuccess?: () => void | Promise<void>;
		class?: string;
	} & PopoverPrimitive.ContentProps;
	let {
		endpoint,
		entityLabel = 'records',
		maxCount = 1000,
		onSuccess,
		align = 'end',
		class: className
	}: Props = $props();

	const schemaOfGeneration = () =>
		z.object({
			count: z.coerce
				.number()
				.int()
				.min(1)
				.max(maxCount, `You can generate up to ${maxCount} ${entityLabel} at once`)
		});

	const csvEscape = (value: unknown) => {
		const text = String(value ?? '');
		if (/[,"\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
		return text;
	};

	const downloadCsv = (rows: { userId: string; authCode: string }[]) => {
		if (!rows.length) return;
		const header = ['userId', 'authCode'];
		const body = rows.map((row) => [csvEscape(row.userId), csvEscape(row.authCode)].join(','));
		const csv = [header.join(','), ...body].join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `generated-${entityLabel}-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}.csv`;
		anchor.click();
		URL.revokeObjectURL(url);
	};

	let isGeneratePanelOpen = $state(false);
	let count = $state(10);
	let errors: string[] = $state([]);
	const submission = useSubmissionState();

	const submit = async (event: SubmitEvent) => {
		event.preventDefault();
		if (submission.submitting) return;

		const validated = schemaOfGeneration().safeParse({ count });
		if (!validated.success) {
			errors = z.flattenError(validated.error).fieldErrors.count ?? [];
			return;
		}

		errors = [];
		const submissionId = submission.start();
		try {
			const res = await fetch(endpoint, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ count: validated.data.count })
			});

			if (!res.ok) {
				let reason = `Failed to generate ${entityLabel}`;
				const payload = await res.json().catch(() => undefined);
				if (payload?.message && typeof payload.message === 'string') reason = payload.message;
				if (payload?.error && typeof payload.error === 'string') reason = payload.error;
				toast.error(reason);
				return;
			}

			const payload = await res.json().catch(() => ({}) as Record<string, unknown>);
			const results = Array.isArray(payload?.results)
				? payload.results.filter((row: unknown): row is { userId: string; authCode: string } => {
						if (typeof row !== 'object' || row === null) return false;
						const candidate = row as { userId?: unknown; authCode?: unknown };
						return typeof candidate.userId === 'string' && typeof candidate.authCode === 'string';
					})
				: [];
			const createdUsersCount =
				typeof payload?.createdUsersCount === 'number'
					? payload.createdUsersCount
					: validated.data.count;
			downloadCsv(results);
			isGeneratePanelOpen = false;
			toast.success(`Generated ${createdUsersCount} ${entityLabel}`);
			await onSuccess?.();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : `Failed to generate ${entityLabel}`);
		} finally {
			submission.finish(submissionId);
		}
	};
</script>

<Popover.Root bind:open={isGeneratePanelOpen}>
	<Popover.Trigger
		class={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 font-normal', className)}
	>
		<DatabaseZapIcon class="text-muted-foreground" />
		Generate
	</Popover.Trigger>
	<Popover.Content class="w-80" {align}>
		<div class="grid gap-4">
			<div class="space-y-2">
				<h4 class="leading-none font-medium">Generate</h4>
				<p class="text-sm text-muted-foreground">Generate multiple {entityLabel} at once.</p>
			</div>
			<div class="grid gap-2">
				<form
					onsubmit={submit}
					novalidate
					class="flex w-full flex-col gap-2"
					aria-busy={submission.submitting}
				>
					<div class="space-y-2">
						<Label for="generation-count" class={errors.length ? 'text-destructive' : undefined}
							>Number of {entityLabel}</Label
						>
						<Input
							id="generation-count"
							name="count"
							type="number"
							min={1}
							max={maxCount}
							step={1}
							bind:value={count}
							aria-invalid={errors.length ? 'true' : undefined}
							aria-describedby={errors.length ? 'generation-count-errors' : undefined}
						/>
						<p class="text-xs text-muted-foreground">Allowed range: 1 to {maxCount}.</p>
						{#if errors.length}<div
								id="generation-count-errors"
								class="text-xs text-destructive/60"
								role="alert"
							>
								{#each errors as error, i (`${error}-${i}`)}<div>{error}</div>{/each}
							</div>{/if}
					</div>
					<Button type="submit" class="w-full" disabled={submission.submitting}>
						{#if submission.delayed}<LoaderCircleIcon class="size-5 animate-spin" />
						{:else}<CheckIcon class="size-5" />{/if}
						<span>Generate</span>
					</Button>
					{#if submission.timeout}<p
							class="text-center text-xs text-muted-foreground"
							aria-live="polite"
						>
							Generation is taking longer than expected.
						</p>{/if}
				</form>
			</div>
		</div>
	</Popover.Content>
</Popover.Root>
