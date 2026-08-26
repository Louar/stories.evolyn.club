import { MediaCollection } from '$lib/db/schemas/0-utils.js';
import type { FileCellData } from './types/data-grid.js';

export type FileCellItemLike = FileCellData & {
	localFile?: File;
	isUploading?: boolean;
};

export function normalizeFiles(
	items: readonly FileCellItemLike[] | null | undefined
): FileCellData[] | null {
	if (!items?.length) return null;
	return items.map(({ id, collection, filename }) => ({ id, collection, filename }));
}

export function getFileCellItems(value: unknown): FileCellItemLike[] {
	const items = Array.isArray(value) ? value : value ? [value] : [];
	return items.flatMap((item) => {
		const valid =
			typeof item === 'object' &&
			item !== null &&
			typeof (item as FileCellItemLike).filename === 'string' &&
			typeof (item as FileCellItemLike).collection === 'string';
		if (!valid) return [];
		const file = item as FileCellItemLike;
		return [{ ...file, id: typeof file.id === 'string' ? file.id : file.filename }];
	});
}

export function isExternalMedia(file: FileCellItemLike): boolean {
	return file.collection === MediaCollection.externals;
}

export function isDeletableUploadedMedia(file: FileCellItemLike): boolean {
	return (
		!file.isUploading &&
		!file.localFile &&
		(file.collection === MediaCollection.clients || file.collection === MediaCollection.users)
	);
}

export function mediaDeleteKey(file: Pick<FileCellData, 'collection' | 'filename'>): string {
	return `${file.collection}\0${file.filename}`;
}

export function deduplicateDeletableMedia(items: readonly FileCellItemLike[]): FileCellItemLike[] {
	const unique = new Map<string, FileCellItemLike>();
	for (const item of items) {
		const key = mediaDeleteKey(item);
		if (isDeletableUploadedMedia(item) && !unique.has(key)) unique.set(key, item);
	}
	return [...unique.values()];
}
