# Post Tags - Design

## Overview

Phase 1.8 (Post Tags) adds classification tags to posts. Authors select up to
five tags from a small predefined curated list when creating a post. Readers
see selected tags as clickable pills on post cards and the post detail page;
each pill links to `/blog?tag=<tag>`.

The slice is intentionally minimal: no user-created tags, tag management,
analytics, or separate tag table. The author-facing field and selector remain
reusable so the future edit-post form can update the same `tags` field.

## Decisions

### Predefined Tags

Use one canonical predefined tag list shared by the create form, Convex
mutation validation, and blog filter. The initial list should contain roughly
8-12 broad tags, with exact names finalized during implementation. Suggested
categories include `Technology`, `Design`, `Culture`, `Science`, `Business`,
`Music`, `Tutorial`, `Theory`, `Architectural`, `Landscape`, `Photography`,
`Software`, `Hardware`, `Camera`, and `Nature`.

Tag values are canonical strings. Authors choose from the list, so no casing or
spelling normalization is needed. Removing a tag from the list stops it from
being selectable for new posts but does not rewrite existing posts. Existing
posts retain stored values; a later migration may handle legacy values if
needed.

### Post Storage

Add `tags` to `posts` as an optional string array:

- Optional preserves compatibility with existing documents.
- Reads normalize missing values to `[]`.
- New posts always write a canonical array, possibly empty.
- The array contains at most five canonical tag strings.

No separate `postTags` table ships in this phase. A direct array is the
smallest correct model and keeps future author editing straightforward. If
filtering becomes expensive at larger scale, a join-table migration can retain
the same author-facing model and URL contract.

### Filtering

Extend the existing post-list query with an optional `tag` argument.

- Without `tag`, preserve the current newest-first listing.
- With `tag`, return only posts whose `tags` array contains the exact tag.
- Unknown or removed tags return an empty page, never an unfiltered listing.
- The blog route reads `searchParams.tag`, passes it to the query, displays
  the active filter, and provides a path back to the unfiltered listing.

Filtering may use a bounded paginated query with an array-membership predicate
for the current post volume. This is an accepted scalability tradeoff; a
future indexed join table is the path if the scan becomes costly.

### Create Flow

Add a checkbox group to `app/(app)/create/page.tsx` using the predefined list.

- Authors can select zero to five tags.
- Selecting or submitting a sixth tag shows validation feedback.
- There is no free-form tag entry.
- The selector model and validation are extracted for reuse by the future
  edit-post form.
- `schemas/blog.ts` validates membership and the five-tag maximum.
- `createPost` accepts `tags` and independently validates membership and count
  server-side.

### Reader-Facing Pills

Add a reusable tag-pill component and render it on:

- Shared `PostCard` components, including landing-page cards and profile cards.
- The post detail page.

Each pill links to `/blog?tag=<encoded-tag>`. `PostCard` receives `tags` and
normalizes missing values to `[]`, so older posts render without pills. The
landing page needs no separate tag implementation because it already uses the
shared card.

## Data Flow

- The blog route reads the optional `tag` search parameter and passes it to
  the server-rendered `getPosts` query.
- The query applies the optional filter and continues hydrating image URLs,
  author data, like state, and existing fields.
- `getPostById` includes the post tags for the detail page and metadata path.
- `PostCard` receives tags as an additional prop.
- The create form submits selected tags alongside title, body, and image.
- The mutation validates and persists the array.

## Testing

### Convex Tests

- Creating a post with zero, one, and five tags succeeds.
- More than five tags are rejected.
- Tags outside the predefined list are rejected.
- `getPosts` returns only matching posts for a supplied tag.
- `getPosts` returns all posts when no tag is supplied.
- Unknown or removed tags return an empty page.
- `getPostById` includes tags and normalizes legacy missing tags to `[]`.
- Untagged existing posts remain visible in the unfiltered listing.

### Component Tests

- `PostCard` renders pills with correct encoded filter links when tags exist.
- `PostCard` renders no pills for missing or empty tags.
- The post detail page renders the same pills and links.
- The blog page renders the active filter and zero-result empty state.
- The create form checkbox group enforces the five-tag maximum.

Existing authentication-path limitations around Better Auth and `convex-test`
remain unchanged. Authenticated create behavior is covered by component tests
and manual verification; filtering and unauthenticated short-circuits remain
directly testable in Convex tests.

## Non-Goals

- Post editing; only the reusable field and selector seam are prepared.
- Admin-managed tags.
- Tag counts, trending tags, dedicated tag pages, or search.
- Backfilling tags onto existing posts.
- A separate `tags` or `postTags` table.
- Indexed tag filtering in this phase.
- Unrelated blog layout or post-detail refactoring.

## Forward Pointers

- Phase 2 editing reuses the selector, validation, and `tags` field.
- A future scalability migration can introduce a `postTags` table without
  changing `/blog?tag=` or the author-facing model.
- Phase 1.9 trending or future tag pages can build on canonical values and
  stored arrays.

## Documentation and Review Gates

Implementation must update `FEATURES.md`, `README.md` project structure, and
`docs/ARCHITECTURE.md` for the tags field, query argument, pill component, and
blog filter behavior.

Before implementation, convert this design into an implementation plan. A
developer review should inspect the design and plan for Convex query behavior,
pagination stability, auth boundaries, test coverage, and documentation sync.
