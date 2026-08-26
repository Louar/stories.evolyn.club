<script lang="ts">
	import { bracketMatching, syntaxHighlighting } from '@codemirror/language';
	import { Annotation, Compartment, EditorState, type Extension } from '@codemirror/state';
	import { EditorView, placeholder as placeholderExt } from '@codemirror/view';
	import { onMount } from 'svelte';
	import { toPolicyVariableType } from './json-schema-variable-type';
	import './jdm-expression.css';

	import {
		updateExpectedVariableTypeEffect,
		updateExpressionTypeEffect,
		updateStrictModeEffect,
		updateVariableTypeEffect
	} from './extensions/types';
	import { zenExtensions, zenStyleDark, zenStyleLight } from './extensions/zen';

	type Props = {
		value?: string;
		type?: 'standard' | 'unary' | 'template';
		placeholder?: string;
		disabled?: boolean;
		lint?: boolean;
		strict?: boolean;
		maxRows?: number;
		variableType?: unknown;
		expectedVariableType?: unknown;
		onChange?: (value: string) => void;
		onEscape?: () => void;
		onTab?: (direction: 'left' | 'right') => void;
		onCtrlEnter?: () => void;
		class?: string;
	};

	let {
		value = '',
		type = 'unary',
		placeholder = '',
		disabled = false,
		lint = true,
		strict = false,
		maxRows = 6,
		variableType = undefined,
		expectedVariableType = undefined,
		onChange,
		onEscape,
		onTab,
		onCtrlEnter,
		class: className = ''
	}: Props = $props();

	let container = $state<HTMLDivElement | null>(null);
	let view = $state<EditorView | null>(null);

	const zenHighlightLight = syntaxHighlighting(zenStyleLight);
	const zenHighlightDark = syntaxHighlighting(zenStyleDark);

	const compartments = {
		zen: new Compartment(),
		theme: new Compartment(),
		placeholder: new Compartment(),
		readOnly: new Compartment()
	};

	const externalValueUpdate = Annotation.define<boolean>();

	const getThemeExtension = () =>
		document.documentElement.classList.contains('dark') ? zenHighlightDark : zenHighlightLight;

	const getPlaceholderExtension = (text: string): Extension => {
		return text ? placeholderExt(text) : [];
	};

	const getReadOnlyExtension = (disabled: boolean): Extension => {
		return [EditorView.editable.of(!disabled), EditorState.readOnly.of(disabled)];
	};

	const getExpressionType = () => {
		return type === 'unary' ? 'unary' : 'standard';
	};

	const updateListener = EditorView.updateListener.of((update) => {
		if (!update.docChanged) return;

		const isExternalUpdate = update.transactions.some((transaction) =>
			transaction.annotation(externalValueUpdate)
		);

		if (!isExternalUpdate) {
			onChange?.(update.state.doc.toString());
		}
	});

	const keyHandlers = EditorView.domEventHandlers({
		keydown(event) {
			if (event.key === 'Escape') {
				event.preventDefault();
				event.stopPropagation();
				onEscape?.();
				return true;
			}

			if (event.key === 'Tab') {
				event.preventDefault();
				event.stopPropagation();
				onTab?.(event.shiftKey ? 'left' : 'right');
				return true;
			}

			if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
				event.preventDefault();
				event.stopPropagation();
				onCtrlEnter?.();
				return true;
			}

			return false;
		}
	});

	const dispatchEditorConfig = () => {
		if (!view) return;

		view.dispatch({
			effects: [
				compartments.zen.reconfigure(
					zenExtensions({
						type,
						lint
					})
				),
				compartments.placeholder.reconfigure(getPlaceholderExtension(placeholder)),
				compartments.readOnly.reconfigure(getReadOnlyExtension(disabled)),
				updateExpressionTypeEffect.of(getExpressionType()),
				updateStrictModeEffect.of(strict)
			]
		});
	};

	const zenVariableType = $derived(
		variableType === null || variableType === undefined ? null : toPolicyVariableType(variableType)
	);
	const zenExpectedVariableType = $derived(
		expectedVariableType === null || expectedVariableType === undefined
			? null
			: toPolicyVariableType(expectedVariableType)
	);

	const dispatchVariableTypes = () => {
		if (!view) return;

		view.dispatch({
			effects: [
				updateVariableTypeEffect.of(zenVariableType),
				updateExpectedVariableTypeEffect.of(zenExpectedVariableType)
			]
		});
	};

	onMount(() => {
		if (!container) return;

		const initialState = EditorState.create({
			doc: value,
			extensions: [
				EditorView.lineWrapping,
				bracketMatching(),
				compartments.zen.of(
					zenExtensions({
						type,
						lint
					})
				),
				compartments.theme.of(getThemeExtension()),
				compartments.placeholder.of(getPlaceholderExtension(placeholder)),
				compartments.readOnly.of(getReadOnlyExtension(disabled)),
				updateListener,
				keyHandlers
			]
		});

		view = new EditorView({
			parent: container,
			state: initialState
		});

		view.focus();
		view.dispatch({
			selection: { anchor: view.state.doc.length }
		});

		let isDark = document.documentElement.classList.contains('dark');

		const themeObserver = new MutationObserver(() => {
			const nextIsDark = document.documentElement.classList.contains('dark');
			if (nextIsDark === isDark || !view) return;

			isDark = nextIsDark;
			view.dispatch({
				effects: compartments.theme.reconfigure(getThemeExtension())
			});
		});

		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class']
		});

		return () => {
			themeObserver.disconnect();
			view?.destroy();
			view = null;
		};
	});

	$effect(() => {
		if (!view) return;

		const current = view.state.doc.toString();
		if (current === value) return;

		const currentHead = view.state.selection.main.head;
		const nextSelection = currentHead > value.length ? { anchor: value.length } : undefined;

		view.dispatch({
			changes: {
				from: 0,
				to: view.state.doc.length,
				insert: value
			},
			selection: nextSelection,
			annotations: externalValueUpdate.of(true)
		});
	});

	$effect(() => {
		dispatchEditorConfig();
	});

	$effect(() => {
		dispatchVariableTypes();
	});
</script>

<div
	bind:this={container}
	class={`grl-ce jdm-expression-editor ${className}`}
	style={`--editorMaxRows: ${maxRows};`}
	data-type={type}
></div>
