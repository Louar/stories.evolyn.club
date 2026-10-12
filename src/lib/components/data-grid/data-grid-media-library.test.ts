import { describe, expect, it } from 'vitest';
import { MediaCollection } from '$lib/db/schemas/0-utils.js';
import { clientMediaToFileCellData, selectLibraryFile } from './data-grid-media-library.js';

const image = {
	id: 'media-1',
	name: 'image.png',
	description: 'Image',
	size: 1024
};

describe('file-with-library-or-url media selection', () => {
	it('maps client media to file cell data', () => {
		expect(clientMediaToFileCellData(image)).toEqual({
			id: 'media-1',
			collection: MediaCollection.clients,
			filename: 'image.png'
		});
	});

	it('replaces the current value for single-file cells', () => {
		expect(
			selectLibraryFile(
				[{ id: 'old', collection: MediaCollection.clients, filename: 'old.png' }],
				image,
				{ multiple: false, maxFiles: 1 }
			)
		).toEqual([clientMediaToFileCellData(image)]);
	});

	it('deduplicates selections and observes the maximum', () => {
		const selected = clientMediaToFileCellData(image);
		expect(selectLibraryFile([selected], image, { multiple: true, maxFiles: 2 })).toEqual([
			selected
		]);
		expect(
			selectLibraryFile(
				[selected],
				{ ...image, id: 'media-2', name: 'other.png' },
				{ multiple: true, maxFiles: 1 }
			)
		).toEqual([selected]);
	});
});
