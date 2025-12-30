<script lang="ts">
	import { getContext } from "svelte";
	import { cn } from "$lib/utils.js";
	import { FIELD_CONTEXT, type FieldContext } from "./field-context.js";

	let { class: className, ...restProps } = $props();
	const { id, field } = getContext<FieldContext>(FIELD_CONTEXT);
	const errors = field.errors;
</script>

{#if $errors?.length}
	<ul
		id={`${id}-errors`}
		class={cn("text-destructive text-sm", className)}
		{...restProps}
	>
		{#each $errors as error}
			<li>{error}</li>
		{/each}
	</ul>
{/if}
