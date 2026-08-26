import * as turf from '@turf/turf';
import * as topojsonClient from 'topojson-client';
import type {
	CategoryMap,
	ItemFeatureCollection,
	LoadedPlayableMap,
	MapItem,
	ShapeArcs,
	TopoGeometry,
	Topology
} from './map-types';

const mapObjectKey = 'items';

export function createPlayableMap(
	categoryMap: CategoryMap,
	items: MapItem[]
): LoadedPlayableMap | null {
	if (categoryMap.type !== 'topojson' || !categoryMap.topology) return null;

	const topojson = structuredClone(categoryMap.topology) as Topology;
	const geometries = items.map(toGeometry);
	topojson.objects = {
		...topojson.objects,
		[mapObjectKey]: { type: 'GeometryCollection', geometries }
	};

	const geojson = topojsonClient.feature(
		topojson as never,
		topojson.objects[mapObjectKey] as never
	) as unknown as ItemFeatureCollection;
	const neighbors = topojsonClient.neighbors(geometries as never);

	topojson.objects[mapObjectKey].geometries = geometries.map((geometry, index) => {
		const feature = geojson.features[index];
		const bbox = turf.bbox(feature);
		const xs = Math.abs(bbox[0] - bbox[2]);
		const ys = Math.abs(bbox[1] - bbox[3]);
		const squareKm = Math.floor(turf.area(feature) / 1_000_000);
		const isIsland = neighbors[index].length === 0;
		const center = geometry.properties.center ?? turf.center(feature);

		geometry.properties = {
			...geometry.properties,
			center,
			helper: !isIsland && squareKm < 6000 && xs < 0.7 && ys < 0.7,
			isIsland,
			neighbors: neighbors[index].map(
				(neighborIndex: number) => geojson.features[neighborIndex].properties.name
			),
			squareKm
		};
		return geometry;
	});

	return {
		geojson: topojsonClient.feature(
			topojson as never,
			topojson.objects[mapObjectKey] as never
		) as unknown as ItemFeatureCollection,
		geometries: topojson.objects[mapObjectKey].geometries,
		topojson
	};
}

function toGeometry(item: MapItem): TopoGeometry {
	return {
		id: item.id,
		type: getGeometryType(item.shape),
		arcs: item.shape,
		properties: {
			center: item.center
				? { type: 'Feature', geometry: { type: 'Point', coordinates: item.center }, properties: {} }
				: null,
			color: item.color,
			helper: false,
			id: item.id,
			isIsland: false,
			name: item.name,
			neighbors: [],
			squareKm: 0
		}
	};
}

function getGeometryType(shape: ShapeArcs) {
	return Array.isArray(shape[0]?.[0]) ? 'MultiPolygon' : 'Polygon';
}
