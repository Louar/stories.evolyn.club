# GameBus Taxonomy YAML — LLM Generation Guide

> Map sections in this guide describe the generic map v2 contract: compact category map references, reusable map assets, and per-item `shape`/`center`/`color`/`icons` attributes.

Generate one complete YAML document for the GameBus taxonomy import endpoint.

Taxonomies are normalized graphs: categories, attributes, and items are separate arrays connected by
relation arrays. Use the implementation-supported structures below and make every reference resolve.

Unless requested otherwise, return pure YAML without Markdown fences or explanatory prose.

---

## 1. Minimal valid taxonomy

```yaml
slug: minimal-taxonomy
name: null
description: null
categories: []
attributes: []
attributeOfCategories: []
items: []
itemOfCategories: []
attributeOfItems: []
```

This is import-valid but contains no playable taxonomy content.

---

## 2. Top-level structure

```yaml
id: optional-portable-id
slug: required-slug
name: { en: Optional taxonomy name }
description: null
categories: []
attributes: []
attributeOfCategories: []
items: []
itemOfCategories: []
attributeOfItems: []
```

| Property                | Required | Type                        |
| ----------------------- | -------- | --------------------------- |
| `id`                    | no       | non-empty string            |
| `slug`                  | yes      | trimmed non-empty string    |
| `name`                  | yes      | translatable string or null |
| `description`           | yes      | translatable string or null |
| `categories`            | yes      | category array              |
| `attributes`            | yes      | attribute array             |
| `attributeOfCategories` | yes      | category-attribute links    |
| `items`                 | yes      | item array                  |
| `itemOfCategories`      | yes      | item-category links         |
| `attributeOfItems`      | yes      | item value/reference links  |

All six arrays are required, even when empty.

`slug` is unique per client in the database. On import, a collision is renamed by appending a short
UUID suffix. Generate a stable, descriptive slug anyway.

The top-level `id` is ignored on import. Category, attribute, and item IDs are portable arbitrary
non-empty strings, not database UUIDs. The importer creates new UUIDs and rewrites references.

---

## 3. Translatable and media values

A translatable string is a map whose keys may be:

```text
default en bg ca da de es fi fr it nl no pt sv
```

It must contain at least `default` or `en`. Every supplied value is trimmed and must be non-empty.

```yaml
name:
  en: Countries
  nl: Landen
```

Runtime localization normally uses the requested language, then `default`, then `en`.

A media object is:

```yaml
collection: clients
filename: taxonomy/countries.png
```

Allowed `collection` values:

```text
externals
internals
clients
users
```

`filename` is a trimmed non-empty string.

The importer also attempts to JSON-parse string values used for translations, media, maps, schemas,
and item values. For generated YAML, prefer native YAML objects, arrays, numbers, and strings rather
than JSON encoded inside strings.

---

## 4. Categories

```yaml
categories:
  - id: countries
    name:
      en: Countries
    image: null
    description:
      en: Countries available in this taxonomy
    map: null
```

| Property      | Required | Type                        | Default |
| ------------- | -------- | --------------------------- | ------- |
| `id`          | yes      | non-empty portable ID       | none    |
| `name`        | yes      | translatable string         | none    |
| `image`       | yes      | media object or `null`      | none    |
| `description` | yes      | translatable string or null | none    |
| `map`         | no       | object or `null`            | `null`  |

Categories do not contain nested attributes or items. Connect them using
`attributeOfCategories` and `itemOfCategories`.

`map` selects a reusable geographic or diagrammatic map scene. It is not a value-to-label lookup and
does not define item names. Heavy geometry and decorative artwork live in the referenced map asset;
item-specific map bindings and overrides remain ordinary taxonomy attributes. See **Category maps**
below.

---

## 5. Attributes

```yaml
attributes:
  - id: country-name
    slug: name
    name:
      en: Name
    image: null
    description: null
    question:
      en: Where is this country?
    type: translatable_category
    referencedCategoryId: null
    schema: null
```

