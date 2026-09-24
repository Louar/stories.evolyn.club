import { HighlightStyle, syntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { highlightCode as lezerHighlightCode, tags as t } from '@lezer/highlight';

import { escapeHtml } from './extensions/diagnostic';
import { zenExtensions } from './extensions/zen';

const previewHighlightStyle = HighlightStyle.define([
	{
		tag: [t.bracket, t.operator, t.variableName, t.propertyName, t.content, t.punctuation],
		class: 'jdm-token-default'
	},
	{ tag: [t.number, t.bool], class: 'jdm-token-atom' },
	{
		tag: [t.function(t.variableName), t.keyword, t.self, t.special(t.brace), t.logicOperator],
		class: 'jdm-token-keyword'
	},
	{ tag: [t.string, t.meta, t.name, t.quote], class: 'jdm-token-string' },
	{ tag: t.invalid, class: 'jdm-token-invalid' }
]);

type HighlightJdmParams = {
	code: string;
	theme?: 'light' | 'dark';
	type?: 'standard' | 'unary' | 'template';
	placeholder?: string;
};

export const highlightJdm = ({
	code,
	theme = 'light',
	type = 'standard',
	placeholder
}: HighlightJdmParams): string => {
	if (!code.trim()) {
		return `<span class="cm-line">${placeholder ? `<span class="cm-placeholder">${escapeHtml(placeholder)}</span>` : '<br />'}</span>`;
	}

	try {
		const state = EditorState.create({
			doc: code,
			extensions: [zenExtensions({ type, lazy: true })]
		});

		const tree = syntaxTree(state);
		if (!tree || tree.length === 0) {
			return escapeHtml(code);
		}

		let html = '<span class="cm-line">';
		lezerHighlightCode(
			code,
			tree,
			previewHighlightStyle,
			(text, classes) => {
				if (classes) {
					html += `<span class="${classes}">${escapeHtml(text)}</span>`;
				} else {
					html += escapeHtml(text);
				}
			},
			() => {
				html += '</span><span class="cm-line">';
			}
		);
		html += '</span>';
		return html;
	} catch {
		return escapeHtml(code);
	}
};
