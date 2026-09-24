import type { Completion } from '@codemirror/autocomplete';
import { StateEffect, StateField } from '@codemirror/state';

import type { NlDiagnostic, PolicyVariableType } from '../zen-types';

import { applyCompletion } from './zen';

export type VariableType = PolicyVariableType;

export type ZenType = {
	error: string | null;
	kind: PolicyVariableType;
	nodeKind: string;
	span: [number, number];
};

export type TypeField = {
	root?: VariableType;
	expectedVariableType?: VariableType;
	source?: string;
	types: ZenType[];
	diagnostics: NlDiagnostic[];
	rootKind: PolicyVariableType;
	expressionType: 'standard' | 'unary';
	strict: boolean;
};

const defaultTypeField: TypeField = {
	types: [],
	diagnostics: [],
	rootKind: { type: 'any' },
	expressionType: 'standard',
	strict: false
};

export const updateVariableTypeEffect = StateEffect.define<PolicyVariableType | null>();
export const updateExpressionTypeEffect = StateEffect.define<'standard' | 'unary'>();
export const updateExpectedVariableTypeEffect = StateEffect.define<PolicyVariableType | null>();
export const updateStrictModeEffect = StateEffect.define<boolean>();

const tokenizeExpression = (
	_source: string,
	_rootType: PolicyVariableType,
	_expressionType: 'standard' | 'unary',
	_strict: boolean
) => {
	return {
		diagnostics: [],
		types: []
	};
};

export const typeField = StateField.define<TypeField>({
	create() {
		return defaultTypeField;
	},
	update(value, transaction) {
		try {
			const updateExpressionType = transaction.effects.find((effect) =>
				effect.is(updateExpressionTypeEffect)
			);
			const expressionType = updateExpressionType?.value ?? value.expressionType;

			const updateExpectedVariableType = transaction.effects.find((effect) =>
				effect.is(updateExpectedVariableTypeEffect)
			);
			const expectedVariableType =
				updateExpectedVariableType === undefined
					? value.expectedVariableType
					: (updateExpectedVariableType.value ?? undefined);

			const updateVariableType = transaction.effects.find((effect) =>
				effect.is(updateVariableTypeEffect)
			);
			const variableType =
				updateVariableType === undefined ? (value.root ?? null) : updateVariableType.value;

			const updateStrictMode = transaction.effects.find((effect) =>
				effect.is(updateStrictModeEffect)
			);
			const strict = updateStrictMode?.value ?? value.strict;

			if (
				!transaction.docChanged &&
				!updateExpressionType &&
				!updateVariableType &&
				!updateStrictMode
			) {
				return { ...value, expressionType, expectedVariableType, strict };
			}

			const source = transaction.newDoc.toString();
			const rootType = variableType ?? defaultTypeField.rootKind;
			const { diagnostics, types } = tokenizeExpression(source, rootType, expressionType, strict);
			return {
				source,
				expressionType,
				expectedVariableType,
				strict,
				root: variableType ?? undefined,
				rootKind: rootType,
				diagnostics,
				types
			};
		} catch {
			return value;
		}
	},
	compare(a, b) {
		return (
			a.source === b.source &&
			a.expressionType === b.expressionType &&
			a.root === b.root &&
			a.expectedVariableType === b.expectedVariableType &&
			a.strict === b.strict
		);
	}
});

type BuildTypeCompletionParams = {
	kind: unknown;
	type?: string;
};

export const buildTypeCompletion = ({
	kind,
	type = 'property'
}: BuildTypeCompletionParams): Completion[] => {
	if (!kind || typeof kind !== 'object' || !('type' in kind) || kind.type !== 'object') {
		return [];
	}

	return Object.entries((kind as PolicyVariableType & { type: 'object' }).fields).map(
		([key, value]) => ({
			label: key,
			type,
			boost: 50,
			detail: zenKindToString(value),
			apply: applyCompletion
		})
	);
};

export const getKindAtPath = (kind: unknown, path: string): unknown => {
	if (path === '') {
		return kind;
	}

	return path.split('.').reduce<unknown>((current, key) => {
		if (!current || typeof current !== 'object') {
			return undefined;
		}

		if ('type' in current && current.type === 'object') {
			return (current as PolicyVariableType & { type: 'object' }).fields[key];
		}

		return undefined;
	}, kind);
};

export const getTypeFieldKindAtPath = (field: TypeField, path: string): unknown => {
	const kind = getKindAtPath(field.rootKind, path);
	if (kind) {
		return kind;
	}

	return undefined;
};

export const zenKindToString = (type: unknown): string => {
	if (type && typeof type === 'object') {
		if ('type' in type) {
			switch ((type as PolicyVariableType).type) {
				case 'any':
					return 'any';
				case 'null':
					return 'null';
				case 'bool':
					return 'bool';
				case 'string':
					return 'string';
				case 'number':
					return 'number';
				case 'date':
					return 'date';
				case 'interval':
					return 'interval';
				case 'object':
					return 'object';
				case 'array':
					return `${zenKindToString((type as PolicyVariableType & { type: 'array' }).items)}[]`;
				case 'const':
					return `"${(type as PolicyVariableType & { type: 'const' }).value}"`;
				case 'enum':
					return (type as PolicyVariableType & { type: 'enum' }).values
						.map((item) => `"${item}"`)
						.join(' | ');
				case 'nullable':
					return `${zenKindToString((type as PolicyVariableType & { type: 'nullable' }).inner)} | null`;
			}
		}
	}

	return 'unknown';
};