| Property               | Required | Type                        | Default |
| ---------------------- | -------- | --------------------------- | ------- |
| `id`                   | yes      | non-empty portable ID       | none    |
| `slug`                 | yes      | trimmed non-empty string    | none    |
| `name`                 | yes      | translatable string         | none    |
| `image`                | yes      | media object or `null`      | none    |
| `description`          | yes      | translatable string or null | none    |
| `question`             | no       | translatable string or null | `null`  |
| `type`                 | yes      | supported attribute type    | none    |
| `referencedCategoryId` | yes      | category ID or `null`       | none    |
| `schema`               | no       | object or `null`            | `null`  |

Allowed `type` values:

```text
integer
number
translatable
translatable_category
item_reference
custom
```

| Type                    | Intended item data                                                |
| ----------------------- | ----------------------------------------------------------------- |
| `integer`               | integer value                                                     |
| `number`                | numeric value; supported as a game target                         |
| `translatable`          | translatable object                                               |
| `translatable_category` | translatable object; supported as a direct category-map target    |
| `item_reference`        | `referencedItemId`; supported as a referenced-category map target |
| `custom`                | other JSON/YAML value                                             |

The importer does not validate an item value against its attribute `type` or `schema`. Generate the
intended value shape yourself.

Only `number`, `translatable_category`, and `item_reference` are selected as taxonomy game target
attributes. The other types remain valid for storage, display-name components, and specialized map
metadata.

`question` is displayed as a localized literal string; it does not substitute placeholders. If it
is `null`, the player generates a type-specific prompt from the localized attribute name.

For `item_reference`, set `referencedCategoryId` to the category containing valid target items. For
all other types, normally use `null`. Although bundle import only checks that a referenced item
exists somewhere in the taxonomy, generated references should target an item in this category.

For numeric slider games, `schema` has these implemented properties:

```yaml
schema:
  minimum: 0
  maximum: 100
  multipleOf: 5
```

`minimum` and `maximum` are numbers. `multipleOf` must be positive. Other schema properties have no
defined game behavior. A numeric attribute becomes a slider only when the story requests exactly one
item per round; with multiple items it becomes a sortable ordering round.

---

## 6. Category-attribute relationships

```yaml
attributeOfCategories:
  - categoryId: countries
    attributeId: country-name
    order: 1
    isRequired: true
    isDefault: true
```

| Property      | Required | Type                  |
| ------------- | -------- | --------------------- |
| `categoryId`  | yes      | existing category ID  |
| `attributeId` | yes      | existing attribute ID |
| `order`       | yes      | integer or `null`     |
| `isRequired`  | yes      | boolean               |
| `isDefault`   | yes      | boolean               |

`order` controls attribute ordering and the order of components in derived item names. Null orders
sort last.

`isRequired` is stored and shown by the editor, but import and game loading do not enforce that every
item has a value. Generate values for required attributes anyway.

`isDefault` marks an attribute as a component of the item's derived display name. Multiple default
attributes are allowed and are concatenated in `order` order.

---

## 7. Items and category membership

Items have only an ID. They have no intrinsic name, image, or description.

```yaml
items:
  - id: netherlands

itemOfCategories:
  - itemId: netherlands
    categoryId: countries
```

Every item intended for use must belong to at least one category. Each membership requires an
existing item and category ID.

---

## 8. Item attribute values and references

```yaml
attributeOfItems:
  - itemId: netherlands
    attributeId: country-name
    value:
      en: Netherlands
      nl: Nederland
    referencedItemId: null
    difficulty: null
```

| Property           | Required | Type                       | Default |
| ------------------ | -------- | -------------------------- | ------- |
| `itemId`           | yes      | existing item ID           | none    |
| `attributeId`      | yes      | existing attribute ID      | none    |
| `value`            | no       | any YAML value or `null`   | `null`  |
| `referencedItemId` | yes      | existing item ID or `null` | none    |
| `difficulty`       | yes      | integer or `null`          | none    |

Use `value` for numeric, translated, and custom attributes. For `item_reference`, normally set
`value: null` and put the target item ID in `referencedItemId`:

```yaml
- itemId: apple
  attributeId: country-of-origin
  value: null
  referencedItemId: netherlands
  difficulty: 1
```

Use `referencedItemId: null` for non-reference attributes. `difficulty` can restrict game items when
a story selects a maximum difficulty. With a non-null story difficulty, only rows having a non-null
item difficulty less than or equal to it are eligible; `difficulty: null` rows are excluded. With a
null story difficulty, item difficulty does not filter eligibility.

---

