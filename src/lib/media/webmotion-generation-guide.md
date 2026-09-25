# WebMotionConfig v1 — LLM Generation Guide

Generate a single valid JSON object describing a frame-based WebMotion animation.

The configuration supports:

- text
- rectangles
- circles
- ellipses
- lines
- polygons
- SVG paths
- reusable motion presets
- keyframe animation
- transforms
- opacity and blur
- color animation
- nested property animation

Prefer simple, reusable motion definitions and concise keyframes.

---

## 1. Top-level structure

```json
{
	"version": 1,
	"composition": {
		"viewBoxWidth": 1280,
		"viewBoxHeight": 720,
		"fps": 30,
		"durationInFrames": 300,
		"background": "#09090b"
	},
	"playback": {
		"autoplay": false,
		"loop": true
	},
	"motions": {},
	"layers": []
}
```

### `version`

Required.

```json
"version": 1
```

Always use `1`.

### `composition`

Required.

| Property           | Type             | Description                                |
| ------------------ | ---------------- | ------------------------------------------ |
| `viewBoxWidth`     | positive integer | Logical coordinate width; required         |
| `viewBoxHeight`    | positive integer | Logical coordinate height; required        |
| `fps`              | positive number  | Frames per second                          |
| `durationInFrames` | positive integer | Total composition duration                 |
| `background`       | string           | Canvas background; default `"transparent"` |

Example:

```json
{
	"viewBoxWidth": 1280,
	"viewBoxHeight": 720,
	"fps": 30,
	"durationInFrames": 300,
	"background": "#09090b"
}
```

The aspect ratio is derived from `viewBoxWidth / viewBoxHeight`; do not provide a
separate ratio attribute. These dimensions define logical drawing coordinates,
not the player's screen dimensions.

In a bounded parent, the player fills the container and uses `object-fit: contain`
on the canvas. The complete animation scales as far as fits without cropping or
distortion, with letterboxing when the ratios differ. Controls, when enabled,
remain below the canvas within the container. In responsive, unbounded layouts,
the canvas fills the available width and derives its height from the viewbox ratio;
controls add to the player's total height. Resizing never changes the timeline.

Common logical viewboxes:

- Landscape 16:9: `1280` by `720`, or `1920` by `1080`
- Portrait 9:16: `720` by `1280`, or `1080` by `1920`
- Square 1:1: `1000` by `1000`

Version remains `1`. Composition `width` and `height` are not accepted.
Layer dimensions, such as rectangle and SVG `width` and `height`, remain supported.

### Drawing coordinates

Author positions, sizes, font sizes, strokes, and blur in the logical viewbox.
The runtime canvas uses exactly `viewBoxWidth` by `viewBoxHeight`, with no
normalization. The origin is the top-left corner, and the center is
`(viewBoxWidth / 2, viewBoxHeight / 2)`. For the `1280` by `720` examples here,
the center is `(640, 360)`. All layer geometry scales with the displayed canvas.

To rename an old composition's `width` and `height`, use `viewBoxWidth` and
`viewBoxHeight` with the same values. Preserve all existing geometry and keyframes.
SVG path data and each SVG layer's `viewBox` remain in their own coordinate system;
the layer's outer `width` and `height` place it within the composition viewbox.

### `playback`

Optional.

```json
{
	"autoplay": false,
	"loop": true
}
```

Both default to `false`.

### `motions`

Optional reusable animation presets. See **Reusable motions** below.

### `layers`

Required array containing the visual layers.

Supported types:

```text
text
rectangle
circle
ellipse
line
polygon
svg
```

---

# 2. Common layer structure

Every layer has this general form:

```json
{
	"type": "circle",
	"name": "Background glow",
	"from": 0,
	"duration": 300,
	"motion": "fadeIn",
	"props": {},
	"animate": {}
}
```

Only `type` and `props` are normally required.

### Common layer fields

| Property   | Type               | Meaning                                                  |
| ---------- | ------------------ | -------------------------------------------------------- |
| `type`     | string             | Layer type                                               |
| `name`     | string             | Optional human-readable name                             |
| `from`     | integer ≥ 0        | Composition frame at which the layer starts; default `0` |
| `duration` | positive integer   | Layer duration in frames                                 |
| `motion`   | string or string[] | Reusable motion preset(s)                                |
| `props`    | object             | Base visual properties                                   |
| `animate`  | object             | Layer-specific animations                                |

