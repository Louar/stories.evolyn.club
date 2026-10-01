# GameBus Taxonomy YAML — LLM Generation Guide

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

`map` is a geographic TopoJSON visualization definition. It is not a value-to-label lookup and does
not define item names. See **Category maps** below.

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

`Category.map` supplies the shared TopoJSON arcs and rendering options for geographic or diagrammatic
map rounds. Individual item geometry and presentation are supplied by attributes with hard-coded
slugs.

The import schema accepts any object, but a playable map requires:

```yaml
map:
  type: topojson
  projection: naturalEarth
  showLabels: false
  topology:
    type: Topology
    arcs: []
    objects:
      items:
        type: GeometryCollection
        geometries: []
```

### Effective map properties

| Property     | Required for playback | Allowed/expected value                   | Default         |
| ------------ | --------------------- | ---------------------------------------- | --------------- |
| `type`       | yes                   | literal `topojson`                       | no playable map |
| `projection` | no                    | `identity` or `naturalEarth`             | `naturalEarth`  |
| `showLabels` | no                    | boolean                                  | `false`         |
| `topology`   | yes                   | TopoJSON `Topology` object               | no playable map |
| `object`     | no                    | string, but currently ignored at runtime | none            |

The topology must have `type: Topology`, an `arcs` array, and an `objects` map. The runtime always
creates or replaces `topology.objects.items`; it does not use `map.object`. Keep an empty `items`
geometry collection in generated topology for clarity.

Use `naturalEarth` for longitude/latitude world data. Use `identity` for already planar coordinates
such as a custom diagram.

### Specialized map attributes

The runtime looks up these exact attribute slugs across the taxonomy:

| Attribute slug | Required | Expected item `value`               | Missing/invalid behavior       |
| -------------- | -------- | ----------------------------------- | ------------------------------ |
| `shape`        | yes      | non-empty TopoJSON arc indexes      | item is absent from the map    |
| `center`       | no       | exactly two finite numbers `[x, y]` | geometric center is calculated |
| `color`        | no       | string                              | no item color                  |
| `icons`        | no       | array containing only strings       | empty icon list                |

Declare these as `custom` attributes and connect them to the mapped category. The runtime identifies
them by slug, not by their portable IDs or display names.

`shape` is an arc-index array:

```yaml
# Polygon using topology arc 0
value: [[0]]
```

```yaml
# MultiPolygon containing two polygons
value:
  - [[0]]
  - [[1]]
```

Geometry type is inferred from this nesting. The arc coordinates themselves live in
`category.map.topology.arcs`.

### Map selection for game attributes

- For a `translatable_category` game attribute, the item's own category supplies the map and the
  item's own ID selects its geometry.
- For an `item_reference` game attribute, `referencedCategoryId` supplies the map and the item's
  `referencedItemId` selects the geometry.
- If the selected category has no playable map, the specialized values are unusable, the target has
  no geometry, or the item has no derived name, no map round is produced. There is no automatic
  text-only fallback for these attribute types.

---

## 11. Complete minimal mapped taxonomy

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
      type: topojson
      projection: identity
      showLabels: true
      topology:
        type: Topology
        arcs:
          - [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
        objects:
          items:
            type: GeometryCollection
            geometries: []
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
  - id: region-shape
    slug: shape
    name: { en: Shape }
    image: null
    description: null
    question: null
    type: custom
    referencedCategoryId: null
    schema: null
  - id: region-center
    slug: center
    name: { en: Center }
    image: null
    description: null
    question: null
    type: custom
    referencedCategoryId: null
    schema: null
  - id: region-color
    slug: color
    name: { en: Color }
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
    attributeId: region-shape
    order: 2
    isRequired: true
    isDefault: false
  - categoryId: regions
    attributeId: region-center
    order: 3
    isRequired: false
    isDefault: false
  - categoryId: regions
    attributeId: region-color
    order: 4
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
    attributeId: region-shape
    value: [[0]]
    referencedItemId: null
    difficulty: null
  - itemId: square-region
    attributeId: region-center
    value: [5, 5]
    referencedItemId: null
    difficulty: null
  - itemId: square-region
    attributeId: region-color
    value: '#4f46e5'
    referencedItemId: null
    difficulty: null
```

This is a complete import-valid taxonomy and demonstrates the actual map relationship. A story game
must request one item per round for this one-item dataset.

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
11. Every map item has a valid `shape` whose arc indexes exist in the topology.
12. Every category/attribute game combination has enough eligible items for the story's requested
    `nrOfItemsPerRound`.

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
- leaving dangling category, attribute, item, or reference IDs;
- putting an item-reference target in the wrong category;
- setting `referencedItemId` on a non-reference attribute;
- assuming attribute `type` validates item `value`;
- selecting `integer`, `translatable`, or `custom` as an independent game target;
- treating `Category.map` as a label/value mapping;
- storing item geometry directly in `map.topology.objects` instead of `shape` item values;
- using specialized map slugs other than exactly `shape`, `center`, `color`, and `icons`;
- relying on `map.object`, which the current player ignores;
- expecting a map round without a valid TopoJSON map, shapes, and derived item names;
- JSON-encoding native YAML values unnecessarily.

---

## 15. LLM output requirements

When asked to create a taxonomy:

1. Output one valid YAML mapping.
2. Include all required top-level properties and arrays.
3. Use unique, descriptive portable IDs and attribute slugs.
4. Define categories, attributes, and items separately, then connect them with relation arrays.
5. Make every reference resolve within the file, except external media filenames.
6. Define every usable item's name through ordered `isDefault` category attributes.
7. Match item values and references to their attribute types.
8. For maps, provide valid TopoJSON plus correctly slugged specialized item attributes.
9. Ensure game-target attributes have enough named, eligible items.
10. Do not add unknown properties or comments unless requested.
11. Unless specifically requested otherwise, return pure YAML without explanatory prose.