## 9. Defining the default item name

There is no item `name` property and no category `defaultItemName` property. Define item names by:

1. linking one or more naming attributes to the category;
2. setting `isDefault: true` on those `attributeOfCategories` rows;
3. assigning each item a translatable `value` for those attributes.

Example with two name components:

```yaml
attributeOfCategories:
  - categoryId: foods
    attributeId: food-name
    order: 1
    isRequired: true
    isDefault: true
  - categoryId: foods
    attributeId: food-symbol
    order: 2
    isRequired: false
    isDefault: true

attributeOfItems:
  - itemId: apple
    attributeId: food-name
    value: { en: Apple, nl: Appel }
    referencedItemId: null
    difficulty: null
  - itemId: apple
    attributeId: food-symbol
    value: { en: fruit, nl: fruit }
    referencedItemId: null
    difficulty: null
```

The English derived name is `Apple fruit`.

For each name component, localization selects the requested language, then `default`, then `en`.
Components without a localized value are omitted. If no default attribute produces a localized
string, the derived name is `null` and the runtime taxonomy game excludes the item. A referenced-item
editor may show the item UUID as a UI fallback, but the game has no generated-name fallback.

Category `map` and the specialized `shape`, `center`, `color`, and `icons` attributes do not override
this naming process. Map items use the same derived default name.

---

## 10. Category maps

A category map is a generic interactive spatial visualization. It may represent countries, a wheel,
a seasonal diagram, an anatomical illustration, a floor plan, or another planar/geographic scene.
The renderer must not depend on the map's subject matter.

The taxonomy stores two different kinds of map data:

1. **Shared scene data** lives in a reusable external map asset: reusable region geometry, projection,
   coordinate system, and optional noninteractive decorative artwork.
2. **Item-specific map data** remains in `AttributeOfItem.value`, using the standardized `shape`,
   `center`, `color`, and `icons` attributes.

This distinction keeps `Category.map` small while preserving dynamic item creation through the normal
taxonomy graph.

### 10.1 Category map configuration

A playable mapped category uses this compact structure:

```yaml
map:
  version: 2
  source:
    collection: clients
    filename: taxonomy-maps/example-map.3f71c8.json
  scene: regions
  showLabels: true
  minTargetDiameter: 24
```

| Property            | Required | Type                         | Meaning |
| ------------------- | -------- | ---------------------------- | ------- |
| `version`           | yes      | literal `2`                  | Category-map configuration version |
| `source`            | yes      | media object                 | Reusable map-asset JSON |
| `scene`             | yes      | non-empty string             | Scene inside the referenced asset |
| `showLabels`        | no       | boolean                      | Show item labels; default `false` |
| `minTargetDiameter` | no       | finite nonnegative number    | Minimum rendered hit-target diameter in CSS pixels; default `24` |

`source` uses the normal media-reference shape:

```yaml
source:
  collection: internals
  filename: taxonomy-maps/world-countries.8c28ad.json
```

A map asset is a separate versioned artifact. It may contain multiple reusable scenes, for example
`wheel-of-five` and `seasons`, or `animals` and `cuts`. The taxonomy selects exactly one scene.

Do not embed large TopoJSON arc arrays, decorative SVG paths, or raster artwork directly in
`Category.map`. If a new scene or artwork asset is required, create/import that map asset separately
and then reference it from the taxonomy.

### 10.2 Shared map attributes

The runtime recognizes these exact attribute slugs across the taxonomy:

| Attribute slug | Required for a drawable item | Expected item `value` | Missing behavior |
| -------------- | ---------------------------- | --------------------- | ---------------- |
| `shape`        | yes                          | region reference or inline Polygon/MultiPolygon | item is absent from the map |
| `center`       | no                           | exactly two finite numbers `[x, y]` | asset center or geometric centroid is used |
| `color`        | no                           | string | asset/scene/renderer default is used |
| `icons`        | no                           | array containing only strings | asset default or empty array is used |

Declare these once as `custom` attributes within the taxonomy and connect the same attributes to
every mapped category that needs them. Attribute slugs are taxonomy-wide and must remain unique.
Do not create category-specific copies such as `country-shape`, `season-shape`, or `animal-shape`.

