export type PolicySeverity = 'error' | 'warning' | 'hint';

export type PolicySpan = [number, number];

export type PolicyVariableType =
	| { type: 'any' }
	| { type: 'null' }
	| { type: 'bool' }
	| { type: 'string' }
	| { type: 'number' }
	| { type: 'date' }
	| { type: 'interval' }
	| { type: 'const'; value: string }
	| { type: 'enum'; name: string | null; values: string[] }
	| { type: 'array'; items: PolicyVariableType }
	| { type: 'object'; fields: Record<string, PolicyVariableType> }
	| { type: 'nullable'; inner: PolicyVariableType };

export type NlDiagnostic = {
	span: PolicySpan;
	message: string;
	severity: PolicySeverity;
	source: 'lexer' | 'parser' | 'typeCheck' | 'compiler';
};