If `duration` is omitted:

```text
duration = composition.durationInFrames - from
```

Animation time inside a layer is **local**.

For example:

```json
{
	"from": 30,
	"duration": 60
}
```

exists globally from composition frame `30` through approximately frame `89`, but its animation timeline starts locally at frame `0`.

---

# 3. Common transform properties

Most layer types support:

```json
{
	"x": 640,
	"y": 360,
	"rotation": 0,
	"scale": 1,
	"scaleX": 1,
	"scaleY": 1,
	"opacity": 1,
	"blur": 0
}
```

### Meaning

- `x`: horizontal position in logical drawing units
- `y`: vertical position in logical drawing units
- `rotation`: degrees
- `scale`: uniform X/Y scale
- `scaleX`: horizontal scale
- `scaleY`: vertical scale
- `opacity`: `0` to `1`
- `blur`: blur radius in logical drawing units, ≥ `0`

`scale` is shorthand for setting both `scaleX` and `scaleY`.

Use:

```json
"scale": 1
```

instead of identical `scaleX` and `scaleY`.

---

# 4. Paint properties

Shape layers can use:

```json
{
	"fill": "#818cf8",
	"stroke": "#ffffff",
	"lineWidth": 2
}
```

- `fill`: CSS color string
- `stroke`: CSS color string
- `lineWidth`: number ≥ `0`

---

# 5. Layer types

## Text

```json
{
	"type": "text",
	"props": {
		"x": 640,
		"y": 360,
		"text": "Hello world",
		"fontSize": 72,
		"fontFamily": "system-ui",
		"fontWeight": 700,
		"color": "#ffffff",
		"align": "center",
		"baseline": "middle",
		"maxWidth": 800
	}
}
```

### Text properties

Required:

```text
text
```

Optional:

```text
x
y
rotation
scale
scaleX
scaleY
opacity
blur
fontSize
fontFamily
fontWeight
color
align
baseline
maxWidth
```

`align`:

```text
left
center
right
```

`baseline`:

```text
top
hanging
middle
alphabetic
ideographic
bottom
```

Typical defaults are approximately:

```text
fontSize: 64
fontFamily: system-ui
fontWeight: 400
color: #ffffff
align: center
baseline: middle
```

---

## Rectangle

```json
{
	"type": "rectangle",
	"props": {
		"x": 640,
		"y": 360,
		"width": 600,
		"height": 280,
		"cornerRadius": 40,
		"fill": "#18181b",
		"stroke": "#818cf8",
		"lineWidth": 2
	}
}
```

Required:

```text
width
height
```

Optional:

```text
cornerRadius
fill
stroke
lineWidth
```

plus all common transforms.

---

## Circle

```json
{
	"type": "circle",
	"props": {
		"x": 640,
		"y": 360,
		"radius": 150,
		"fill": "#818cf8"
	}
}
```

Required:

```text
radius
```

Supports paint and common transforms.

---

## Ellipse

```json
{
	"type": "ellipse",
	"props": {
		"x": 640,
		"y": 360,
		"radiusX": 120,
		"radiusY": 50,
		"fill": "#818cf8"
	}
}
```

Required:

```text
radiusX
radiusY
```

Supports paint and common transforms.

---

## Line

```json
{
	"type": "line",
	"props": {
		"x": 640,
		"y": 360,
		"x1": -150,
		"y1": 0,
		"x2": 150,
		"y2": 0,
		"stroke": "#ffffff",
		"lineWidth": 4,
		"lineCap": "round"
	}
}
```

Required:

```text
x1
y1
x2
y2
```

`lineCap` may be:

```text
butt
round
square
```

Supports common transforms.

---

## Polygon

```json
{
	"type": "polygon",
	"props": {
		"x": 640,
		"y": 360,
		"points": [
			[0, -50],
			[45, 35],
			[-45, 35]
		],
		"fill": "#c4b5fd"
	}
}
```

`points` must contain at least three `[x, y]` coordinate pairs.

Supports paint and common transforms.

---

## SVG

SVG layers contain one or more SVG paths.

