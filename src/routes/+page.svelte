<script lang="ts">
	import { marked } from '$lib/client/marked';
	import { Button } from '$lib/components/ui/button';
	import readme from '../../README.md?raw';

	const html = marked.parse(readme);
</script>

<div class="w-full">
	<div class="relative mx-auto w-full max-w-lg py-6">
		<Button href="/edit/stories" class="absolute top-0 right-0 mt-7">Open editor</Button>
		<div class="prose">
			{@html html}
		</div>
	</div>
</div>
