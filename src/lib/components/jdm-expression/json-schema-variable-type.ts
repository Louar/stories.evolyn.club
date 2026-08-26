import type { PolicyVariableType } from './zen-types';

export type VariableTypeJson = PolicyVariableType;

type JsonSchema = {
	type?: string | string[];
	properties?: Record<string, JsonSchema>;
	items?: JsonSchema;
	enum?: unknown[];
	const?: unknown;
	oneOf?: unknown[];
	anyOf?: unknown[];
	allOf?: unknown[];
};

const getPrimaryType = (type: JsonSchema['type']): string | undefined => {
	if (typeof type === 'string') return type;
	if (Array.isArray(type)) {
		return type.find((entry) => entry !== 'null');
	}
	return undefined;
};

export const toPolicyVariableType = (input: unknown): PolicyVariableType => {
	if (typeof input === 'string') {
		switch (input) {
			case 'Null':
				return { type: 'null' };
			case 'Bool':
				return { type: 'bool' };
			case 'String':
				return { type: 'string' };
			case 'Number':
				return { type: 'number' };
			case 'Date':
				return { type: 'date' };
			case 'Interval':
				return { type: 'interval' };
			default:
				return { type: 'any' };
		}
	}

	if (!input || typeof input !== 'object') {
		return { type: 'any' };
	}

	const type = input as Record<string, unknown>;
	if (typeof type.t === 'string') {
		switch (type.t) {
			case 'null':
				return { type: 'null' };
			case 'bool':
				return { type: 'bool' };
			case 'string':
				return { type: 'string' };
			case 'number':
				return { type: 'number' };
			case 'date':
				return { type: 'date' };
			case 'interval':
				return { type: 'interval' };
			case 'array':
				return { type: 'array', items: toPolicyVariableType((type as { items?: unknown }).items) };
			default:
				return { type: 'any' };
		}
	}

	if (typeof type.type === 'string') {
		return type as PolicyVariableType;
	}

	if (typeof type.Const === 'string') {
		return { type: 'const', value: type.Const };
	}

	if (Array.isArray(type.Enum)) {
		return {
			type: 'enum',
			name: typeof type.Enum[0] === 'string' ? type.Enum[0] : null,
			values: Array.isArray(type.Enum[1])
				? type.Enum[1].filter((value) => typeof value === 'string')
				: []
		};
	}

	if (type.Array) {
		return { type: 'array', items: toPolicyVariableType(type.Array) };
	}

	if (type.Object && typeof type.Object === 'object') {
		return {
			type: 'object',
			fields: Object.fromEntries(
				Object.entries(type.Object).map(([key, value]) => [key, toPolicyVariableType(value)])
			)
		};
	}

	return { type: 'any' };
};

export const jsonSchemaToVariableType = (schema: unknown): VariableTypeJson => {
	if (!schema || typeof schema !== 'object') {
		return { type: 'any' };
	}

	const typedSchema = schema as JsonSchema;
	if (typedSchema.oneOf || typedSchema.anyOf || typedSchema.allOf) {
		return { type: 'any' };
	}

	if (typeof typedSchema.const === 'string') {
		return { type: 'const', value: typedSchema.const };
	}

	if (
		Array.isArray(typedSchema.enum) &&
		typedSchema.enum.length > 0 &&
		typedSchema.enum.every((entry) => typeof entry === 'string')
	) {
		return { type: 'enum', name: null, values: typedSchema.enum as string[] };
	}

	const type = getPrimaryType(typedSchema.type);
	if (type === 'object' || typedSchema.properties) {
		return {
			type: 'object',
			fields: Object.fromEntries(
				Object.entries(typedSchema.properties ?? {}).map(([key, value]) => [
					key,
					jsonSchemaToVariableType(value)
				])
			)
		};
	}

	if (type === 'array' && typedSchema.items) {
		return { type: 'array', items: jsonSchemaToVariableType(typedSchema.items) };
	}

	if (type === 'string') return { type: 'string' };
	if (type === 'number' || type === 'integer') return { type: 'number' };
	if (type === 'boolean') return { type: 'bool' };
	if (type === 'null') return { type: 'null' };

	return { type: 'any' };
};

export const propertyTemplatesToVariableType = (
	propertyTemplates: Array<{ slug: string; schema: unknown }>
): VariableTypeJson => ({
	type: 'object',
	fields: Object.fromEntries(
		propertyTemplates
			.filter(
				(propertyTemplate) =>
					typeof propertyTemplate.slug === 'string' && propertyTemplate.slug.length > 0
			)
			.map((propertyTemplate) => [
				propertyTemplate.slug,
				jsonSchemaToVariableType(propertyTemplate.schema)
			])
	)
});
