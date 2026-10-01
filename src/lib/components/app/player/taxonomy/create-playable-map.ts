import * as turf from '@turf/turf';
import * as topojsonClient from 'topojson-client';
import type { Feature, FeatureCollection } from 'geojson';
import { browserMapAssetLoader } from './map-asset';
import type {
	CategoryMapV2,
	LoadedPlayableMap,
	MapAssetLoader,
	MapGeometry,
	MapItem,
	PlayableMapRegion,
	RegionDefaults,
	TaxonomyMapAssetV1,
	TaxonomyMapSceneV1
} from './playable-map.types';

type PreparedScene = {
	geometryById: Map<string, MapGeometry>;
	defaultsById: Map<string, RegionDefaults>;
};

const preparedScenes = new WeakMap<TaxonomyMapAssetV1, Map<string, PreparedScene>>();

export async function createPlayableMap(
	categoryMap: CategoryMapV2,
	items: MapItem[],
	loader: MapAssetLoader = browserMapAssetLoader
): Promise<LoadedPlayableMap | null> {
	if (!isCategoryMapV2(categoryMap)) return null;
	const asset = await loader.load(categoryMap.source);
	if (asset.version !== 1) return null;
	const scene = asset.scenes[categoryMap.scene];
	if (!isScene(scene)) return null;
	const prepared = prepareScene(asset, categoryMap.scene, scene);
	const usedReferences = new Set<string>();
	const regions = items.flatMap((item) => {
		const resolved = resolveGeometry(item, prepared, usedReferences);
		if (!resolved) return [];
		const centerCoordinates =
			item.center ??
			resolved.defaults.center ??
			turf.centroid({ type: 'Feature', geometry: resolved.geometry, properties: {} }).geometry
				.coordinates;
		const properties = {
			center: turf.point(centerCoordinates),
			color: item.color ?? resolved.defaults.color ?? scene.defaults?.fill ?? null,
			icons: item.icons.length ? item.icons : (resolved.defaults.icons ?? []),
			id: item.id,
			name: item.name
		};
		const feature: Feature<MapGeometry, typeof properties> = {
			type: 'Feature',
			geometry: resolved.geometry,
			properties
		};
		return [{ feature, properties } satisfies PlayableMapRegion];
	});
	if (!regions.length) return null;

	return {
		artwork: scene.artwork,
		defaults: scene.defaults,
		geojson: {
			type: 'FeatureCollection',
			features: regions.map((region) => region.feature)
		},
		minTargetDiameter: categoryMap.minTargetDiameter ?? 24,
		projection: scene.projection,
		regions,
		showLabels: categoryMap.showLabels ?? false,
		viewBox: scene.viewBox
	};
}

function prepareScene(
	asset: TaxonomyMapAssetV1,
	sceneId: string,
	scene: TaxonomyMapSceneV1
): PreparedScene {
	let scenes = preparedScenes.get(asset);
	if (!scenes) {
		scenes = new Map();
		preparedScenes.set(asset, scenes);
	}
	const cached = scenes.get(sceneId);
	if (cached) return cached;
	const collection = Object.values(scene.topology.objects)[0];
	if (!collection) throw new Error(`Map scene "${sceneId}" has no region collection`);
	const decoded = topojsonClient.feature(
		scene.topology as never,
		collection as never
	) as unknown as FeatureCollection<MapGeometry, RegionDefaults>;
	const geometryById = new Map<string, MapGeometry>();
	const defaultsById = new Map<string, RegionDefaults>();
	for (const [index, feature] of decoded.features.entries()) {
		const source = collection.geometries[index];
		const id = source?.id === undefined ? '' : String(source.id);
		if (!id || geometryById.has(id)) throw new Error(`Invalid or duplicate map region ID "${id}"`);
		if (!isMapGeometry(feature.geometry))
			throw new Error(`Unsupported geometry for map region "${id}"`);
		geometryById.set(id, feature.geometry);
		defaultsById.set(id, source.properties ?? {});
	}
	const prepared = { geometryById, defaultsById };
	scenes.set(sceneId, prepared);
	return prepared;
}

function resolveGeometry(item: MapItem, scene: PreparedScene, usedReferences: Set<string>) {
	if ('geometry' in item.shape) {
		return isMapGeometry(item.shape.geometry)
			? { geometry: item.shape.geometry, defaults: {} }
			: null;
	}
	if (usedReferences.has(item.shape.ref)) return null;
	const geometry = scene.geometryById.get(item.shape.ref);
	if (!geometry) return null;
	usedReferences.add(item.shape.ref);
	return { geometry, defaults: scene.defaultsById.get(item.shape.ref) ?? {} };
}

function isCategoryMapV2(value: unknown): value is CategoryMapV2 {
	if (!value || typeof value !== 'object') return false;
	const map = value as Partial<CategoryMapV2>;
	return (
		map.version === 2 &&
		typeof map.scene === 'string' &&
		!!map.source &&
		typeof map.source.collection === 'string' &&
		typeof map.source.filename === 'string'
	);
}

function isScene(value: unknown): value is TaxonomyMapSceneV1 {
	if (!value || typeof value !== 'object') return false;
	const scene = value as Partial<TaxonomyMapSceneV1>;
	return (
		(scene.projection === 'identity' || scene.projection === 'naturalEarth') &&
		!!scene.topology &&
		scene.topology.type === 'Topology' &&
		(scene.projection !== 'identity' || isViewBox(scene.viewBox))
	);
}

function isViewBox(value: unknown): value is [number, number, number, number] {
	return (
		Array.isArray(value) &&
		value.length === 4 &&
		value.every((entry) => typeof entry === 'number' && Number.isFinite(entry)) &&
		value[2] > 0 &&
		value[3] > 0
	);
}

function isMapGeometry(value: unknown): value is MapGeometry {
	if (!value || typeof value !== 'object') return false;
	const geometry = value as Partial<MapGeometry>;
	return (
		(geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') &&
		Array.isArray(geometry.coordinates)
	);
}
