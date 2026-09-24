import { DataGridAdapterError } from '$lib/hooks/use-custom-data-grid.svelte.js';

export async function requireDataGridJsonResponse<T>(
	response: Response,
	action: string
): Promise<T> {
	if (!response.ok) {
		let body: unknown;
		try {
			body = (response.headers.get('content-type') ?? '').includes('json')
				? await response.json()
				: await response.text();
		} catch {
			body = undefined;
		}
		throw new DataGridAdapterError(`Failed to ${action}`, response.status, body);
	}
	return response.json() as Promise<T>;
}

export function getDuplicateSlug(slug: string, existingSlugs: Iterable<string>): string {
	const existing = new Set(existingSlugs);
	const base = `${slug}-copy`;
	if (!existing.has(base)) return base;

	let suffix = 2;
	while (existing.has(`${base}-${suffix}`)) suffix++;
	return `${base}-${suffix}`;
}
