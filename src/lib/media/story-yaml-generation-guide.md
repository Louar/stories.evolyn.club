# GameBus Story YAML — LLM Generation Guide

Generate one complete YAML document for the GameBus story import endpoint.

Use the implementation-supported structures below. Some importer fields are deliberately
permissive; the stricter recommendations in this guide produce stories that the current player can
actually run.

Unless requested otherwise, return pure YAML without Markdown fences or explanatory prose.

---

## 1. Minimal valid story

```yaml
slug: minimal-story
name:
  en: Minimal story
isPublished: false
isPublic: false
videos: []
announcements: []
quizzes: []
parts:
  - id: finish
    isInitial: true
    terminationStrategy: COMPLETE_STORY
    position: { x: 0, y: 0 }
    backgroundType: null
    videoId: null
    defaultNextPartId: null
    foregroundType: null
    announcementTemplateId: null
    quizTemplateId: null
    quizLogicForPartId: null
    quizLogicForPart: null
    taxonomyDraftForPartId: null
```

This file relies on importer defaults for `defaultBackgroundColor`, `thumbnail`, `animations`,
`stills`, `configuration`, and the optional/defaulted part fields.

---

## 2. Top-level structure

```yaml
id: optional-portable-id
slug: required-slug
name: { en: Required name }
defaultBackgroundColor: null
thumbnail: null
isPublished: false
isPublic: false
videos: []
animations: []
stills: []
announcements: []
quizzes: []
parts: []
configuration: null
```

| Property                 | Required | Type                       | Default |
| ------------------------ | -------- | -------------------------- | ------- |
| `id`                     | no       | non-empty string           | none    |
| `slug`                   | yes      | non-empty string           | none    |
| `name`                   | yes      | translatable string        | none    |
| `defaultBackgroundColor` | no       | string or `null`           | `null`  |
| `thumbnail`              | no       | translatable media or null | `null`  |
| `isPublished`            | yes      | boolean                    | none    |
| `isPublic`               | yes      | boolean                    | none    |
| `videos`                 | yes      | video array                | none    |
| `animations`             | no       | animation array            | `[]`    |
| `stills`                 | no       | still array                | `[]`    |
| `announcements`          | yes      | announcement array         | none    |
| `quizzes`                | yes      | quiz array                 | none    |
| `parts`                  | yes      | part array                 | none    |
| `configuration`          | no       | any YAML value or `null`   | `null`  |

`slug` is unique per client in the database. On import, a collision is renamed by appending a short
UUID suffix. Generate a stable, descriptive slug anyway.

Top-level and nested `id` values are portable reference labels. They need not be UUIDs. Imported
records receive new database IDs.

`configuration` is accepted without validation, but currently is not preserved by story export.
Prefer `null` unless a known consumer requires it.

---

## 3. Translatable values

A translatable string is a map whose keys may be:

```text
default en bg ca da de es fi fr it nl no pt sv
```

It must contain at least `default` or `en`. Every supplied value is trimmed and must be non-empty.

```yaml
name:
  default: Trail choices
  nl: Keuzes op het pad
```

Runtime lookup uses the requested language, then `default`, then `en`.

The same language-key rules apply to translatable media:

```yaml
thumbnail:
  default:
    collection: clients
    filename: thumbnails/trail.png
```

---

## 4. Media values

A media value has exactly this useful shape:

```yaml
collection: externals
filename: https://example.com/media.mp4
```

Allowed `collection` values:

```text
externals
internals
clients
users
```

`filename` is a trimmed non-empty string. For `externals`, the runtime uses it directly as a URL.
Other collections resolve through `/api/media/<collection>/<filename>`.

---

## 5. Reusable story assets

Parts refer to assets by their YAML `id`. Use unique non-empty IDs across every array, even where
the importer does not explicitly check uniqueness.

### Videos

```yaml
videos:
  - id: intro-video
    name: Introduction
    source:
      default:
        collection: externals
        filename: https://example.com/intro.mp4
    thumbnail: null
    captions: null
    duration: 30
```

| Property    | Required | Type                       |
| ----------- | -------- | -------------------------- |
| `id`        | no       | non-empty string           |
| `name`      | yes      | non-empty string           |
| `source`    | yes      | translatable media         |
| `thumbnail` | yes      | translatable media or null |
| `captions`  | yes      | any value or `null`        |
| `duration`  | yes      | number, in seconds         |

