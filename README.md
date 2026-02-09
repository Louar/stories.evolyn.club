# Stories

Stories lets you build, edit, and publish interactive _“stories”_. A story is made of connected **parts**. Each part can play a video and optionally show an interactive overlay such as an announcement or quiz. Branching rules control how parts follow each other.

## Main Features

Stories includes:

- A **public story player** that plays videos, shows overlays, and follows branching rules
- A **story editor** for authenticated users
- YAML import/export for offline editing or bulk migration

## Core concepts

### 🚧 Anthology

An anthology is a list of stories. Anthologies are currently work in progress.

### Story

A story is the full interactive experience a viewer plays through.

### Part

A part is one step in the story. Every part has:

- **Background layer** (required)
- **Foreground layer** (optional)

Parts are connected using **branching logic**, which decides which part plays next.

### Part layers

#### Background layer (required)

Currently, a background layer is always a **video**.
Supported video sources are (1) **.m3u8 stream URLs** and (2) **YouTube URLs**.

#### Foreground layer (optional)

Foreground layers appear on top of the video.
Available foreground types are currently:

1. **Announcement**
   - An announcement displays a title and/or message at a chosen moment during the video.
   - Use announcements for: instructions, reminders, and/or short explanations.
2. **Quiz**
   - A quiz asks the viewer one or more questions.
   - Quizzes can also control branching, for example: “If the user answered _B_ to _Question 1_, go to _Part 4_”.

### Branching rules

Branching rules decide which part plays next. They are what makes a story interactive instead of linear.

Stories supports two types of branching:

#### 1. Default branching (per part)

Each part can define a **default next part**. This is the part that plays automatically when the video finishes.
Use this when your story should continue normally without requiring input.
Example: Part A finishes → Part B starts.

#### 2. Quiz-based branching

If a part contains a **quiz**, the next part can be chosen based on the viewer’s answers.
Quiz branching uses rules such as:

- “If the answer to _Question 1_ is _Yes_, go to _Part C_.”
- “If the answer to _Question 1_ is _Yes_ and the answer to _Question 2_ is _No_, go to _Part D_.”

Quiz rules are evaluated when the quiz is completed.
You can also define a **fallback part** (default rule) for answers that do not match any specific rule.

⚠️ **Important:** If you use quiz branching, _avoid setting a normal default next part for the video_ ending unless you want the quiz to be time-limited. Otherwise the video may end and continue before the viewer answers.

## Getting Started

1. Create an account
2. Open the editor. After logging in:
3. Go to My Stories
4. Choose one option:
   - **Create story** (starts empty)
   - Select an existing story
   - Upload a story YAML file

## Creating Stories in the editor

In the Story editor, Stories are displayed as a **canvas of cards**.
Each card represents one **part**.

You can:

- drag parts around to organize your layout
- drag a connector from one part to another to define what plays next
- drag a connector into empty space to create a new part automatically
- delete parts or connections: click the element, and press **Backspace**.

## Configuring a Part

Each part can contain:

1. **Video (background).** For each part, select a video from your library and optionally trim it by using the slider to select a start and end time.
2. **Overlay (foreground).** Optionally add an overlay: announcement, or quiz. If the part contains a quiz, you can also define rules for what plays next (see _"Quiz branching is configured per part, not per quiz"_). You can set the moment the overlay should show by dragging the star-icon (⭐️) on the slider.

## Reusable Story assets

Before you can fully build parts, you usually need to define story-wide assets in **Settings**.

### Story Settings

- story name
- story reference
- publication status

### Videos

You maintain a story video library.

- Videos are referenced through URLs. Currently, .m3u8 stream URLs and YouTube URLs are allowed.
- Optionally, for video’s a poster or thumbnail can be configured, which would be displayed before the story starts playing. Posters are only shown for the **first part**, so they do not interrupt the story flow.

### Announcements

Create reusable announcement templates and translations.

### Quizzes

Create reusable quiz templates, add questions, answer options, and reorder them.

⚠️ **Quiz branching is configured per part, not per quiz.**
This means _the same quiz can be reused in multiple parts_, and each part can send the viewer to different next parts.
To edit the branching rules for the quiz in the current part, click the cog icon (⚙️) next to the selected quiz name.

## Advanced editor concepts

### Display orientation

A Story may support multiple display orientations. Allowed orientations are: portrait (aspect ratio of 16:9; this is usually the default in mobile-first designs), landscape (aspect ratio of 9:16), and square (aspect ratio of 1:1).

When adding videos (or thumbnails), you see an Orientation selector next to the URL field. You choose Default, Portrait, Landscape, or Square, and then paste the URL for that orientation.

The value default is the fallback when a specific orientation is not provided. For orientations, the system looks for the requested orientation first, then falls back to default, then to portrait. This ensures a video still plays even if you only set a single source.

In practical terms: if you only fill in default, that value will be used everywhere until you add specific orientation variants.

### Translations

When editing a story, announcements, or quiz text, you’ll see language‑aware input fields. You pick a language from the Language dropdown (flag or world icon), and then type the text for that language. Switching the dropdown lets you fill in another language for the same field.

In particular, this applies to:

- Story name in Story Settings
- Announcement title/message
- Quiz questions/answers

The value default (displayed with 🌐 in the editor) is the fallback when a specific language is not provided.

For translations, the system looks for the requested language first, then falls back to default, then to English. This ensures something is always shown even if a translation is missing.

In practical terms: if you only fill in default, that value will be used everywhere until you add specific language variants.

## Embedding stories

The public story player is designed (with a transparent body) to be embedded through an iframe. The player triggers an event (using postMessage) back to the parent when the story completes. This means you can place the public story URL in an iframe and listen for completion events in the host page, using something like:

```html
<iframe
	id="story"
	title="Story"
	frameborder="0"
	style="overflow:hidden;height:100%;width:100%"
	height="100%"
	width="100%"
	src="{src}"
	sandbox="allow-scripts allow-same-origin allow-presentation"
	allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
>
</iframe>
```

```ts
export class StoryEvent {
  isCompleted: boolean;
  start: Date;
  end: Date;
  watchTime: number;
  watchTimePercentage: number;
}

const allowedOrigins = ['http://localhost:5174', 'https://stories.example.com'];

window.addEventListener('message', (event: MessageEvent) => {
  if (!allowedOrigins.includes(event.origin)) {
    return;
  }

  const story = event.data as StoryEvent;
});

```

⚠️ Always validate `event.origin`. Never trust messages from unknown domains.

## API

### Display orientation selection

The player supports choosing an orientation through the embed URL. Supported values are _portrait_, _landscape_, or _square_. For example: `/square` forces a square layout.

### Translations (language selection)

The player chooses language from the embed URL. To set a language, add the language code as a path segment. For example: add `/nl` for Dutch.
