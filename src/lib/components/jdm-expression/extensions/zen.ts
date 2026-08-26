import {
	autocompletion,
	closeBrackets,
	closeBracketsKeymap,
	type Completion,
	type CompletionContext,
	type CompletionResult
} from '@codemirror/autocomplete';
import { history, historyKeymap, insertNewlineAndIndent } from '@codemirror/commands';
import { HighlightStyle, LRLanguage, LanguageSupport, syntaxTree } from '@codemirror/language';
import type { EditorView } from '@codemirror/view';
import { hoverTooltip, keymap } from '@codemirror/view';
import { parser as zenParser } from '@gorules/lezer-zen';
import { parser as zenTemplateParser } from '@gorules/lezer-zen-template';
import { NodeProp, parseMixed, type SyntaxNode } from '@lezer/common';
import { tags as t } from '@lezer/highlight';

import { getCompletions } from './completion';
import { renderDiagnosticMessage } from './diagnostic';
import { zenLinter } from './linter';
import {
	buildTypeCompletion,
	getTypeFieldKindAtPath,
	typeField,
	zenKindToString,
	type TypeField,
	type ZenType
} from './types';

export const applyCompletion = (
	view: EditorView,
	completion: Completion,
	from: number,
	to: number
) => {
	const isCallable = completion.type === 'function' || completion.type === 'method';
	const insert = isCallable ? `${completion.label}()` : completion.label;
	const anchor = isCallable ? from + insert.length - 1 : from + completion.label.length;

	view.dispatch(
		view.state.update({
			changes: { from, to, insert },
			selection: { anchor }
		})
	);
};

const makeExtendedCompletions = (): Completion[] =>
	getCompletions().map((completion) => ({
		...completion,
		detail: completion.detail.replaceAll('`', ''),
		boost: completion.boost ?? undefined,
		apply: applyCompletion
	}));

const hasAutoComplete = (node: SyntaxNode | null): boolean => {
	if (!node) {
		return false;
	}

	const isAutoComplete = node.type.prop(NodeProp.group)?.includes('autoComplete') ?? false;
	return isAutoComplete || hasAutoComplete(node.parent);
};

const autoCompleteSpan = (node: SyntaxNode): [number, number] | null => {
	let lastNode = node;
	if (
		['PropertyExpression', 'PropertyAccess'].includes(lastNode.parent?.name ?? '') &&
		lastNode.parent?.prevSibling
	) {
		lastNode = lastNode.parent.prevSibling;
	}

	let firstNode = lastNode;
	while (firstNode.prevSibling) {
		firstNode = firstNode.prevSibling;
	}

	return [firstNode.from, lastNode.to];
};

const hoverSpan = (node: SyntaxNode): [number, number] | null => {
	let lastNode = node;
	if (lastNode.parent && ['PropertyExpression', 'PropertyAccess'].includes(lastNode.parent.name)) {
		lastNode = lastNode.parent;
	}

	let firstNode = lastNode;
	while (firstNode.prevSibling) {
		firstNode = firstNode.prevSibling;
	}

	return [firstNode.from, lastNode.to];
};

const findTargetType = (
	types: ZenType[] | undefined,
	span: [number, number] | null
): ZenType | undefined => {
	if (!span || !types) {
		return undefined;
	}

	return types.find((type) => type.span[0] === span[0] && type.span[1] === span[1]);
};

const inputVariableSchemaPathAtCursor = (
	context: CompletionContext
): { from: number; schemaPath: string } | null => {
	const beforeCursor = context.state.sliceDoc(0, context.pos);
	const match = /(?:^|[^\w$.])(\$(?:\.[\w$]*)*)$/.exec(beforeCursor);

	if (!match) {
		return null;
	}

	const expression = match[1];
	const lastDot = expression.lastIndexOf('.');
	const propertyPrefix = lastDot === -1 ? expression : expression.slice(lastDot + 1);
	const parentExpression = lastDot === -1 ? null : expression.slice(0, lastDot);

	return {
		from: beforeCursor.length - propertyPrefix.length,
		schemaPath:
			parentExpression === null || parentExpression === '$'
				? ''
				: parentExpression.slice('$.'.length)
	};
};

