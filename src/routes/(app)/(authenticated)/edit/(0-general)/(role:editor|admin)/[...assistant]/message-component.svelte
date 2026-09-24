<script lang="ts">
	import * as ChainOfThought from '$lib/components/ai/chain-of-thought';
	import * as Message from '$lib/components/ai/message';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import { type Chat } from '@ai-sdk/svelte';
	import { CheckCircle2, LoaderCircle, RotateCcw, Wrench, XCircle } from '@lucide/svelte';
	import Copy from '@lucide/svelte/icons/copy';
	import ThumbsDown from '@lucide/svelte/icons/thumbs-down';
	import ThumbsUp from '@lucide/svelte/icons/thumbs-up';
	import type { UIMessage } from 'ai';

	type MessagePart = UIMessage['parts'][number];
	type ToolPart = MessagePart & {
		type: `tool-${string}` | 'dynamic-tool';
		toolName?: string;
		toolCallId: string;
		state: string;
		input?: unknown;
		output?: unknown;
		errorText?: string;
	};

	let {
		message,
		isLastMessage = false,
		chat
	}: {
		message: UIMessage;
		isLastMessage?: boolean;
		chat: Chat;
	} = $props();

	const isAssistant = $derived(message.role === 'assistant');

	const messageText = $derived(
		message.parts.map((part) => (part.type === 'text' ? part.text : '')).join('')
	);
	const toolParts = $derived(message.parts.filter(isToolPart));

	function isToolPart(part: MessagePart): part is ToolPart {
		return part.type === 'dynamic-tool' || part.type.startsWith('tool-');
	}

	function getToolName(part: ToolPart) {
		return part.type === 'dynamic-tool'
			? (part.toolName ?? 'tool')
			: part.type.replace(/^tool-/, '');
	}

	function getToolSummary(part: ToolPart) {
		switch (part.state) {
			case 'input-streaming':
				return `Preparing ${getToolName(part)}`;
			case 'input-available':
				return `Calling ${getToolName(part)}`;
			case 'output-available':
				return `Completed ${getToolName(part)}`;
			case 'output-error':
				return `Failed ${getToolName(part)}`;
			case 'approval-requested':
				return `Approval requested for ${getToolName(part)}`;
			case 'approval-responded':
				return `Approval recorded for ${getToolName(part)}`;
			case 'output-denied':
				return `Denied ${getToolName(part)}`;
			default:
				return getToolName(part);
		}
	}

	function stringify(value: unknown) {
		if (value === undefined) return '';
		if (typeof value === 'string') return value;
		return JSON.stringify(value, null, 2);
	}

	let handleCopy = () => {
		navigator.clipboard.writeText(messageText);
	};

	let regenerate = () => {
		// chat provides .regenerate() method which regenerates the last assistant message
		chat.regenerate();
	};
</script>

<Message.Root
	class={cn(
		'mx-auto flex w-full max-w-3xl flex-col gap-0 px-2 md:px-10',
		isAssistant ? 'items-start' : 'items-end'
	)}
>
	{#if isAssistant}
		<div class="group flex w-full flex-col gap-0">
			{#if toolParts.length > 0}
				<ChainOfThought.Root class="mb-3 w-full">
					{#each toolParts as part (part.toolCallId)}
						<ChainOfThought.Step open={part.state !== 'output-available'}>
							<ChainOfThought.Trigger>
								{#snippet leftIcon()}
									{#if part.state === 'output-available'}
										<CheckCircle2 class="size-4 text-emerald-500" />
									{:else if part.state === 'output-error' || part.state === 'output-denied'}
										<XCircle class="size-4 text-destructive" />
									{:else if part.state === 'input-streaming' || part.state === 'input-available'}
										<LoaderCircle class="size-4 animate-spin text-muted-foreground" />
									{:else}
										<Wrench class="size-4 text-muted-foreground" />
									{/if}
								{/snippet}

								{getToolSummary(part)}
							</ChainOfThought.Trigger>

							<ChainOfThought.Content>
								<ChainOfThought.Item>
									<div class="space-y-2 rounded-lg border bg-muted/40 p-3">
										<div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
											<span class="rounded bg-background px-1.5 py-0.5 font-mono">
												{getToolName(part)}
											</span>
											<span>{part.state}</span>
										</div>

										{#if part.input !== undefined}
											<div>
												<div class="mb-1 text-xs font-medium text-foreground">Input</div>
												<pre
													class="max-h-64 overflow-auto rounded bg-background p-2 text-xs whitespace-pre-wrap">{stringify(
														part.input
													)}</pre>
											</div>
										{/if}

										{#if part.output !== undefined}
											<div>
												<div class="mb-1 text-xs font-medium text-foreground">Result</div>
												<pre
													class="max-h-80 overflow-auto rounded bg-background p-2 text-xs whitespace-pre-wrap">{stringify(
														part.output
													)}</pre>
											</div>
										{/if}

										{#if part.errorText}
											<div>
												<div class="mb-1 text-xs font-medium text-destructive">Error</div>
												<pre
													class="max-h-64 overflow-auto rounded bg-destructive/10 p-2 text-xs whitespace-pre-wrap text-destructive">{part.errorText}</pre>
											</div>
										{/if}
									</div>
								</ChainOfThought.Item>
							</ChainOfThought.Content>
						</ChainOfThought.Step>
					{/each}
				</ChainOfThought.Root>
			{/if}

			<Message.Content
				class="w-full min-w-0 flex-1 rounded-lg bg-transparent p-0 text-foreground"
				markdown={true}
				content={messageText}
			/>
			<Message.Actions
				class={cn(
					'-ml-2.5 flex gap-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100',
					isLastMessage && 'opacity-100'
				)}
			>
				<Message.Action delayDuration={100}>
					{#snippet tooltip()}
						Copy
					{/snippet}
					<Button variant="ghost" size="icon" onclick={handleCopy} class="rounded-full">
						<Copy class="h-4 w-4" />
					</Button>
				</Message.Action>
				<Message.Action delayDuration={100}>
					{#snippet tooltip()}
						Upvote
					{/snippet}
					<Button variant="ghost" size="icon" class="rounded-full">
						<ThumbsUp class="h-4 w-4" />
					</Button>
				</Message.Action>
				<Message.Action delayDuration={100}>
					{#snippet tooltip()}
						Downvote
					{/snippet}
					<Button variant="ghost" size="icon" class="rounded-full">
						<ThumbsDown class="h-4 w-4" />
					</Button>
				</Message.Action>
				<Message.Action delayDuration={100}>
					{#snippet tooltip()}
						Regenerate
					{/snippet}
					<Button variant="ghost" size="icon" onclick={regenerate} class="rounded-full">
						<RotateCcw class="h-4 w-4" />
					</Button>
				</Message.Action>
			</Message.Actions>
		</div>
	{:else}
		<div class="group flex w-full flex-col items-end gap-1">
			<Message.Content
				class="max-w-[85%] rounded-3xl bg-muted px-5 py-2.5 whitespace-pre-wrap text-primary sm:max-w-[75%]"
			>
				{messageText}
			</Message.Content>
			<Message.Actions
				class={cn('flex gap-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100')}
			>
				<Message.Action delayDuration={100}>
					{#snippet tooltip()}
						Copy
					{/snippet}
					<Button variant="ghost" size="icon" class="rounded-full">
						<Copy class="h-4 w-4" />
					</Button>
				</Message.Action>
			</Message.Actions>
		</div>
	{/if}
</Message.Root>