```json
{
	"type": "svg",
	"props": {
		"x": 640,
		"y": 360,
		"width": 120,
		"height": 120,
		"viewBox": [0, 0, 24, 24],
		"paths": [
			{
				"d": "M12 2L22 22H2Z",
				"fill": "#818cf8",
				"stroke": "#ffffff",
				"lineWidth": 0.5,
				"fillRule": "nonzero"
			}
		]
	}
}
```

Required:

```text
width
height
viewBox
paths
```

`viewBox`:

```json
[minX, minY, width, height]
```

Each path supports:

```text
d
fill
stroke
lineWidth
fillRule
```

`fillRule`:

```text
nonzero
evenodd
```

Nested SVG properties can be animated using paths such as:

```text
paths.0.fill
paths.1.stroke
paths.0.lineWidth
```

Example:

```json
"animate": {
  "paths.0.fill": {
    "values": ["#818cf8", "#f472b6", "#818cf8"]
  }
}
```

---

# 6. Animation

Animations are stored in:

```json
"animate": {}
```

Keys identify the property to animate.

Example:

```json
"animate": {
  "x": {
    "values": [100, 1180, 100],
    "easing": "easeInOutCubic"
  },
  "rotation": {
    "values": [0, 360],
    "easing": "linear"
  }
}
```

---

# 7. Simplest animation syntax

A track may simply be an array:

```json
"opacity": [0, 1]
```

Equivalent conceptually to:

```json
"opacity": {
  "values": [0, 1]
}
```

With no timing information, values are distributed evenly across the available animation duration.

Examples:

```json
"x": [100, 1180]
```

```json
"scale": [0.8, 1.2, 0.8]
```

```json
"fill": ["#818cf8", "#f472b6", "#818cf8"]
```

---

# 8. Full animation track syntax

```json
{
	"values": [0, 1],
	"at": [0, 1],
	"duration": 30,
	"delay": 10,
	"easing": "easeOutCubic",
	"relative": false
}
```

Available properties:

| Property   | Meaning                                                 |
| ---------- | ------------------------------------------------------- |
| `values`   | Required keyframe values; minimum 2                     |
| `at`       | Normalized keyframe positions from `0` to `1`           |
| `frames`   | Explicit local frame positions                          |
| `duration` | Animation duration in frames                            |
| `delay`    | Delay before animation starts                           |
| `easing`   | Easing applied between keyframes                        |
| `relative` | Interpret numeric values as offsets from the base value |

Do not use `at` and `frames` together.

---

# 9. Automatic keyframe distribution

Prefer omitting keyframe positions when they are evenly spaced.

```json
{
	"values": [0.8, 1.2, 0.8]
}
```

automatically means approximately:

```text
0% → 0.8
50% → 1.2
100% → 0.8
```

Five values:

```json
{
	"values": [0, 1, 0, 1, 0]
}
```

become:

```text
0%
25%
50%
75%
100%
```

Do not manually specify evenly spaced positions unless necessary.

---

# 10. Normalized timing with `at`

Use `at` for uneven timing.

```json
{
	"values": [0, 1, 1, 0],
	"at": [0, 0.15, 0.8, 1],
	"easing": "easeInOutCubic"
}
```

`at` values must:

- be between `0` and `1`
- increase strictly
- have the same number of entries as `values`

---

# 11. Explicit frame timing

Use `frames` when exact frame positions matter.

```json
{
	"values": [0, 1, 0],
	"frames": [0, 20, 60],
	"easing": "easeInOutSine"
}
```

These are **layer-local frames**, not composition-global frames.

A layer starting at:

```json
"from": 100
```

with:

```json
"frames": [0, 20]
```

animates globally from approximately frame `100` to `120`.

---

# 12. Duration

Use `duration` for short animations:

```json
"opacity": {
  "values": [0, 1],
  "duration": 24,
  "easing": "easeOutCubic"
}
```

If neither `at` nor `frames` is specified, the values are evenly distributed across `duration`.

If no duration is specified, the track normally uses the available layer duration.

---

# 13. Delay

```json
"opacity": {
  "values": [0, 1],
  "duration": 24,
  "delay": 12
}
```

The animation starts 12 local frames later.

---

# 14. Relative animation

