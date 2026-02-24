# Story media assets plan

## Goal

Update assets UI + API to support relation-select-single title columns with options derived from accessible assets across all stories the user can access. Also extend assets GET endpoint to return all accessible assets when `storyId === '-'`.

## Context

- Assets page UI: [`src/routes/(app)/(authenticated)/edit/(role:editor|admin)/stories/[storyId]/assets/+page.svelte`](<src/routes/(app)/(authenticated)/edit/(role:editor|admin)/stories/[storyId]/assets/+page.svelte>)
- Assets page load: [`src/routes/(app)/(authenticated)/edit/(role:editor|admin)/stories/[storyId]/assets/+page.server.ts`](<src/routes/(app)/(authenticated)/edit/(role:editor|admin)/stories/[storyId]/assets/+page.server.ts>)
- Assets API: [`src/routes/api/(authenticated)/(role:editor|admin)/stories/[storyId]/assets/+server.ts`](<src/routes/api/(authenticated)/(role:editor|admin)/stories/[storyId]/assets/+server.ts>)
- Reference relation-select-single usage: [`src/routes/(app)/(authenticated)/edit/(role:editor|admin)/stories/[storyId]/permissions/+page.svelte`](<src/routes/(app)/(authenticated)/edit/(role:editor|admin)/stories/[storyId]/permissions/+page.svelte:28>)

## Decisions / assumptions

- When `storyId === '-'`, the assets API returns all accessible assets for the user, using the same asset shape as the current per-story response.
- The assets page load will call the assets API with `storyId === '-'` to build option lists for `relation-select-single` cells:
  - `allAvailableVideos`
  - `allAvailableAnnouncementTemplates`
  - `allAvailableQuizTemplates`
- The assets page UI will use those lists to build `options` per asset type for the title column, swapping to `relation-select-single`.
- Bind relation fields to asset id fields: `videoId`, `announcementTemplateId`, `quizTemplateId`.
- Sort aggregated assets by title.

## Planned changes

### 1) Assets API GET: return all accessible assets when `storyId === '-'`

- Update [`+server.ts`](<src/routes/api/(authenticated)/(role:editor|admin)/stories/[storyId]/assets/+server.ts:54>) GET handler logic:
  - If `storyId === '-'`, skip `canModifyStory` / `ensureTargetStory` and instead compute all assets where the user has access through story permissions (owner/editor) or admin.
  - Reuse `listPermittedStoryIds` to obtain allowed story IDs; if admin, return all assets scoped to client.
  - For each asset type, gather assets from all permitted stories, de-dupe by asset id, and return items with `assetType` + `asset` fields (the same shape currently returned for per-story). Sorting can remain by link id or updatedAt, but define deterministic order for the aggregated list.
- Keep existing behavior when `storyId !== '-'`.

### 2) Assets page server load: fetch all-accessible assets and expose relations

- Update [`+page.server.ts`](<src/routes/(app)/(authenticated)/edit/(role:editor|admin)/stories/[storyId]/assets/+page.server.ts:22>):
  - Add an additional fetch to `/api/stories/-/assets?type=video|announcement|quiz` to retrieve all accessible assets.
  - Map results into `allAvailableVideos`, `allAvailableAnnouncementTemplates`, `allAvailableQuizTemplates` arrays with `{ id, title, ... }` based on `asset`.
  - Return these arrays under `relations` (or a new top-level property) alongside existing `assets` payload.

### 3) Assets page UI: relation-select-single title column

- Update [`+page.svelte`](<src/routes/(app)/(authenticated)/edit/(role:editor|admin)/stories/[storyId]/assets/+page.svelte:21>):
  - Add `relations` derived from `data` and option builders similar to the permissions page.
  - Replace the `title` column to use `relation-select-single` with options based on asset type:
    - Videos: `allAvailableVideos` -> `{ title: asset.title ?? '?', summary?: asset.source, value: asset.id }`
    - Announcements: `allAvailableAnnouncementTemplates` -> `{ title: asset.title ?? '?', summary?: asset.headline, value: asset.id }`
    - Quizzes: `allAvailableQuizTemplates` -> `{ title: asset.title ?? '?', summary?: asset.doRandomize, value: asset.id }`
  - Ensure row type includes the new relation id fields (e.g., `videoId`, `announcementTemplateId`, `quizTemplateId`) and use `accessorKey` that matches payload from API.

## Open questions

- None.