These attributes remain ordinary taxonomy data deliberately: `Item` itself has no map fields, so
`AttributeOfItem.value` is what allows mapped items to be added dynamically without changing the
database model or renderer.

### 10.3 `shape` values

`shape` no longer stores raw TopoJSON arc indexes. It supports two forms.

#### Reusable region reference

Use this whenever the selected scene already contains the desired region:

```yaml
value:
  ref: country.NLD
```

Examples of useful stable region IDs:

```text
country.NLD
wheel.vegetables-fruit
season.winter
beef.brisket
```

The referenced ID must exist in the category's selected scene. Region IDs are stable public
identifiers; TopoJSON arc indexes are private implementation details of the map asset.

#### Inline custom geometry

Use inline GeoJSON only when a genuinely new item geometry does not exist in the reusable scene:

```yaml
value:
  geometry:
    type: Polygon
    coordinates:
      -
        - [100, 100]
        - [220, 100]
        - [220, 220]
        - [100, 220]
        - [100, 100]
```

Supported inline geometry types are `Polygon` and `MultiPolygon`.

For an `identity` scene, inline geometry and explicit `center` values use the scene's design
coordinate system. For a `naturalEarth` scene, geometry uses ordinary longitude/latitude coordinates.

Use a region reference instead of copying inline geometry when a reusable region exists.

### 10.4 Item overrides and precedence

`center`, `color`, and `icons` are optional item-specific overrides. Resolve presentation in this
order:

```text
item AttributeOfItem value
→ map-asset region default
→ scene default
→ renderer default
```

This lets an asset provide sensible defaults while allowing a taxonomy to customize individual
items.

For example:

```yaml
- itemId: winter
  attributeId: map-shape
  value:
    ref: season.winter
  referencedItemId: null
  difficulty: null

- itemId: winter
  attributeId: map-color
  value: '#7fb7d6'
  referencedItemId: null
  difficulty: null

- itemId: winter
  attributeId: map-icons
  value: [❄️, 🧣, ☃️]
  referencedItemId: null
  difficulty: null
```

### 10.5 Decorative artwork

Decorative artwork belongs to the referenced map asset, not to taxonomy items. Examples include:

- Wheel of Five rings, textures, separators, shadows, and food motifs;
- seasonal flowers, leaves, snow, sun, and decorative rings;
- country-map ocean backgrounds, graticules, and map frames;
- heads, hooves, horns, feathers, muscle contours, and cut lines in an anatomical diagram.

Artwork is noninteractive and has no taxonomy item ID, scoring behavior, tab stop, or answer state.
Do not create pseudo-items merely to complete an illustration.

A region that should be a legitimate clickable distractor is different: keep it as a taxonomy item
with a real `shape`.

Do not bake translated answer labels into decorative artwork. `showLabels: false` can hide runtime
labels, but it cannot hide text already embedded in an SVG or image.

### 10.6 Dynamic mapped items

Adding a mapped item uses the normal taxonomy graph.

When a reusable region already exists:

```yaml
items:
  - id: netherlands

itemOfCategories:
  - itemId: netherlands
    categoryId: countries

attributeOfItems:
  - itemId: netherlands
    attributeId: country-name
    value: { en: Netherlands, nl: Nederland }
    referencedItemId: null
    difficulty: null

  - itemId: netherlands
    attributeId: map-shape
    value:
      ref: country.NLD
    referencedItemId: null
    difficulty: null
```

No `Category.map` update is required.

For a genuinely new custom region, use `shape.geometry` instead. The renderer may mix asset-backed
and inline item geometry in one category.

### 10.7 Map selection for game attributes

Map selection remains driven by the taxonomy game attribute:

- For a `translatable_category` game attribute, the item's own category supplies the map and the
  item's own ID selects its mapped item.
- For an `item_reference` game attribute, `referencedCategoryId` supplies the map and the item's
  `referencedItemId` selects the mapped target item.
- The selected mapped item must have a localized derived name and a valid `shape`.
- If the selected category has no playable map, its source/scene cannot be resolved, the selected
  item has no valid geometry, or the item has no derived name, no map round is produced.

The story does not select map scenes or artwork. Those belong to the referenced taxonomy category.

### 10.8 Map assets and portability

A taxonomy YAML may reference map assets that are not embedded in the YAML itself. For an importable
package, include every referenced map-asset JSON file and its artwork media and rewrite media
references during import as needed.

