<script lang="ts">
	import { onMount } from 'svelte';
	import 'vidstack/bundle';
	import type { MediaPlayerElement } from 'vidstack/elements';

	type Props = {
		src: string;
		setError: (hasError: boolean | undefined) => {};
		setDuration: (duration: number | undefined) => {};
	};
	let { src, setError, setDuration }: Props = $props();

	let player: MediaPlayerElement;

	onMount(() => {
		player?.subscribe(({ canPlay, error }) => {
			if (error) {
				setError(true);
			} else if (canPlay && player?.duration) {
				setError(false);
				setDuration(Math.round(player.duration));
			}
		});
	});
</script>

<media-player bind:this={player} class="hidden!" {src} load="eager">
	<media-provider></media-provider>
</media-player>