Generate a positive integer `duration`. The import schema accepts any number, but the editor and
runtime expect a real media duration. Supported external playback sources are YouTube URLs, HLS
`.m3u8` URLs, and browser-playable native video URLs. Captions are stored but are not rendered by
the current player; normally use `null`.

### Stills

```yaml
stills:
  - id: dark-card
    color: '#111827'
    image: null
    style: null
```

| Property | Required | Type                 |
| -------- | -------- | -------------------- |
| `id`     | no       | non-empty string     |
| `color`  | yes      | string or `null`     |
| `image`  | yes      | media object or null |
| `style`  | yes      | string or `null`     |

`image` is not translatable. `color` is used as CSS `background-color`; `style` is used as CSS
classes. The importer does not validate either string as CSS.

### Announcements

```yaml
announcements:
  - id: welcome
    name: Welcome message
    title:
      en: Welcome
    message:
      en: Choose what happens next.
```

| Property  | Required | Type                        | Default |
| --------- | -------- | --------------------------- | ------- |
| `id`      | no       | non-empty string            | none    |
| `name`    | yes      | non-empty string            | none    |
| `title`   | no       | translatable string or null | `null`  |
| `message` | no       | translatable string or null | `null`  |

Announcement title and message are rendered as HTML. Generate trusted content only.

### Animations

```yaml
animations:
  - id: pulse
    name: Pulse background
    texts: null
    configuration:
      version: 1
      composition:
        viewBoxWidth: 1280
        viewBoxHeight: 720
        fps: 30
        durationInFrames: 90
        background: '#111827'
      playback:
        autoplay: false
        loop: false
      layers: []
```

| Property        | Required | Type                            |
| --------------- | -------- | ------------------------------- |
| `id`            | no       | non-empty string                |
| `name`          | yes      | string                          |
| `texts`         | yes      | animation text map or `null`    |
| `configuration` | yes      | valid WebMotionConfig v1 object |

For the full strict animation schema, use `webmotion-generation-guide.md`. Story playback overrides
animation `autoplay` and `loop` to `false` because the story controls progression.

`texts` maps placeholders to translatable values:

```yaml
texts:
  heading:
    en: Ready?
    nl: Klaar?
```

Only `${heading}`-style placeholders in text-layer `props.text` are replaced. Unknown placeholders
remain unchanged.

---

## 6. Quizzes

The current player supports only `answerTemplateSlug: select-single`. Generate at least one question
and at least one answer option per question, even though the import schema permits empty arrays.

```yaml
quizzes:
  - id: choice-quiz
    name: Choose a route
    doRandomize: false
    questions:
      - id: route-question
        order: 1
        answerTemplateSlug: select-single
        title:
          en: Which route is safer?
        instruction: null
        placeholder: null
        configuration: null
        isRequired: true
        answerOptions:
          - id: marked-route
            order: 1
            value: marked
            label:
              en: The marked route
        answerGroup:
          id: route-answers
          doRandomize: false
```

### Quiz properties

| Property      | Required | Type             |
| ------------- | -------- | ---------------- |
| `id`          | no       | non-empty string |
| `name`        | yes      | non-empty string |
| `doRandomize` | yes      | boolean          |
| `questions`   | yes      | question array   |

### Question properties

| Property             | Required | Type                        | Default |
| -------------------- | -------- | --------------------------- | ------- |
| `id`                 | no       | non-empty string            | none    |
| `order`              | yes      | number                      | none    |
| `answerTemplateSlug` | yes      | non-empty string            | none    |
| `title`              | yes      | translatable string         | none    |
| `instruction`        | no       | translatable string or null | `null`  |
| `placeholder`        | no       | translatable string or null | `null`  |
| `configuration`      | no       | any value or `null`         | `null`  |
| `isRequired`         | yes      | boolean                     | none    |
| `answerOptions`      | yes      | answer option array         | none    |
| `answerGroup`        | yes      | answer group                | none    |

`instruction`, `placeholder`, `configuration`, and `isRequired` are stored, but the current public
quiz overlay does not use them to change behavior. `placeholder` is also omitted by story export, so
it is not round-trip safe.

### Answer option and group properties