Do not invent a map-asset filename when generating a production-ready taxonomy. Use a known/provided
asset reference, or generate the required map asset as a separate artifact when the task explicitly
includes it.

For detailed map-asset authoring, use the separate **Taxonomy Map Asset Generation Guide** when
available.

---

## 11. Complete minimal mapped taxonomy

This example assumes the referenced map asset already exists and contains scene `regions` with a
stable region ID `region.square`.

```yaml
slug: simple-map
name:
  en: Simple map
description: null
categories:
  - id: regions
    name: { en: Regions }
    image: null
    description: null
    map:
      version: 2
      source:
        collection: clients
        filename: taxonomy-maps/simple-regions.v1.json
      scene: regions
      showLabels: true
      minTargetDiameter: 24
attributes:
  - id: region-name
    slug: name
    name: { en: Name }
    image: null
    description: null
    question: { en: Where is this region? }
    type: translatable_category
    referencedCategoryId: null
    schema: null
  - id: map-shape
    slug: shape
    name: { en: Shape }
    image: null
    description: { en: Map region reference or inline geometry }
    question: null
    type: custom
    referencedCategoryId: null
    schema:
      oneOf:
        - required: [ref]
        - required: [geometry]
  - id: map-center
    slug: center
    name: { en: Center }
    image: null
    description: null
    question: null
    type: custom
    referencedCategoryId: null
    schema: null
  - id: map-color
    slug: color
    name: { en: Color }
    image: null
    description: null
    question: null
    type: custom
    referencedCategoryId: null
    schema: null
  - id: map-icons
    slug: icons
    name: { en: Icons }
    image: null
    description: null
    question: null
    type: custom
    referencedCategoryId: null
    schema: null
attributeOfCategories:
  - categoryId: regions
    attributeId: region-name
    order: 1
    isRequired: true
    isDefault: true
  - categoryId: regions
    attributeId: map-shape
    order: 2
    isRequired: true
    isDefault: false
  - categoryId: regions
    attributeId: map-center
    order: 3
    isRequired: false
    isDefault: false
  - categoryId: regions
    attributeId: map-color
    order: 4
    isRequired: false
    isDefault: false
  - categoryId: regions
    attributeId: map-icons
    order: 5
    isRequired: false
    isDefault: false
items:
  - id: square-region
itemOfCategories:
  - itemId: square-region
    categoryId: regions
attributeOfItems:
  - itemId: square-region
    attributeId: region-name
    value: { en: Square }
    referencedItemId: null
    difficulty: null
  - itemId: square-region
    attributeId: map-shape
    value:
      ref: region.square
    referencedItemId: null
    difficulty: null
  - itemId: square-region
    attributeId: map-color
    value: '#4f46e5'
    referencedItemId: null
    difficulty: null
```

A story game must request one item per round for this one-item dataset.

To make the square completely dynamic instead of using the reusable asset region, replace its
`shape` value with:

```yaml
value:
  geometry:
    type: Polygon
    coordinates:
      -
        - [0, 0]
        - [10, 0]
        - [10, 10]
        - [0, 10]
        - [0, 0]
```

The inline coordinates must use the selected scene's coordinate system.

---

## 12. Complete non-map example

```yaml
slug: simple-foods
name: { en: Simple foods }
description: null
categories:
  - id: foods
    name: { en: Foods }
    image: null
    description: null
    map: null
attributes:
  - id: food-name
    slug: name
    name: { en: Name }
    image: null
    description: null
    question: null
    type: translatable
    referencedCategoryId: null
    schema: null
  - id: food-calories
    slug: calories
    name: { en: Calories }
    image: null
    description: null
    question: { en: Which food has more calories? }
    type: number
    referencedCategoryId: null
    schema: null
attributeOfCategories:
  - categoryId: foods
    attributeId: food-name
    order: 1
    isRequired: true
    isDefault: true
  - categoryId: foods
    attributeId: food-calories
    order: 2
    isRequired: true
    isDefault: false
items:
  - id: apple
  - id: bread
itemOfCategories:
  - itemId: apple
    categoryId: foods
  - itemId: bread
    categoryId: foods
attributeOfItems:
  - itemId: apple
    attributeId: food-name
    value: { en: Apple }
    referencedItemId: null
    difficulty: null
  - itemId: apple
    attributeId: food-calories
    value: 52
    referencedItemId: null
    difficulty: null
  - itemId: bread
    attributeId: food-name
    value: { en: Bread }
    referencedItemId: null
    difficulty: null
  - itemId: bread
    attributeId: food-calories
    value: 265
    referencedItemId: null
    difficulty: null
```

