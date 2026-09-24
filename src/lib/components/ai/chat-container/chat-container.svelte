<script lang="ts">
	import { cn } from '$lib/utils';
	import { watch } from 'runed';
	import {
		setChatContainerContext,
		type ChatContainerAnimation,
		type ChatContainerInitialAnimation
	} from './context.svelte.js';

	let {
		ref = $bindable<HTMLDivElement | null>(null),
		children,
		class: className,
		resize = 'smooth',
		initial = 'instant',
		...restProps
	}: {
		ref?: HTMLDivElement | null;
		children?: import('svelte').Snippet;
		class?: string;
		resize?: ChatContainerAnimation;
		initial?: ChatContainerInitialAnimation;
		[key: string]: unknown;
	} = $props();

	const context = setChatContainerContext();

	let stickToBottom = true;
	let frame: number | undefined;

	function scrollToBottom() {
		if (!ref || !stickToBottom) return;

		if (frame !== undefined) {
			cancelAnimationFrame(frame);
		}

		frame = requestAnimationFrame(() => {
			if (!ref) return;

			// Important: instant scrolling while content is streaming
			ref.scrollTop = ref.scrollHeight;
		});
	}

	function bindScrollElement(node: HTMLDivElement) {
		ref = node;
		context.setScrollElement(node);

		const handleScroll = () => {
			const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;

			stickToBottom = distanceFromBottom < 48;
		};

		node.addEventListener('scroll', handleScroll, { passive: true });

		return () => {
			node.removeEventListener('scroll', handleScroll);

			if (frame !== undefined) {
				cancelAnimationFrame(frame);
			}

			ref = null;
			context.setScrollElement(null);
		};
	}

	function observeContent(node: HTMLDivElement) {
		const observer = new ResizeObserver(() => {
			scrollToBottom();
		});

		observer.observe(node);

		return () => {
			observer.disconnect();
		};
	}

	watch(
		() => resize,
		() => {
			context.updateResize(resize);
		}
	);

	watch(
		() => initial,
		() => {
			context.updateInitial(initial);
		}
	);
</script>

<div
	{@attach bindScrollElement}
	class={cn('flex overflow-y-auto muted-scrollbar', className)}
	role="log"
	{...restProps}
>
	<div {@attach observeContent} class="w-full">
		{@render children?.()}
	</div>
</div>
