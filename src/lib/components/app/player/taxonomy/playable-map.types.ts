import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from 'geojson';

export type GuessResult = 'correct' | 'wrong' | 'already_guessed';
export type MapGeometry = Polygon | MultiPolygon;

export type MediaReference = {
	collection: 'externals' | 'internals' | 'clients' | 'users';
	filename: string;
};

export type MapShapeValue = { ref: string } | { geometry: MapGeometry };

export type MapItem = {
	center: [number, number] | null;
	color: string | null;
	icons: string[];
	id: string;
	name: string;
	shape: MapShapeValue;
};

export type CategoryMapV2 = {
	version: 2;
	source: MediaReference;
	scene: string;
	showLabels?: boolean;
	minTargetDiameter?: number;
};

export type RegionDefaults = {
	center?: [number, number];
	color?: string;
	icons?: string[];
};

export interface TopologyGeometry {
	arcs?: number[][] | number[][][];
	coordinates?: unknown;
	id?: string | number;
	properties?: RegionDefaults;
	type: string;
}

export interface Topology {
	arcs: unknown[];
	bbox?: number[];
	objects: Record<string, { geometries: TopologyGeometry[]; type: 'GeometryCollection' }>;
	transform?: unknown;
	type: 'Topology';
}

export type MapArtwork = {
	underlay?: MediaReference;
	overlay?: MediaReference;
};

export type MapSceneDefaults = {
	labelColor?: string;
	fill?: string;
	stroke?: string;
	strokeWidth?: number;
	fillOpacity?: number;
	feedbackOpacity?: number;
};

export type TaxonomyMapSceneV1 = {
	projection: 'identity' | 'naturalEarth';
	viewBox?: [number, number, number, number];
	topology: Topology;
	artwork?: MapArtwork;
	defaults?: MapSceneDefaults;
};

export type TaxonomyMapAssetV1 = {
	version: 1;
	scenes: Record<string, TaxonomyMapSceneV1>;
};

export interface MapAssetLoader {
	load(reference: MediaReference): Promise<TaxonomyMapAssetV1>;
}

export type ItemProperties = {
	center: Feature<Point>;
	color: string | null;
	icons: string[];
	id: string;
	name: string;
};

export type PlayableMapRegion = {
	feature: Feature<MapGeometry, ItemProperties>;
	properties: ItemProperties;
};

export type LoadedPlayableMap = {
	artwork?: MapArtwork;
	defaults?: MapSceneDefaults;
	geojson: FeatureCollection<MapGeometry, ItemProperties>;
	minTargetDiameter: number;
	projection: 'identity' | 'naturalEarth';
	regions: PlayableMapRegion[];
	showLabels: boolean;
	viewBox?: [number, number, number, number];
};