```yaml
answerOptions:
  - id: answer-a
    order: 1
    value: A
    label:
      en: Answer A
answerGroup:
  id: answer-group
  doRandomize: false
```

Answer option `id` is optional; `order`, string-or-number `value`, and translatable `label` are
required. Answer group `id` is optional and `doRandomize` is required.

---

## 7. Parts and sequencing

Parts form a directed graph. YAML array order is not a reliable playback sequence. Generate exactly
one part with `isInitial: true`, give every part a unique `id`, and connect parts through destination
IDs.

```yaml
parts:
  - id: start
    isInitial: true
    terminationStrategy: NONE
    position: { x: 0, y: 0 }
    backgroundType: still
    backgroundConfiguration: { duration: 3 }
    videoId: null
    animationId: null
    stillId: intro-background
    defaultNextPartId: finish
    foregroundType: announcement
    foregroundConfiguration: null
    announcementTemplateId: welcome
    quizTemplateId: null
    quizLogicForPartId: null
    quizLogicForPart: null
    taxonomyDraftForPartId: null
    taxonomyDraftForPart: null
```

### Common part properties

| Property                  | Required | Type                       | Default |
| ------------------------- | -------- | -------------------------- | ------- |
| `id`                      | no       | non-empty string           | none    |
| `isInitial`               | yes      | boolean                    | none    |
| `terminationStrategy`     | no       | termination value          | `NONE`  |
| `position`                | yes      | `{ x: number, y: number }` | none    |
| `backgroundType`          | yes      | string or `null`           | none    |
| `backgroundConfiguration` | no       | object or `null`           | `null`  |
| `videoId`                 | yes      | non-empty string or `null` | none    |
| `animationId`             | no       | non-empty string or `null` | `null`  |
| `stillId`                 | no       | non-empty string or `null` | `null`  |
| `defaultNextPartId`       | yes      | non-empty string or `null` | none    |
| `foregroundType`          | yes      | string or `null`           | none    |
| `foregroundConfiguration` | no       | object or `null`           | `null`  |
| `announcementTemplateId`  | yes      | non-empty string or `null` | none    |
| `quizTemplateId`          | yes      | non-empty string or `null` | none    |
| `quizLogicForPartId`      | yes      | non-empty string or `null` | none    |
| `quizLogicForPart`        | yes      | quiz logic or `null`       | none    |
| `taxonomyDraftForPartId`  | yes      | non-empty string or `null` | none    |
| `taxonomyDraftForPart`    | no       | taxonomy draft or `null`   | absent  |

The import schema accepts any non-empty background/foreground type string. For a playable story,
use only:

| Role       | Type           | Required matching reference               |
| ---------- | -------------- | ----------------------------------------- |
| background | `video`        | `videoId`                                 |
| background | `animation`    | `animationId`                             |
| background | `still`        | `stillId`                                 |
| foreground | `announcement` | `announcementTemplateId`                  |
| foreground | `quiz`         | `quizTemplateId` and quiz logic           |
| foreground | `taxonomy`     | taxonomy marker and nested taxonomy draft |

Use `null` when a background or foreground is absent. Keep unrelated asset IDs `null`.

`position` controls the editor graph layout, not playback order.

---

## 8. Background and foreground timing

### Video background

```yaml
backgroundType: video
backgroundConfiguration:
  start: 0.25
  end: 0.75
videoId: intro-video
```

`start` and `end` are fractions of the full video duration. Generate values in `[0, 1]` with
`start < end`. The import schema does not enforce these bounds, but the editor does.

### Animation background

```yaml
backgroundType: animation
backgroundConfiguration: null
animationId: pulse
```

The animation's composition duration determines the background duration.

### Still background

```yaml
backgroundType: still
backgroundConfiguration:
  duration: 4
stillId: dark-card
```

`duration` is seconds. Generate a finite nonnegative number. A still part advances automatically
only when it has a duration and has no foreground or an announcement foreground. Quiz and taxonomy
foregrounds wait for interaction.

### Foreground cue

```yaml
foregroundConfiguration:
  start: 0.6
```

On video or animation backgrounds, `start` is a fraction of the full asset duration. A quiz or
taxonomy pauses playback at the cue; an announcement does not. With a still or no background, the
foreground appears immediately.