---

## 13. Reference and validity rules

Every generated file should satisfy all of these, including constraints the importer does not fully
preflight:

1. Category, attribute, and item source IDs are non-empty and unique within their arrays.
2. Attribute slugs are non-empty and unique within the taxonomy.
3. Every relation ID resolves to an entity in the same file.
4. Every `referencedCategoryId` resolves to an imported category.
5. Every non-null `referencedItemId` resolves to an imported item.
6. An `item_reference` target belongs to that attribute's `referencedCategoryId`.
7. Non-reference attributes use `referencedItemId: null`.
8. Item values match their attribute's intended type and schema.
9. Every item used by a game has at least one localized default-name value.
10. Every required category attribute has an item value when applicable.
11. `shape`, `center`, `color`, and `icons` each have at most one attribute definition per taxonomy;
    mapped categories reuse those shared attributes.
12. Every mapped category has a valid map configuration whose `source` and `scene` resolve.
13. Every drawable map item has a valid `shape`.
14. Every `shape.ref` exists in the selected map-asset scene.
15. Every inline `shape.geometry` is a valid Polygon/MultiPolygon in the selected scene's coordinate
    system.
16. Item-specific `center`, `color`, and `icons` values satisfy their expected schemas.
17. Every category/attribute game combination has enough named, drawable, eligible items for the
    story's requested `nrOfItemsPerRound`.

---

## 14. Common mistakes

Avoid:

- nesting attributes or items directly inside categories;
- omitting any of the six required relation/entity arrays;
- using a plain string where a translatable map is required;
- omitting both `default` and `en` from a translatable value;
- assigning names directly to item objects;
- forgetting `isDefault: true` on the category attribute that supplies item names;
- assuming `isRequired` is enforced automatically;
- using duplicate portable IDs or attribute slugs;
- defining separate `shape`, `center`, `color`, or `icons` attributes for different mapped categories;
- leaving dangling category, attribute, item, or reference IDs;
- putting an item-reference target in the wrong category;
- setting `referencedItemId` on a non-reference attribute;
- assuming attribute `type` alone validates an item `value`;
- selecting `integer`, `translatable`, or `custom` as an independent game target;
- treating `Category.map` as a label/value mapping;
- embedding large TopoJSON topology or decorative artwork directly in `Category.map`;
- storing raw TopoJSON arc indexes in `shape`;
- inventing a `shape.ref` that does not exist in the selected scene;
- using inline geometry in a different coordinate system from the selected scene;
- creating decorative pseudo-items when the visual belongs in map artwork;
- baking answer labels into decorative artwork when the game may hide labels;
- expecting a map round without a resolvable map source/scene, valid shapes, and derived item names;
- JSON-encoding native YAML values unnecessarily.

---

## 15. LLM output requirements

When asked to create a taxonomy:

1. Output one valid YAML mapping.
2. Include all required top-level properties and arrays.
3. Use unique, descriptive portable IDs and attribute slugs.
4. Define categories, attributes, and items separately, then connect them with relation arrays.
5. Make every taxonomy reference resolve within the file, except external media/map-asset filenames.
6. Define every usable item's name through ordered `isDefault` category attributes.
7. Match item values and references to their attribute types and schemas.
8. For mapped categories, use compact map source/scene configuration.
9. Define `shape`, `center`, `color`, and `icons` once per taxonomy and reuse them across mapped
   categories.
10. Prefer `shape.ref` for reusable map regions; use `shape.geometry` only for genuinely new custom
    regions.
11. Do not invent external map assets for a production-ready import. Use provided/known assets or
    generate the required map asset separately when requested.
12. Ensure game-target attributes have enough named, drawable, eligible items.
13. Keep decorative artwork out of taxonomy items.
14. Do not add unknown properties or comments unless requested.
15. Unless specifically requested otherwise, return pure YAML without explanatory prose.