const inputVariableSchemaCompletions = (field: TypeField, schemaPath: string): Completion[] => {
	return buildTypeCompletion({ type: 'variable', kind: getTypeFieldKindAtPath(field, schemaPath) });
};

const inputVariableSchemaPathFromSpan = (
	source: string,
	span: [number, number] | null
): string | null => {
	if (!span) {
		return null;
	}

	const expression = source.slice(span[0], span[1]);
	if (expression === '$') {
		return '';
	}

	if (!expression.startsWith('$.')) {
		return null;
	}

	return expression.slice('$.'.length);
};

const findCompletionTargetKind = (
	field: TypeField,
	source: string,
	span: [number, number] | null
): unknown => {
	const targetType = findTargetType(field.types, span);
	if (targetType) {
		return targetType.kind;
	}

	const schemaPath = inputVariableSchemaPathFromSpan(source, span);
	if (schemaPath === null) {
		return undefined;
	}

	return getTypeFieldKindAtPath(field, schemaPath);
};

const findHoverTargetKind = (
	field: TypeField,
	source: string,
	span: [number, number] | null
): unknown => {
	const schemaPath = inputVariableSchemaPathFromSpan(source, span);
	if (schemaPath !== null) {
		return getTypeFieldKindAtPath(field, schemaPath);
	}

	return findTargetType(field.types, span)?.kind;
};

const makeExpressionCompletion = () => {
	const methodCompletions = (type: ZenType) =>
		makeExtendedCompletions().filter((completion) => {
			if (completion.type !== 'method') {
				return false;
			}

			const methodFor = (completion as Completion & { methodFor?: unknown }).methodFor;
			return (
				typeof methodFor === 'string' && methodFor.toLowerCase() === zenKindToString(type.kind)
			);
		});

	return (context: CompletionContext): CompletionResult | null => {
		const extendedCompletions = makeExtendedCompletions();
		const topLevelCompletions = extendedCompletions.filter(
			(completion) => completion.type && ['function'].includes(completion.type)
		);
		const tree = syntaxTree(context.state);
		const word = context.state.wordAt(context.pos);
		const node = tree.resolveInner(context.pos, -1);
		const inputVariableSchemaPath = inputVariableSchemaPathAtCursor(context);

		if (inputVariableSchemaPath) {
			const field = context.state.field(typeField);
			return {
				from: inputVariableSchemaPath.from,
				options: inputVariableSchemaCompletions(field, inputVariableSchemaPath.schemaPath),
				validFor: /[\w$]*/
			};
		}

		if (
			!hasAutoComplete(node) ||
			(!context.explicit && context.pos === 0) ||
			(!context.explicit && !word && node.name !== '.')
		) {
			return null;
		}

		const from = word?.from ?? context.pos;
		switch (node.name) {
			case 'Standard':
			case 'VariableName': {
				const field = context.state.field(typeField);
				return {
					from,
					options: [...inputVariableSchemaCompletions(field, ''), ...topLevelCompletions],
					validFor: /\w*/
				};
			}
			case 'String': {
				const field = context.state.field(typeField);
				const targetType = findTargetType(field.types, autoCompleteSpan(node));
				if (!targetType) {
					return null;
				}

				return {
					from: node.from + 1,
					options: buildTypeCompletion({ kind: targetType.kind }),
					validFor: /\w*/
				};
			}
			case '.':
			case 'PropertyName': {
				const field = context.state.field(typeField);
				const targetKind = findCompletionTargetKind(
					field,
					context.state.doc.toString(),
					autoCompleteSpan(node)
				);
				if (!targetKind) {
					return null;
				}

				return {
					from,
					options: [
						...buildTypeCompletion({ kind: targetKind }),
						...methodCompletions({ kind: targetKind } as ZenType)
					],
					validFor: /\w*/
				};
			}
			default:
				return null;
		}
	};
};

export const completionExtension = () =>
	autocompletion({
		override: [makeExpressionCompletion()]
	});