Use:

```json
"relative": true
```

when values should be offsets from the base property.

Example:

```json
{
	"type": "text",
	"props": {
		"x": 640,
		"y": 300,
		"text": "Hello"
	},
	"animate": {
		"y": {
			"values": [40, 0],
			"duration": 30,
			"relative": true
		}
	}
}
```

The effective Y values become:

```text
340 → 300
```

because the base Y is `300`.

Relative animation only works with:

- a numeric base value
- numeric keyframe values

This is especially useful for reusable motions such as `fadeUp`, `slideLeft`, etc.

---

# 15. Easing

Supported easing names:

```text
linear
easeInQuad
easeOutQuad
easeInOutQuad
easeInCubic
easeOutCubic
easeInOutCubic
easeInSine
easeOutSine
easeInOutSine
```

Good defaults:

- constant movement/rotation → `linear`
- entrances → `easeOutCubic`
- exits → `easeInCubic`
- smooth looping/pulsing → `easeInOutSine`
- smooth positional movement → `easeInOutCubic`

---

# 16. Uniform scale animation

Use:

```json
"scale": {
  "values": [0.8, 1.2, 0.8]
}
```

instead of duplicating:

```json
"scaleX": {
  "values": [0.8, 1.2, 0.8]
},
"scaleY": {
  "values": [0.8, 1.2, 0.8]
}
```

Use separate `scaleX` or `scaleY` only when intentionally stretching one axis.

---

# 17. Reusable motions

Reusable motions live at the top level:

```json
"motions": {
  "fadeIn": {
    "duration": 24,
    "easing": "easeOutCubic",
    "animate": {
      "opacity": [0, 1]
    }
  }
}
```

Apply one to a layer:

```json
{
	"type": "text",
	"motion": "fadeIn",
	"props": {
		"text": "Hello",
		"opacity": 0
	}
}
```

Apply several:

```json
"motion": ["fadeIn", "pulse"]
```

A reusable motion supports:

```text
duration
delay
easing
animate
```

Tracks inside the motion may override the motion's duration, delay, or easing.

When multiple motions animate the same property, later motions override earlier ones for that property.

Layer-level `animate` tracks override reusable motion tracks.

---

# 18. Example reusable entrance motion

```json
"motions": {
  "fadeUp": {
    "duration": 30,
    "easing": "easeOutCubic",
    "animate": {
      "opacity": [0, 1],
      "y": {
        "values": [30, 0],
        "relative": true
      }
    }
  }
}
```

Then:

```json
{
	"type": "text",
	"from": 20,
	"motion": "fadeUp",
	"props": {
		"x": 640,
		"y": 360,
		"text": "WebMotion",
		"fontSize": 80,
		"opacity": 0
	}
}
```

---

# 19. Property paths

Animations may target nested properties with dot notation.

Examples:

```text
x
opacity
scale
fill
paths.0.fill
paths.0.stroke
paths.1.lineWidth
```

Array indexes are numeric path segments.

Do not use unsafe path segments such as:

```text
__proto__
prototype
constructor
```

---

# 20. Interpolation behavior

The renderer smoothly interpolates:

### Numbers

```json
[0, 100]
```

### Supported colors

Hex:

```text
#fff
#ffff
#ffffff
#ffffffff
```

RGB/RGBA:

```text
rgb(255, 0, 0)
rgba(255, 0, 0, 0.5)
```

Example:

```json
"fill": {
  "values": ["#818cf8", "#f472b6", "#818cf8"]
}
```

### Arrays

Arrays of equal length are recursively interpolated.

This can be useful for numeric coordinate arrays.

### Other values

Unsupported value types change discretely rather than interpolating smoothly.

For example, arbitrary strings switch from one value to another.

Do not expect smooth interpolation for:

```text
named CSS colors
hsl(...)
oklch(...)
SVG path `d` strings
text strings
```

Prefer hex or `rgb()/rgba()` when animating colors.

---

# 21. Timing model

Remember these three timelines:

### Composition timeline

```text
0 → composition.durationInFrames - 1
```

### Layer timeline

A layer with:

```json
{
	"from": 30,
	"duration": 100
}
```

has a local timeline of approximately:

```text
0 → 99
```

starting at global frame `30`.

