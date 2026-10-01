import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as topojsonClient from 'topojson-client';
import YAML from 'yaml';

// Migration input is intentionally schemaless legacy YAML.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonObject = Record<string, any>;

const root = process.cwd();
const outputDirectory = join(root, 'static/taxonomy-maps');
const fixtures = [
	'src/lib/demos/taxonomies/countries-and-foods.yaml',
	'src/lib/demos/taxonomies/foods-and-wheel-of-five.yaml'
];

await mkdir(outputDirectory, { recursive: true });
for (const fixture of fixtures) await migrateFixture(join(root, fixture));

async function migrateFixture(filename: string) {
	const taxonomy = YAML.parse(await readFile(filename, 'utf8')) as JsonObject;
	const legacyCategories = taxonomy.categories.filter(
		(entry: JsonObject) => entry.map && entry.map.version !== 2
	);
	if (!legacyCategories.length) {
		console.log(`Skipped already migrated ${filename}`);
		return;
	}
	const attributes = new Map(
		taxonomy.attributes.map((attribute: JsonObject) => [attribute.slug, attribute])
	);
	ensureMapAttributes(taxonomy, attributes);
	const valueByItemAndAttribute = new Map(
		taxonomy.attributeOfItems.map((value: JsonObject) => [
			`${value.itemId}\0${value.attributeId}`,
			value
		])
	);
	const nameAttribute = attributes.get('name')!;
	const shapeAttribute = attributes.get('shape')!;
	const centerAttribute = attributes.get('center')!;
	const colorAttribute = attributes.get('color')!;
	const iconsAttribute = attributes.get('icons')!;
	const scenes: Record<string, JsonObject> = {};

	for (const category of legacyCategories) {
		const legacyMap = category.map;
		const sceneId = sceneName(category.name?.en ?? category.id);
		const itemIds = taxonomy.itemOfCategories
			.filter((entry: JsonObject) => entry.categoryId === category.id)
			.map((entry: JsonObject) => entry.itemId);
		const geometries: JsonObject[] = [];
		for (const itemId of itemIds) {
			const shapeValue = valueByItemAndAttribute.get(`${itemId}\0${shapeAttribute.id}`);
			if (!shapeValue || !Array.isArray(shapeValue.value) || !shapeValue.value.length) continue;
			const nameValue = valueByItemAndAttribute.get(`${itemId}\0${nameAttribute.id}`)?.value;
			const stableId = `${sceneId}.${slugify(nameValue?.en ?? nameValue?.default ?? itemId)}`;
			geometries.push({
				id: stableId,
				type: Array.isArray(shapeValue.value[0]?.[0]) ? 'MultiPolygon' : 'Polygon',
				arcs: shapeValue.value
			});
			shapeValue.value = { ref: stableId };
		}

		const topology = {
			...legacyMap.topology,
			objects: { regions: { type: 'GeometryCollection', geometries } }
		};
		const scene: JsonObject = { projection: legacyMap.projection ?? 'naturalEarth', topology };
		if (scene.projection === 'identity') scene.viewBox = calculateViewBox(topology);
		scenes[sceneId] = scene;
		category.map = {
			version: 2,
			source: { collection: 'externals', filename: '' },
			scene: sceneId,
			showLabels: legacyMap.showLabels ?? false,
			minTargetDiameter: 24
		};
		for (const attribute of [shapeAttribute, centerAttribute, colorAttribute, iconsAttribute]) {
			const link = taxonomy.attributeOfCategories.find(
				(entry: JsonObject) =>
					entry.categoryId === category.id && entry.attributeId === attribute.id
			);
			if (link) link.isRequired = attribute === shapeAttribute;
			else {
				taxonomy.attributeOfCategories.push({
					categoryId: category.id,
					attributeId: attribute.id,
					order: taxonomy.attributeOfCategories.filter(
						(entry: JsonObject) => entry.categoryId === category.id
					).length,
					isRequired: attribute === shapeAttribute,
					isDefault: false
				});
			}
		}
	}

	const asset = { version: 1, scenes };
	const serializedAsset = `${JSON.stringify(asset)}\n`;
	const hash = createHash('sha256').update(serializedAsset).digest('hex').slice(0, 8);
	const assetFilename = `${taxonomy.slug}.${hash}.json`;
	for (const category of taxonomy.categories.filter(
		(entry: JsonObject) => entry.map?.version === 2
	)) {
		category.map.source.filename = `/taxonomy-maps/${assetFilename}`;
	}
	await writeFile(join(outputDirectory, assetFilename), serializedAsset);
	await writeFile(filename, YAML.stringify(taxonomy, { lineWidth: 0 }));
	console.log(`Migrated ${filename} -> ${assetFilename}`);
}

