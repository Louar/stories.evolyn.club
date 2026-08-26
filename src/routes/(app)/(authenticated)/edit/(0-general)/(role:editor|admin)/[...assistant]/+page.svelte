<script lang="ts">
	import { browser } from '$app/environment';
	import * as ChatContainer from '$lib/components/ai/chat-container';
	import * as PromptInput from '$lib/components/ai/prompt-input';
	import Header from '$lib/components/app/header/app-header.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Chat } from '@ai-sdk/svelte';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import StopIcon from '@lucide/svelte/icons/square';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { DefaultChatTransport, type UIMessage } from 'ai';
	import ErrorMessage from './error-message.svelte';
	import LoadingMessage from './loading-message.svelte';
	import MessageComponent from './message-component.svelte';

	const STORAGE_KEY = 'edit-assistant-chat-messages';

	function getStoredMessages(): UIMessage[] {
		if (!browser) return [];

		try {
			const storedMessages = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');

			return Array.isArray(storedMessages) ? (storedMessages as UIMessage[]) : [];
		} catch {
			localStorage.removeItem(STORAGE_KEY);
			return [];
		}
	}

	let inputValue = $state('');

	const chat = new Chat({
		messages: getStoredMessages(),
		transport: new DefaultChatTransport({
			api: `/api/assistants`,
			prepareSendMessagesRequest: ({ messages }) => ({
				body: { messages }
			})
		})
	});

	let handleSubmit = () => {
		if (!inputValue.trim()) return;

		chat.sendMessage({ text: inputValue });
		inputValue = '';
	};

	let isLoading = $derived(chat.status !== 'ready');

	let stop = () => {
		chat.stop();
	};

	let clearHistory = async () => {
		if (chat.status !== 'ready' && chat.status !== 'error') {
			await chat.stop();
		}

		chat.messages = [];
		inputValue = '';
		localStorage.removeItem(STORAGE_KEY);
		chat.clearError();
	};

	$effect(() => {
		if (chat.messages.length === 0) {
			localStorage.removeItem(STORAGE_KEY);
			return;
		}

		localStorage.setItem(STORAGE_KEY, JSON.stringify(chat.messages));
	});
</script>

<Header>
	<h1 class="overflow-hidden text-sm whitespace-nowrap">Assistant</h1>
</Header>

<div class="flex h-[calc(100svh-(--spacing(16)))] w-full flex-col overflow-hidden">
	<ChatContainer.Root
		class="relative mx-auto mb-4 h-full w-full max-w-2xl flex-1 space-y-0 overflow-y-auto"
	>
		<ChatContainer.Content class="min-w-full space-y-0 py-12">
			{#each chat.messages as message, index (message.id)}
				{@const isLastMessage = index === chat.messages.length - 1}
				<MessageComponent {message} {isLastMessage} {chat} />
			{/each}

			{#if chat.status === 'submitted'}
				<LoadingMessage />
			{/if}

			{#if chat.status === 'error' && chat.error}
				<ErrorMessage error={chat.error} />
			{/if}
		</ChatContainer.Content>
	</ChatContainer.Root>

	<div class="inset-x-0 bottom-0 mx-auto w-full max-w-2xl shrink-0 px-3 pb-3 md:px-5 md:pb-5">
		<PromptInput.Root
			{isLoading}
			value={inputValue}
			onValueChange={(value) => (inputValue = value)}
			onSubmit={handleSubmit}
			class="relative z-10 w-full rounded-3xl border border-input bg-popover p-0 pt-1 shadow-xs"
		>
			<div class="flex flex-col">
				<PromptInput.Textarea
					placeholder="Ask anything"
					class="min-h-11 pt-3 pl-4 text-base leading-[1.3] sm:text-base md:text-base"
				/>

				<PromptInput.Actions class="mt-3 flex w-full items-center justify-between gap-2 p-2">
					<Button
						variant="ghost"
						size="sm"
						onclick={clearHistory}
						disabled={chat.messages.length === 0 && inputValue.length === 0}
						class="rounded-full text-muted-foreground"
					>
						<TrashIcon size={16} />
						New chat
					</Button>

					<div class="flex items-center gap-2">
						<Button
							size="icon"
							onclick={() => {
								if (chat.status === 'ready' || chat.status === 'error') {
									handleSubmit();
								} else {
									stop();
								}
							}}
							class="size-9 rounded-full"
						>
							{#if chat.status === 'ready' || chat.status === 'error'}
								<ArrowUpIcon />
							{:else}
								<StopIcon />
							{/if}
						</Button>
					</div>
				</PromptInput.Actions>
			</div>
		</PromptInput.Root>
	</div>
</div>