---

## 9. Ordinary transitions and termination

Allowed `terminationStrategy` values:

```text
NONE
FAIL_STORY
COMPLETE_STORY
```

| Configuration                         | Runtime behavior                              |
| ------------------------------------- | --------------------------------------------- |
| `NONE` plus valid `defaultNextPartId` | follows that part after background completion |
| `NONE` plus quiz/taxonomy logic       | follows the selected logic destination        |
| `NONE` plus no valid destination      | ends and reports successful completion        |
| `COMPLETE_STORY`                      | ends successfully                             |
| `FAIL_STORY`                          | ends unsuccessfully                           |

Do not put outgoing destinations on terminal parts. During import, all ordinary, quiz, and taxonomy
destinations on `COMPLETE_STORY` or `FAIL_STORY` parts are discarded.

A terminal part may contain a quiz or taxonomy interaction. The player waits for the active
interaction, then applies the terminal strategy; all interaction destinations are still discarded.

---

## 10. Quiz branching

For a quiz foreground, set all four related fields consistently:

```yaml
foregroundType: quiz
quizTemplateId: choice-quiz
quizLogicForPartId: choice-logic
quizLogicForPart:
  hitpolicy: first
  quizTemplateId: choice-quiz
  defaultNextPartId: retry
  rules:
    - id: safe-route-rule
      order: 1
      name: Marked route selected
      nextPartId: success
      inputs:
        - id: safe-route-input
          quizQuestionTemplateId: route-question
          quizQuestionTemplateAnswerItemId: marked-route
          value: null
```

`quizLogicForPartId` is a non-null presence marker. Its literal value is not preserved as the
database logic ID. Always include the nested `quizLogicForPart` when the marker is non-null.
`quizTemplateId` on the part is required by the import schema but is not used when inserting the
part; the nested `quizLogicForPart.quizTemplateId` selects the persisted quiz. Set both to the same
quiz ID for clarity and consistency.

### Quiz logic properties

| Property            | Required | Type              |
| ------------------- | -------- | ----------------- |
| `hitpolicy`         | yes      | literal `first`   |
| `quizTemplateId`    | yes      | quiz ID           |
| `defaultNextPartId` | yes      | part ID or `null` |
| `rules`             | yes      | rule array        |

Each rule requires numeric `order`, non-empty `name`, nullable `nextPartId`, and an `inputs` array.
Each input requires `quizQuestionTemplateId`, nullable `quizQuestionTemplateAnswerItemId`, and
optional arbitrary `value` defaulting to `null`; input `id` is optional.

An input always constrains its question. With a non-null answer-item ID, runtime uses that answer
option's `value`; the common `value: null` in YAML does not make it a wildcard. With a null
answer-item ID, the explicit input `value`, including `null`, is matched exactly. To leave a question
unconstrained, omit its input. Runtime chooses the matching rule with the most constrained
questions. Equal-specificity ties favor the later rule, despite the stored `hitpolicy` being named
`first`.

---

## 11. Taxonomy interaction and branching

A taxonomy foreground references a separately imported taxonomy by `slug`:

```yaml
foregroundType: taxonomy
taxonomyDraftForPartId: country-game
taxonomyDraftForPart:
  taxonomySlug: general-taxonomy
  nrOfRounds: 5
  nrOfItemsPerRound: 4
  goal: 3
  maxMistakes: null
  difficulty: null
  defaultNextPartId: retry
  draftedAttributeIds: [country-name]
  attributeOptions:
    - id: country-name
      slug: name
  draftedCategoryIds: []
  draftedItemIds: []
  rules:
    - id: pass-rule
      order: 1
      name: Three correct rounds
      nextPartId: success
      nrOfRounds: null
      score: [3, null]
      mistakes: null
      duration: null
```

`taxonomyDraftForPartId`, like the quiz marker, only signals that a nested draft exists. Always
include `taxonomyDraftForPart` with a non-null marker.

### Taxonomy draft properties