### Track timeline

A track may occupy all or only part of the layer:

```json
{
	"values": [0, 1],
	"duration": 20,
	"delay": 10
}
```

starts at local frame `10` and lasts approximately 20 frames.

Never create animation tracks that extend past the end of their layer.

---

# 22. Recommended authoring conventions

When generating a configuration:

1. Set positive integer composition `viewBoxWidth` and `viewBoxHeight`, usually `1280` by `720` for landscape or `720` by `1280` for portrait. Author geometry in those logical coordinates; do not include a separate ratio or composition `width` or `height`.
2. Usually use `30` fps unless another rate is requested.
3. Put static/base values in `props`.
4. Put changing values in `animate`.
5. Do not duplicate base values unnecessarily.
6. Prefer reusable `motions` for repeated entrances/exits.
7. Prefer `scale` over identical `scaleX` + `scaleY`.
8. Prefer implicit evenly spaced keyframes.
9. Use `at` only for deliberately uneven timing.
10. Use `frames` only when exact frame timing matters.
11. Use relative animation for reusable positional motions.
12. Prefer hex or rgba colors when colors animate.
13. Give layers descriptive `name` values.
14. Keep animation subtle unless dramatic motion is explicitly requested.
15. Stagger `from` values to create visual rhythm.
16. Ensure all animations remain within their layer duration.
17. Use nested paths such as `paths.0.fill` for SVG path styling.
18. Keep JSON valid: double quotes, no comments, no trailing commas.

---

# 23. Complete compact example

```json
{
	"version": 1,
	"composition": {
		"viewBoxWidth": 1280,
		"viewBoxHeight": 720,
		"fps": 30,
		"durationInFrames": 180,
		"background": "#09090b"
	},
	"playback": {
		"autoplay": false,
		"loop": true
	},
	"motions": {
		"fadeUp": {
			"duration": 24,
			"easing": "easeOutCubic",
			"animate": {
				"opacity": [0, 1],
				"y": {
					"values": [30, 0],
					"relative": true
				}
			}
		}
	},
	"layers": [
		{
			"type": "circle",
			"name": "Background glow",
			"props": {
				"x": 300,
				"y": 360,
				"radius": 220,
				"fill": "rgba(99, 102, 241, 0.3)",
				"blur": 60
			},
			"animate": {
				"x": {
					"values": [300, 980, 300],
					"easing": "easeInOutCubic"
				},
				"scale": {
					"values": [0.9, 1.15, 0.9],
					"easing": "easeInOutSine"
				}
			}
		},
		{
			"type": "rectangle",
			"name": "Card",
			"from": 10,
			"motion": "fadeUp",
			"props": {
				"x": 640,
				"y": 360,
				"width": 620,
				"height": 260,
				"cornerRadius": 42,
				"fill": "rgba(24, 24, 27, 0.9)",
				"stroke": "#818cf8",
				"lineWidth": 2,
				"opacity": 0
			}
		},
		{
			"type": "text",
			"name": "Title",
			"from": 20,
			"motion": "fadeUp",
			"props": {
				"x": 640,
				"y": 340,
				"text": "WEBMOTION",
				"fontSize": 82,
				"fontWeight": 700,
				"fontFamily": "system-ui",
				"color": "#fafafa",
				"opacity": 0
			}
		},
		{
			"type": "text",
			"name": "Subtitle",
			"from": 32,
			"motion": "fadeUp",
			"props": {
				"x": 640,
				"y": 420,
				"text": "JSON-driven animation",
				"fontSize": 28,
				"fontWeight": 400,
				"fontFamily": "system-ui",
				"color": "#c7d2fe",
				"opacity": 0
			}
		}
	]
}
```

---

# 24. LLM output requirements

When asked to create a WebMotion animation:

- Output a valid `WebMotionConfig` version 1 object.
- Use only supported layer types and properties.
- Choose a sensible aspect ratio, timings, positions, sizes, and colors using the documented logical drawing coordinates.
- Use reusable motions when animation patterns repeat.
- Avoid unnecessary keyframe positions.
- Keep all layer and track durations within the composition.
- Prefer smooth, purposeful animation over excessive movement.
- Unless specifically requested otherwise, return pure JSON without explanatory prose.