function ensureMapAttributes(taxonomy: JsonObject, attributes: Map<string, JsonObject>) {
	const definitions: Record<string, JsonObject> = {
		shape: {
			oneOf: [
				{
					type: 'object',
					required: ['ref'],
					properties: { ref: { type: 'string', minLength: 1 } },
					additionalProperties: false
				},
				{
					type: 'object',
					required: ['geometry'],
					properties: {
						geometry: {
							type: 'object',
							required: ['type', 'coordinates'],
							properties: {
								type: { enum: ['Polygon', 'MultiPolygon'] },
								coordinates: { type: 'array', minItems: 1 }
							},
							additionalProperties: false
						}
					},
					additionalProperties: false
				}
			]
		},
		center: {
			type: 'array',
			prefixItems: [{ type: 'number' }, { type: 'number' }],
			minItems: 2,
			maxItems: 2
		},
		color: { type: 'string', minLength: 1, maxLength: 128 },
		icons: { type: 'array', items: { type: 'string', maxLength: 32 }, maxItems: 12 }
	};
	for (const [slug, schema] of Object.entries(definitions)) {
		let attribute = attributes.get(slug);
		if (!attribute) {
			attribute = {
				id: nextAttributeId(taxonomy.attributes),
				slug,
				name: { en: slug[0].toUpperCase() + slug.slice(1) },
				image: null,
				description: { en: `Map ${slug}` },
				type: 'custom',
				referencedCategoryId: null,
				schema
			};
			taxonomy.attributes.push(attribute);
			attributes.set(slug, attribute);
		}
		attribute.type = 'custom';
		attribute.schema = schema;
	}
}

function calculateViewBox(topology: JsonObject): [number, number, number, number] {
	const collection = topology.objects.regions;
	const features = topojsonClient.feature(topology as never, collection as never) as unknown;
	const coordinates: number[][] = [];
	visitCoordinates(features, coordinates);
	const xs = coordinates.map((point) => point[0]);
	const ys = coordinates.map((point) => point[1]);
	const minX = Math.min(...xs);
	const maxX = Math.max(...xs);
	const minY = Math.min(...ys);
	const maxY = Math.max(...ys);
	return [minX, minY, maxX - minX, maxY - minY];
}

function visitCoordinates(value: unknown, output: number[][]) {
	if (Array.isArray(value)) {
		if (value.length >= 2 && value.every((entry) => typeof entry === 'number')) output.push(value);
		else for (const entry of value) visitCoordinates(entry, output);
	} else if (value && typeof value === 'object') {
		for (const entry of Object.values(value)) visitCoordinates(entry, output);
	}
}

function nextAttributeId(attributes: JsonObject[]) {
	const number =
		Math.max(...attributes.map((attribute) => Number(attribute.id.split('-').at(-1)) || 0)) + 1;
	return `attribute-${number}`;
}

function sceneName(name: string) {
	if (name === 'Schijf van Vijf') return 'wheel-of-five';
	return slugify(name);
}

function slugify(value: string) {
	return value
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}