| Property              | Required | Type                        | Runtime null default  |
| --------------------- | -------- | --------------------------- | --------------------- |
| `taxonomySlug`        | yes      | existing taxonomy slug      | none                  |
| `nrOfRounds`          | yes      | integer or `null`           | `5`                   |
| `nrOfItemsPerRound`   | yes      | integer or `null`           | `4`                   |
| `goal`                | yes      | integer or `null`           | `1`, capped to rounds |
| `maxMistakes`         | yes      | integer or `null`           | unlimited             |
| `difficulty`          | yes      | integer or `null`           | unrestricted          |
| `defaultNextPartId`   | yes      | part ID or `null`           | none                  |
| `draftedAttributeIds` | no       | portable attribute ID array | `[]`                  |
| `attributeOptions`    | no       | `{ id, slug }` array        | `[]`                  |
| `draftedCategoryIds`  | no       | category database ID array  | `[]`                  |
| `draftedItemIds`      | no       | item database ID array      | `[]`                  |
| `rules`               | yes      | taxonomy rule array         | none                  |

Generate positive rounds/items/goal, nonnegative `maxMistakes` and `difficulty`, and a goal no
greater than the number of rounds. The importer only checks that these are integers or `null`.
Currently, `goal` and `maxMistakes` affect the status display but do not end the game early; use
taxonomy outcome rules to branch on final score or mistakes.

When draft `difficulty` is non-null, item-attribute rows with `difficulty: null` are excluded; only
rows whose difficulty is at most the draft value remain eligible. For numeric slider rounds,
difficulty also controls range and error tolerance and is clamped to levels `0` through `3`. Prefer
`null` unless item difficulties are populated consistently or slider difficulty is intentional.

Set `nrOfItemsPerRound: 1` to render a numeric attribute as a slider. With two or more numeric items,
the player renders a sortable ordering round and ignores slider schema settings.

Every `draftedAttributeIds` entry must have an `attributeOptions` entry with the same portable `id`.
Its `slug` must identify an attribute in the referenced taxonomy; import translates it to the real
attribute ID. Category and item filters are not remapped by slug: they must be existing database IDs
and are therefore not portable between installations. Prefer empty category/item filters in
generated portable files.

Attribute-option IDs are resolved through one story-wide lookup during import. Across all taxonomy
drafts in a story, make each portable ID globally unique or map every reuse to the same attribute
slug; a later conflicting mapping overwrites an earlier one.

Only taxonomy attributes with runtime type `number`, `item_reference`, or `translatable_category`
can create games, and they must have enough usable items.

### Taxonomy rules

Each rule has:

```yaml
order: 1
name: Pass
nextPartId: success
nrOfRounds: null
score: [3, null]
mistakes: [null, 1]
duration: null
```

`order` is an integer. Each condition is `null` or a two-element inclusive range
`[minimum-or-null, maximum-or-null]`. Generate ordered bounds. Rules are evaluated by order; the
first matching rule wins. If none matches, `defaultNextPartId` is used. `duration` bounds are in
milliseconds, not seconds.

---

## 12. Reference rules

| Reference                                     | Must resolve to                    |
| --------------------------------------------- | ---------------------------------- |
| part `videoId`                                | `videos[].id`                      |
| part `animationId`                            | `animations[].id`                  |
| part `stillId`                                | `stills[].id`                      |
| part `announcementTemplateId`                 | `announcements[].id`               |
| part/logic `quizTemplateId`                   | `quizzes[].id`                     |
| quiz input `quizQuestionTemplateId`           | question in the referenced quiz    |
| quiz input `quizQuestionTemplateAnswerItemId` | answer in that question, or `null` |
| any `defaultNextPartId` or rule `nextPartId`  | `parts[].id`, or `null`            |
| taxonomy draft `taxonomySlug`                 | an already imported taxonomy slug  |
| taxonomy attribute option `slug`              | attribute slug in that taxonomy    |

The importer explicitly preflights animation IDs, animation references, taxonomy slugs, and
taxonomy attribute mappings. Many other bad references fail later or become missing values. An LLM
must validate all references itself.

---

## 13. Representative multi-part story

