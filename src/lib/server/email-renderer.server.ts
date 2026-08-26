import { Renderer } from '@better-svelte-email/server';

const emailColorDefaults = {
	primary: '#1e293b',
	'primary-foreground': '#f8fafc',
	background: '#ffffff',
	foreground: '#0f172a',
	muted: '#f1f5f9',
	'muted-foreground': '#475569',
	border: '#e2e8f0'
} as const;

function extractCSSVariable(css: string, name: string) {
	const match = css.match(new RegExp(`--${name}\\s*:\\s*([^;{}]+);`));
	return match?.[1]?.trim();
}

export function createEmailRenderer(clientCSS: string) {
	const theme = Object.entries(emailColorDefaults)
		.map(([name, fallback]) => {
			const value = extractCSSVariable(clientCSS, name) ?? fallback;
			return `--color-${name}: ${value};`;
		})
		.join('\n');

	return new Renderer({ customCSS: `@theme { ${theme} }` });
}
