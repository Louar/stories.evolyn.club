import type { FormFieldProxy } from "sveltekit-superforms";

export const FIELD_CONTEXT = Symbol("field-context");

export type FieldContext = {
	id: string;
	name: string;
	field: FormFieldProxy<unknown>;
};
