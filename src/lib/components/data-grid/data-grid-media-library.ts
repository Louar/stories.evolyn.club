import { MediaCollection } from '$lib/db/schemas/0-utils.js';
import type { FileCellData } from './types/data-grid.js';

export interface ClientMediaLibraryItem {
	id: string;
	name: string;
	description: string | null;
	size: number;
}

export function clientMediaToFileCellData(item: ClientMediaLibraryItem): FileCellData {
	return { id: item.id, collection: MediaCollection.clients, filename: item.name };
}

export function selectLibraryFile(
	current: readonly FileCellData[],
	item: ClientMediaLibraryItem,
	options: { multiple: boolean; maxFiles: number }
): FileCellData[] {
	const selected = clientMediaToFileCellData(item);
	if (!options.multiple) return [selected];
	if (
		current.some(
			(file) => file.collection === selected.collection && file.filename === selected.filename
		)
	) {
		return [...current];
	}
	if (options.maxFiles && current.length >= options.maxFiles) return [...current];
	return [...current, selected];
}
