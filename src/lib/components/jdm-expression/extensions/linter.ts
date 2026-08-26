import { linter, type Diagnostic } from '@codemirror/lint';
import type { PolicyVariableType } from '../zen-types';

import { renderDiagnosticMessage } from './diagnostic';
import type { ZenType } from './types';
import {
	typeField,
	updateExpectedVariableTypeEffect,
	updateExpressionTypeEffect,
	updateStrictModeEffect,
	updateVariableTypeEffect,
	zenKindToString
} from './types';

type ValidateZenExpressionParams = {
	source: string;
	expressionType?: 'standard' | 'unary';
	strict?: boolean;
	types: ZenType[];
	expectedVariableType?: PolicyVariableType;
	expressionDiagnostics?: Diagnostic[];
};

const isSameType = (
	actual: PolicyVariableType,
	expected: PolicyVariableType,
	strict: boolean
): boolean => {
	if (actual.type === 'any') return !strict;
	if (actual.type === expected.type) {
		if (actual.type === 'array' && expected.type === 'array') {
			return isSameType(actual.items, expected.items, strict);
		}
		if (actual.type === 'nullable' && expected.type === 'nullable') {
			return isSameType(actual.inner, expected.inner, strict);
		}
		return true;
	}
	if (expected.type === 'nullable')
		return actual.type === 'null' || isSameType(actual, expected.inner, strict);
	if (actual.type === 'const') return expected.type === 'string';
	if (actual.type === 'enum') return expected.type === 'string';
	return false;
};

const inferExpressionKind = (source: string, types: ZenType[]): PolicyVariableType | null => {
	const [type] = types;
	if (types.length === 1 && type?.span[0] === 0 && type.span[1] === source.length) {
		return type.kind;
	}

	if (/\b(and|or|not|contains|startsWith|endsWith|matches)\b|[=!<>]=?|\bin\b/.test(source)) {
		return { type: 'bool' };
	}

	return null;
};

const createDiagnostic = (diagnostic: Diagnostic): Diagnostic => {
	diagnostic.renderMessage = () => {
		const element = document.createElement('div');
		element.innerHTML = renderDiagnosticMessage({
			text: diagnostic.message,
			className: 'cm-diagnosticMessageToken'
		});
		return element;
	};
	return diagnostic;
};

export const validateZenExpression = ({
	source,
	expressionType = 'standard',
	strict = false,
	types,
	expectedVariableType,
	expressionDiagnostics = []
}: ValidateZenExpressionParams): Diagnostic[] => {
	if (source.trim().length === 0) {
		return [];
	}

	const typeDiagnostics: Diagnostic[] = types
		.filter((type) => Boolean(type.error))
		.map((type) =>
			createDiagnostic({
				from: type.span[0],
				to: type.span[1],
				severity: type.error?.startsWith('Hint:')
					? 'hint'
					: type.error?.startsWith('Info:')
						? 'info'
						: 'warning',
				message: type.error ?? '',
				source: 'Type check'
			})
		);

	const diagnostics = [...expressionDiagnostics, ...typeDiagnostics];
	const expressionResultKind = inferExpressionKind(source, types);

	if (expressionType === 'unary' && expressionResultKind) {
		if (expressionResultKind.type !== 'bool') {
			diagnostics.push(
				createDiagnostic({
					from: 0,
					to: source.length,
					severity: strict ? 'error' : 'warning',
					message: `Expected unary expression to evaluate to type \`bool\`, received \`${zenKindToString(expressionResultKind)}\` instead.`,
					source: 'Type check'
				})
			);
		}
	} else if (expectedVariableType && expressionResultKind) {
		if (!isSameType(expressionResultKind, expectedVariableType, strict)) {
			diagnostics.push(
				createDiagnostic({
					from: 0,
					to: source.length,
					severity: strict ? 'error' : 'warning',
					message: `Expected expression to evaluate to type \`${zenKindToString(expectedVariableType)}\`, received \`${zenKindToString(expressionResultKind)}\` instead.`,
					source: 'Type check'
				})
			);
		}
	}

	return diagnostics;
};

export const zenLinter = (type: 'standard' | 'unary') => {
	return linter(
		(view) => {
			view.dom.setAttribute('data-severity', 'none');
			const fields = view.state.field(typeField);
			const source = view.state.doc.toString();

			const diagnostics = validateZenExpression({
				source,
				expressionType: type,
				strict: fields.strict,
				types: fields.types,
				expectedVariableType: fields.expectedVariableType,
				expressionDiagnostics: fields.diagnostics.map((diagnostic) =>
					createDiagnostic({
						from: diagnostic.span[0],
						to: diagnostic.span[1],
						message: diagnostic.message,
						source: diagnostic.source,
						severity: diagnostic.severity
					})
				)
			});

			if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
				view.dom.setAttribute('data-severity', 'error');
			} else if (diagnostics.some((diagnostic) => diagnostic.severity === 'warning')) {
				view.dom.setAttribute('data-severity', 'warning');
			} else if (diagnostics.some((diagnostic) => diagnostic.severity === 'info')) {
				view.dom.setAttribute('data-severity', 'info');
			} else if (diagnostics.some((diagnostic) => diagnostic.severity === 'hint')) {
				view.dom.setAttribute('data-severity', 'hint');
			}

			return diagnostics;
		},
		{
			needsRefresh: (update) =>
				update.transactions.some((transaction) =>
					transaction.effects.some(
						(effect) =>
							effect.is(updateExpressionTypeEffect) ||
							effect.is(updateVariableTypeEffect) ||
							effect.is(updateExpectedVariableTypeEffect) ||
							effect.is(updateStrictModeEffect)
					)
				)
		}
	);
};
