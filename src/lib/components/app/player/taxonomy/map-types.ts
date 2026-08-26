import type { Feature, FeatureCollection, Geometry, Point } from 'geojson';

export type GuessResult = 'correct' | 'wrong' | 'already_guessed';
export type ShapeArcs = number[][] | number[][][];

export type MapItem = {
	color: string | null;
	id: string;
	name: string;
	shape: ShapeArcs;
	center: [number, number] | null;
};

export type CategoryMap = {
	object?: string;
	topology?: Topology;
	type?: string;
};

export interface ItemProperties {
	center: Feature<Point> | null;
	color: string | null;
	helper: boolean;
	id: string;
	isIsland: boolean;
	name: string;
	neighbors: string[];
	squareKm: number;
}

export interface TopoGeometry {
	arcs?: ShapeArcs;
	id?: string;
	properties: ItemProperties;
	type: string;
}

export interface Topology {
	arcs: unknown[];
	bbox?: number[];
	objects: Record<string, { geometries: TopoGeometry[]; type: string }>;
	transform?: unknown;
	type: 'Topology';
}

export type ItemFeature = Feature<Geometry, ItemProperties>;
export type ItemFeatureCollection = FeatureCollection<Geometry, ItemProperties>;

export type LoadedPlayableMap = {
	geojson: ItemFeatureCollection;
	geometries: TopoGeometry[];
	topojson: Topology;
};
