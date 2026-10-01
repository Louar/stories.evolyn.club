import type { MapAssetLoader, MediaReference, TaxonomyMapAssetV1 } from './playable-map.types';

const assetPromises = new Map<string, Promise<TaxonomyMapAssetV1>>();

export function mediaUrl(reference: MediaReference) {
	return reference.collection === 'externals'
		? reference.filename
		: `/api/media/${reference.collection}/${encodeURIComponent(reference.filename)}`;
}

export const browserMapAssetLoader: MapAssetLoader = {
	load(reference) {
		const key = `${reference.collection}\0${reference.filename}`;
		let promise = assetPromises.get(key);
		if (!promise) {
			promise = fetch(mediaUrl(reference)).then(async (response) => {
				if (!response.ok) throw new Error(`Unable to load taxonomy map asset (${response.status})`);
				return (await response.json()) as TaxonomyMapAssetV1;
			});
			assetPromises.set(key, promise);
		}
		return promise;
	}
};