export const hoverExtension = () => {
	return hoverTooltip(
		(view, pos) => {
			const completions = getCompletions();
			const word = view.state.wordAt(pos);
			if (!word) {
				return null;
			}

			const data = view.state.doc.sliceString(word.from, word.to);
			const details = completions.find((completion) => completion.label === data);
			if (details) {
				return {
					pos: word.from,
					end: word.to,
					above: true,
					create() {
						const dom = document.createElement('div');
						dom.classList.add('grl-ce-hover-tooltip');
						dom.style.whiteSpace = 'pre';
						dom.innerHTML = renderDiagnosticMessage({
							text: `<span style="font-size: 12px">${details.info}</span>\n${details.label}: ${details.detail}\n`,
							className: 'cm-hoverTooltipMessageToken'
						});
						return { dom };
					}
				};
			}

			const tree = syntaxTree(view.state);
			const node = tree.resolveInner(pos, -1);
			const field = view.state.field(typeField);
			const span = hoverSpan(node);
			const targetKind = findHoverTargetKind(field, view.state.doc.toString(), span);

			if (targetKind && span) {
				const source = view.state.doc.toString();
				return {
					pos: span[0],
					end: span[1],
					above: true,
					create() {
						const dom = document.createElement('div');
						dom.classList.add('grl-ce-hover-tooltip');
						dom.style.whiteSpace = 'pre';
						dom.innerHTML = renderDiagnosticMessage({
							text: `${source.slice(span[0], span[1])}: \`${zenKindToString(targetKind)}\``,
							className: 'cm-hoverTooltipMessageToken'
						});
						return { dom };
					}
				};
			}

			return null;
		},
		{
			hoverTime: 700,
			hideOnChange: true
		}
	);
};

export const zenStyleLight = HighlightStyle.define([
	{
		tag: [t.bracket, t.operator, t.variableName, t.propertyName, t.content, t.punctuation],
		color: '#080808'
	},
	{ tag: [t.number, t.bool], color: '#015cc5' },
	{
		tag: [t.function(t.variableName), t.keyword, t.self, t.special(t.brace), t.logicOperator],
		color: '#6f42c1'
	},
	{ tag: [t.string, t.meta, t.name, t.quote], color: '#077d16' },
	{ tag: t.invalid, color: '#cb2431' }
]);

export const zenStyleDark = HighlightStyle.define([
	{
		tag: [t.bracket, t.operator, t.variableName, t.propertyName, t.content, t.punctuation],
		color: '#bdbec4'
	},
	{ tag: [t.number, t.bool], color: '#57a8f5' },
	{
		tag: [t.function(t.variableName), t.keyword, t.self, t.special(t.brace), t.logicOperator],
		color: '#c87dbb'
	},
	{ tag: [t.string, t.meta, t.name, t.quote], color: '#6aab73' },
	{ tag: t.invalid, color: '#cb2431' }
]);

const zenLanguage = new LanguageSupport(
	LRLanguage.define({
		parser: zenParser,
		name: 'zen',
		languageData: {
			closeBrackets: { brackets: ['(', '[', '{', "'", '"', '`'] },
			wordChars: '$'
		}
	})
);

const zenTemplateLanguage = new LanguageSupport(
	LRLanguage.define({
		parser: zenTemplateParser.configure({
			wrap: parseMixed((node) => {
				if (node.name === 'ExpressionInner') {
					return { parser: zenParser };
				}

				return null;
			})
		}),
		name: 'zenTemplate',
		languageData: {
			closeBrackets: { brackets: ['(', '[', "'", '"', '{', '`'] },
			wordChars: '$'
		}
	})
);

type ExtensionOptions = {
	type: 'unary' | 'standard' | 'template';
	lint?: boolean;
	lazy?: boolean;
};

export const zenExtensions = ({ type, lint = true, lazy = false }: ExtensionOptions) => {
	if (lazy) {
		return [type !== 'template' ? zenLanguage : zenTemplateLanguage];
	}

	return [
		type !== 'template' ? zenLanguage : zenTemplateLanguage,
		completionExtension(),
		hoverExtension(),
		closeBrackets(),
		lint && type !== 'template' ? zenLinter(type === 'unary' ? 'unary' : 'standard') : [],
		typeField,
		history(),
		keymap.of([
			...closeBracketsKeymap,
			...historyKeymap,
			{ key: 'Enter', run: insertNewlineAndIndent, shift: insertNewlineAndIndent }
		])
	].filter(Boolean);
};