```yaml
slug: route-choice
name:
  en: Route choice
defaultBackgroundColor: '#111827'
isPublished: false
isPublic: false
videos:
  - id: route-video
    name: Route overview
    source:
      default:
        collection: externals
        filename: https://example.com/route.mp4
    thumbnail: null
    captions: null
    duration: 20
stills:
  - id: dark-card
    color: '#111827'
    image: null
    style: null
announcements:
  - id: welcome
    name: Welcome
    title: { en: Choose carefully }
    message: { en: 'Watch the route, then answer one question.' }
  - id: complete
    name: Complete
    title: { en: Safe arrival }
    message: { en: You stayed on the marked route. }
quizzes:
  - id: route-quiz
    name: Route question
    doRandomize: false
    questions:
      - id: route-question
        order: 1
        answerTemplateSlug: select-single
        title: { en: Which route should you take? }
        isRequired: true
        answerOptions:
          - id: marked-answer
            order: 1
            value: marked
            label: { en: The marked route }
          - id: shortcut-answer
            order: 2
            value: shortcut
            label: { en: The shortcut }
        answerGroup:
          id: route-answers
          doRandomize: false
parts:
  - id: intro
    isInitial: true
    terminationStrategy: NONE
    position: { x: 0, y: 0 }
    backgroundType: still
    backgroundConfiguration: { duration: 2 }
    videoId: null
    stillId: dark-card
    defaultNextPartId: question
    foregroundType: announcement
    announcementTemplateId: welcome
    quizTemplateId: null
    quizLogicForPartId: null
    quizLogicForPart: null
    taxonomyDraftForPartId: null
  - id: question
    isInitial: false
    terminationStrategy: NONE
    position: { x: 400, y: 0 }
    backgroundType: video
    backgroundConfiguration: { start: 0, end: 0.5 }
    videoId: route-video
    defaultNextPartId: null
    foregroundType: quiz
    foregroundConfiguration: { start: 0.5 }
    announcementTemplateId: null
    quizTemplateId: route-quiz
    quizLogicForPartId: route-logic
    quizLogicForPart:
      hitpolicy: first
      quizTemplateId: route-quiz
      defaultNextPartId: question
      rules:
        - id: marked-rule
          order: 1
          name: Marked route is correct
          nextPartId: finish
          inputs:
            - quizQuestionTemplateId: route-question
              quizQuestionTemplateAnswerItemId: marked-answer
    taxonomyDraftForPartId: null
  - id: finish
    isInitial: false
    terminationStrategy: COMPLETE_STORY
    position: { x: 800, y: 0 }
    backgroundType: still
    backgroundConfiguration: { duration: 2 }
    videoId: null
    stillId: dark-card
    defaultNextPartId: null
    foregroundType: announcement
    announcementTemplateId: complete
    quizTemplateId: null
    quizLogicForPartId: null
    quizLogicForPart: null
    taxonomyDraftForPartId: null
```

---

## 14. Common mistakes

Avoid:

- omitting required empty arrays: `videos`, `announcements`, `quizzes`, or `parts`;
- using a plain string where a translatable map is required;
- omitting both `default` and `en` from a translatable value;
- using duplicate or empty portable IDs;
- treating YAML array order as the story sequence;
- generating zero or multiple initial parts;
- using background/foreground type strings other than the six runtime-supported values;
- setting a type without its matching asset ID or nested logic;
- leaving unrelated asset IDs populated;
- using a quiz template slug other than `select-single`;
- referencing a question, answer, asset, part, taxonomy, or attribute that does not exist;
- putting outgoing edges on a terminal part;
- expecting a still part without a duration or interaction to advance automatically;
- treating video timing as seconds instead of fractions;
- using unordered or invalid timing fractions and taxonomy ranges;
- expecting `captions`, quiz `instruction`, `placeholder`, or quiz `configuration` to render;
- expecting animation autoplay/loop settings to control story playback;
- embedding category/item taxonomy database IDs in a portable story;
- relying on permissive importer behavior that the player does not support.

---

## 15. LLM output requirements

When asked to create a story:

1. Output one valid YAML mapping, normally for a `.yml` file.
2. Include every required top-level array, even when empty.
3. Use unique, descriptive portable IDs and exactly one initial part.
4. Build an explicit, fully resolvable part graph.
5. Use only supported background, foreground, quiz, and termination values.
6. Keep terminal parts free of outgoing destinations.
7. Ensure media and interaction references match their declared assets.
8. Use sensible positive durations, normalized timing fractions, and ordered ranges.
9. Reference only taxonomies and taxonomy attribute slugs known to exist.
10. Do not add unknown properties or comments unless requested.
11. Unless specifically requested otherwise, return pure YAML without explanatory prose.
