<script lang="ts">
	import { getContext } from "svelte";
	import { cn } from "$lib/utils.js";
	import { FIELD_CONTEXT, type FieldContext } from "./field-context.js";

	let { class: className, ...restProps } = $props();
	const { id, name, field } = getContext<FieldContext>(FIELD_CONTEXT);
	const errors = field.errors;

	const describedBy = $derived(() => {
		const ids = [`${id}-description`];
		if ($errors?.length) {
			ids.push(`${id}-errors`);
		}
		return ids.join(" ");
	});
</script>

<div class={cn("grid gap-1", className)} {...restProps}>
	<slot
		{id}
		{name}
		ariaDescribedBy={describedBy}
		ariaInvalid={($errors?.length ?? 0) > 0}
	/>
</div>
