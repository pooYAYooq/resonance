# Reader Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a private `/feed` showing the latest posts from currently followed authors, materialized for 30 days, globally ordered, and paginated in pages of at most 20 posts.

**Architecture:** Add a denormalized `feed` table keyed by reader and post. Post creation fans out rows to followers; following schedules a 30-day backfill; unfollowing schedules bounded deletion. The public query reads the authenticated reader's feed rows through a composite chronological index, using a fixed client-supplied `asOf` cutoff for stable cursor pagination.

**Tech Stack:** Convex schema, queries, mutations, scheduler, `convex-test`, Next.js Server/Client Components, Convex React `useQuery` with manual opaque-cursor pagination, existing `PostCard`, `EmptyState`, and Navbar patterns.

---

## File Map

- Create: `convex/feed.ts` - public feed query and internal fan-out, backfill, deletion, and cleanup mutations.
- Create: `convex/crons.ts` - scheduled daily expiration cleanup for materialized feed rows.
- Modify: `convex/schema.ts` - add the bounded materialized `feed` table and indexes.
- Modify: `convex/posts.ts` - trigger feed fan-out after post creation.
- Modify: `convex/follows.ts` - schedule feed backfill on follow and feed deletion on unfollow.
- Create: `convex/feed.test.ts` - feed query, idempotency, fan-out, backfill, deletion, and cleanup tests.
- Create: `app/(app)/feed/page.tsx` - private route shell and metadata.
- Create: `app/(app)/feed/_components/FeedContent.tsx` - client auth gate, pagination, empty state, and post grid.
- Create: `app/(app)/feed/_components/FeedContent.test.tsx` - route component behavior tests.
- Modify: `components/web/Navbar.tsx` - authenticated `/feed` navigation entry.
- Modify: `components/web/Navbar.test.tsx` - feed navigation visibility tests.
- Modify: `FEATURES.md` - mark 1.7 shipped and update the status board.
- Modify: `README.md` - document the feed route and backend module.
- Modify: `docs/ARCHITECTURE.md` - document the feed table, indexes, lifecycle, and route.

## Implementation Notes

- The feed table fields are `userId`, `postId`, `authorId`, `followId`, `createdAt`, and `insertedAt`.
- Add `posts.by_authorId_and_createdAt` on `posts` for bounded follow backfill. Because `posts` is populated, introduce it with `staged: true`, deploy/codegen, then remove `staged: true` in the next schema change before the backfill queries it.
- Index names and field order must be exact:
  - `by_userId_and_createdAt_and_insertedAt_and_postId`: `userId`, `createdAt`, `insertedAt`, `postId`.
  - `by_userId_and_postId`: `userId`, `postId`.
  - `by_userId_and_authorId_and_followId_and_createdAt`: `userId`, `authorId`, `followId`, `createdAt`.
- Use `FEED_WINDOW_MS = 30 * 24 * 60 * 60 * 1000`, `FEED_PAGE_SIZE = 20`, and `FEED_BATCH_SIZE = 100` in `convex/feed.ts`.
- Use `FEED_BATCH_SIZE = 100` initially; the constant may be tuned up to 500 only after transaction metrics are reviewed.
- Use `internalMutation` for maintenance functions and derive public identity with `authComponent.safeGetAuthUser(ctx)`.
- Preserve the existing nested-subtransaction behavior: post/follow source writes stay committed when maintenance fan-out fails, with the failure logged by the caller.
- Use `paginationOptsValidator` unchanged for database pagination. Require `args.paginationOpts.numItems === FEED_PAGE_SIZE` and `args.paginationOpts.maximumRowsRead === FEED_PAGE_SIZE`; reject any other page contract with `ConvexError` rather than rewriting opaque cursor options.
- The feed query receives `asOf: v.number()`. The client computes it once when the feed mounts and passes the same value while loading more pages.
- Any feed row whose post is missing is omitted from the visible page. Duplicate `postId` values are collapsed during hydration.
- `fanOutForPost` accepts `retryCount` and permits one scheduled retry from the initial cursor after a caller-side failure; retries remain idempotent.

### Task 1: Add the feed schema and constants

**Files:**
- Modify: `convex/schema.ts:19-233`
- Create: `convex/feed.ts`
- Test: `convex/feed.test.ts`

- [x] **Step 1: Add schema-focused failing tests**

Create `convex/feed.test.ts` with the `convexTest` + `import.meta.glob` setup used by existing Convex tests. Start with tests that seed feed rows and verify the table can represent two rows for different readers and the same post, and that the query exercises the three required indexes.

- [x] **Step 2: Run the focused test to establish the failure**

Run: `pnpm test:ci -- convex/feed.test.ts`

Expected: FAIL because the `feed` table and feed module do not exist yet.

- [x] **Step 3: Add the `feed` table**

In `convex/schema.ts`, add:

```ts
feed: defineTable({
  userId: v.string(),
  postId: v.id("posts"),
  authorId: v.string(),
  followId: v.id("follows"),
  createdAt: v.number(),
  insertedAt: v.number(),
})
  .index("by_userId_and_createdAt_and_insertedAt_and_postId", [
    "userId",
    "createdAt",
    "insertedAt",
    "postId",
  ])
  .index("by_userId_and_postId", ["userId", "postId"])
  .index("by_userId_and_authorId_and_followId_and_createdAt", [
    "userId",
    "authorId",
    "followId",
    "createdAt",
  ]),
```

Also add this staged post index to the existing `posts` table:

```ts
.index("by_authorId_and_createdAt", {
  fields: ["authorId", "createdAt"],
  staged: true,
})
```

Add a schema comment explaining that rows are a 30-day materialized view, not the source of truth for author history. Update the top-level schema inventory comment to include the new `feed` table.

Add a separate schema step after the staged index backfill completes: remove
`staged: true` so `backfillForFollow` can query the index. Verify the index is
queryable with `npx convex dev --once` before enabling follow backfill.

- [x] **Step 4: Add feed constants and types**

In `convex/feed.ts`, export the constants used by `posts.ts` and `follows.ts`:

```ts
export const FEED_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const FEED_PAGE_SIZE = 20;
export const FEED_BATCH_SIZE = 100;
```

Import `internalMutation` and `query` from `./_generated/server`, and import
`paginationOptsValidator` from `convex/server`, matching the existing Convex
modules. Keep all feed maintenance functions in this module. Do not add a
custom return validator; the existing codebase relies on inferred pagination
result types for hydrated post queries.

- [x] **Step 5: Run the focused tests**

Run: `pnpm test:ci -- convex/feed.test.ts`

Expected: PASS for schema setup and seeded table behavior.

- [x] **Step 6: Commit the schema foundation**

```bash
git add convex/schema.ts convex/feed.ts convex/feed.test.ts
git commit -m "feat(feed): add materialized feed schema"
```

### Task 2: Implement the paginated feed query

**Files:**
- Modify: `convex/feed.ts`
- Test: `convex/feed.test.ts`

- [ ] **Step 1: Add query behavior tests**

Cover these cases:

```ts
it("returns an empty completed page without auth", async () => {
  const result = await t.query(api.feed.getFeed, {
    asOf: NOW,
    paginationOpts: { numItems: 20, maximumRowsRead: 20, cursor: null },
  });
  expect(result.page).toEqual([]);
  expect(result.isDone).toBe(true);
});

it("uses one global chronological page and excludes expired rows", async () => {
  // Seed rows for multiple authors and readers with createdAt values both
  // inside and outside NOW - FEED_WINDOW_MS; assert the page is global,
  // descending by createdAt, and contains no expired row.
});

it("does not include posts newer than the fixed asOf timestamp", async () => {
  // Seed one row at NOW + 1 and one row at NOW - 1; assert only the latter
  // is returned when asOf is NOW.
});

it("rejects an unbounded page contract", async () => {
  await expect(
    t.query(api.feed.getFeed, {
      asOf: NOW,
      paginationOpts: { numItems: 21, maximumRowsRead: 21, cursor: null },
    }),
  ).rejects.toThrow("Feed pages must request exactly 20 rows");
});
```

Use the existing authenticated test setup or direct internal seed setup where Better Auth cannot be mocked; document the auth limitation in the test as existing tests do.

- [x] **Step 2: Run the focused tests and confirm failure**

Run: `pnpm test:ci -- convex/feed.test.ts`

Expected: FAIL because `api.feed.getFeed` is not implemented.

- [x] **Step 3: Implement `getFeed`**

Implement `getFeed` with args `{ asOf: v.number(), paginationOpts: paginationOptsValidator }`.

1. Return `{ page: [], isDone: true, continueCursor: "" }` or the project-compatible completed pagination shape when `safeGetAuthUser` returns no identity.
2. Throw `new ConvexError("Feed pages must request exactly 20 rows")` unless both `numItems` and `maximumRowsRead` equal `FEED_PAGE_SIZE`.
3. Query `feed` with `by_userId_and_createdAt_and_insertedAt_and_postId`, constrain `userId`, apply both `createdAt >= asOf - FEED_WINDOW_MS` and `createdAt <= asOf`, order descending, and pass `args.paginationOpts` unchanged to `.paginate()`.
4. Hydrate each row by loading its post, resolving `imageUrl`, author profile data, and current reader `isLiked` state using the existing `likes.by_postId_and_userId` index.
5. Skip missing posts and deduplicate by `postId` before returning the page.
6. Hydrate the bounded raw page and deduplicate by `postId`; do not slice the page after pagination because every consumed row must remain represented by the returned opaque cursor.
7. Return the pagination metadata from the underlying result without fabricating a new cursor.

- [x] **Step 4: Run the query tests**

Run: `pnpm test:ci -- convex/feed.test.ts`

Expected: PASS for unauthenticated behavior, cutoff, ordering, page cap, hydration, and missing-post handling.

- [x] **Step 5: Commit the query**

```bash
git add convex/feed.ts convex/feed.test.ts
git commit -m "feat(feed): add paginated feed query"
```

### Task 3: Implement post fan-out and follow backfill

**Files:**
- Modify: `convex/feed.ts`
- Modify: `convex/posts.ts:8-68`
- Modify: `convex/follows.ts:40-110`
- Test: `convex/feed.test.ts`
- Test: `convex/posts.test.ts`
- Test: `convex/follows.test.ts`

Before enabling follow backfill, deploy the schema with
`posts.by_authorId_and_createdAt` staged, wait for its backfill to complete,
then remove `staged: true` in a follow-up schema change and run
`npx convex dev --once` again. Do not deploy or schedule code that queries the
author index while it remains staged; Convex rejects staged-index queries.

- [x] **Step 1: Add failing fan-out and backfill tests**

Test that:

- One new post creates one feed row for every current follower and none for the author unless the author follows themself, which the existing follow mutation prohibits.
- A second invocation does not create ordinary duplicates for the same `(userId, postId)`.
- A full batch schedules a continuation with the opaque follow-table cursor.
- Follow backfill inserts only posts with `createdAt >= now - FEED_WINDOW_MS`.
- Backfill is idempotent when invoked twice.

Use direct internal mutation calls for maintenance functions, matching `notifications.test.ts`, and seed posts/follows directly where authentication cannot be mocked.

- [x] **Step 2: Run the tests and confirm failure**

Run: `pnpm test:ci -- convex/feed.test.ts convex/posts.test.ts convex/follows.test.ts`

Expected: FAIL because feed maintenance functions and lifecycle calls do not exist.

- [x] **Step 3: Implement batched post fan-out**

Add an internal mutation named `fanOutForPost` with validated args
`{ postId, authorId, paginationOpts, retryCount }`. The first call uses
`retryCount: 0`; the retry uses `retryCount: 1` and no further retry is
scheduled.

1. Load the post and return if it no longer exists or its `createdAt` is outside the current 30-day materialization window.
2. Read followers with `follows.by_followingId` and `paginate(args.paginationOpts)`.
3. For each follower, load the follower row by its returned follow-row ID and skip it if the relationship was deleted. Then probe `feed.by_userId_and_postId`; insert only if absent with the post's `authorId`, the follower row's `_id` as `followId`, the post's `createdAt`, and `insertedAt: Date.now()`. If an existing row has a different `followId`, patch it to the current follower row ID instead of skipping it.
4. When `isDone` is false, schedule the same internal mutation with `continueCursor`; otherwise return completion metadata for tests.

Keep the batch size at `FEED_BATCH_SIZE` and pass `{ numItems: FEED_BATCH_SIZE, cursor: null }` from the caller. This relationship recheck makes delayed fan-out safe after unfollow.

- [x] **Step 4: Trigger fan-out from `createPost`**

Import `internal` and `FEED_BATCH_SIZE` in `convex/posts.ts`. After the stats increment, invoke the feed fan-out in the existing protected maintenance section. Keep post creation successful if feed fan-out throws, log `feed.fanOutForPost failed` consistently with the notifications log, and schedule one retry with the initial cursor and `retryCount: 1`. Add tests for the failure scheduling contract where the Convex test scheduler supports inspection.

- [x] **Step 5: Implement batched follow backfill**

Add an internal mutation named `backfillForFollow` with validated args
`{ userId, authorId, followId, cutoffAt, paginationOpts }`.

1. Load `follows` by `followId`; return immediately if that exact relationship no longer exists.
2. Query `posts.by_authorId_and_createdAt` for `authorId`, constrain `createdAt >= cutoffAt`, order descending, and paginate with the supplied options.
3. Probe `feed.by_userId_and_postId`; insert missing rows with the original post `authorId`, the validated `followId`, the original post `createdAt`, and current `insertedAt`, or patch an existing older-generation row's `followId` to the current `followId`.
4. Schedule the continuation with the same `followId` when needed.

- [x] **Step 6: Schedule backfill from `toggleFollow`**

Capture the ID returned by the follow-row insert. On the existing follow-insert branch, after the relationship and counter patches, schedule `internal.feed.backfillForFollow` with `userId: authUser._id`, `authorId: args.followingId`, `followId`, `cutoffAt: Date.now() - FEED_WINDOW_MS`, and the first posts cursor. Do not schedule it on unfollow. Add a test that a delayed backfill exits after the exact follow row is deleted.

- [x] **Step 7: Run lifecycle tests**

Run: `pnpm test:ci -- convex/feed.test.ts convex/posts.test.ts convex/follows.test.ts`

Expected: PASS for fan-out, continuation scheduling, follow backfill, idempotency, and source-write behavior.

- [x] **Step 8: Commit lifecycle maintenance**

```bash
git add convex/feed.ts convex/feed.test.ts convex/posts.ts convex/posts.test.ts convex/follows.ts convex/follows.test.ts
git commit -m "feat(feed): materialize posts for followers"
```

### Task 4: Implement unfollow deletion and expiration cleanup

**Files:**
- Modify: `convex/feed.ts`
- Modify: `convex/follows.ts:86-108`
- Create: `convex/crons.ts`
- Test: `convex/feed.test.ts`
- Test: `convex/follows.test.ts`

- [x] **Step 1: Add failing deletion and cleanup tests**

Cover:

- Unfollow deletion removes only rows matching the reader and unfollowed author.
- Rows for other authors or other readers remain.
- A full deletion batch schedules a continuation.
- Cleanup deletes rows older than the supplied cutoff in bounded batches.
- Cleanup deletes dangling rows whose post no longer exists.
- Overlapping cleanup continuations are safe and idempotent.
- Cleanup deletes dangling rows whose post no longer exists.
- Overlapping cleanup continuations are safe and idempotent.

- [x] **Step 2: Run the focused tests and confirm failure**

Run: `pnpm test:ci -- convex/feed.test.ts convex/follows.test.ts`

Expected: FAIL because deletion and cleanup functions are not implemented.

- [x] **Step 3: Implement `deleteForUnfollow`**

Add an internal mutation with `{ userId, authorId, followId, paginationOpts }` that queries `by_userId_and_authorId_and_followId_and_createdAt`, deletes only rows matching the exact `followId`, and schedules itself with the returned cursor until `isDone` is true. The follow-row ID prevents an old deletion chain from removing rows created by a later refollow.

- [x] **Step 4: Schedule deletion from `toggleFollow`**

On the existing `existingFollow` branch, capture `existingFollow._id` before deleting the follow row. Schedule `internal.feed.deleteForUnfollow` with the authenticated user, target author, exact `followId: existingFollow._id`, and `{ numItems: FEED_BATCH_SIZE, cursor: null }` after deleting the follow row and patching counters. Keep the mutation source write committed if the scheduled maintenance later fails.

- [x] **Step 5: Implement expiration cleanup**

Add an internal `cleanupExpired` mutation with validated args
`{ cutoffAt, paginationOpts }`. Query the feed table's built-in creation-time
index in ascending order and paginate in `FEED_BATCH_SIZE` chunks. Delete rows
whose `createdAt < cutoffAt` or whose referenced post no longer exists, then
schedule the next page until the scan is done. This scan is intentionally
bounded per transaction; the daily job may walk newer rows created after
backfill before reaching older materialized rows. Overlapping daily chains are
safe because each delete is conditional on the row still existing. Avoid
reading wall-clock time inside the query; the scheduler caller supplies
`cutoffAt`.

- [x] **Step 6: Register daily cleanup**

Create `convex/crons.ts` with a `cronJobs()` declaration and an internal
`runFeedCleanup` mutation. Register one daily `crons.interval` job that calls
`internal.crons.runFeedCleanup` with `{}`. The mutation computes
`Date.now() - FEED_WINDOW_MS` in mutation runtime and invokes
`internal.feed.cleanupExpired` with `{ cutoffAt, paginationOpts: { numItems:
FEED_BATCH_SIZE, cursor: null } }` through `ctx.runMutation`.

- [x] **Step 7: Run tests**

Run: `pnpm test:ci -- convex/feed.test.ts convex/follows.test.ts`

Expected: PASS for deletion isolation, continuation behavior, cleanup, and idempotency.

- [x] **Step 8: Commit cleanup behavior**

```bash
git add convex/feed.ts convex/feed.test.ts convex/follows.ts convex/follows.test.ts convex/crons.ts
git commit -m "feat(feed): clean materialized rows on unfollow"
```

### Task 5: Build the private feed route and navigation

**Files:**
- Create: `app/(app)/feed/page.tsx`
- Create: `app/(app)/feed/_components/FeedContent.tsx`
- Create: `app/(app)/feed/_components/FeedContent.test.tsx`
- Modify: `components/web/Navbar.tsx`
- Modify: `components/web/Navbar.test.tsx`

- [x] **Step 1: Add component tests first**

Mock `useConvexAuth`, `useQuery`, `useRouter`, and the generated feed API following `NotificationsList.test.tsx` and `Navbar.test.tsx`. Test:

- unauthenticated users are redirected to `/auth/login`;
- authenticated users see the empty state for an empty page;
- cards render from one global page;
- Load More appears only when `status === "CanLoadMore"`;
- the query is called with `{ asOf, paginationOpts }`, `numItems: 20`, and `maximumRowsRead: 20`;
- duplicate post IDs are rendered only once across loaded pages;
- loading auth state neither redirects nor starts the feed query;
- Navbar shows `/feed` only in the authenticated navigation branch.

- [x] **Step 2: Run component tests and confirm failure**

Run: `pnpm test:component -- app/(app)/feed/_components/FeedContent.test.tsx components/web/Navbar.test.tsx`

Expected: FAIL because the feed route/component and navigation entry do not exist.

- [x] **Step 3: Implement `FeedContent`**

Create a client component that:

1. Uses `useConvexAuth` and redirects unauthenticated users to `/auth/login`.
2. Preserves the existing loading guard before redirecting, so an unresolved auth state does not redirect prematurely.
3. Computes `const asOf = useState(() => Date.now())[0]` once on mount.
4. Uses `useQuery(api.feed.getFeed, isAuthenticated ? { asOf, paginationOpts: { numItems: 20, maximumRowsRead: 20, cursor } } : "skip")` with local `cursor`, `pages`, and `isDone` state. The first cursor is `null`; Load More sets the next cursor from `continueCursor`.
5. Appends returned pages and deduplicates by `postId` before rendering.
6. Renders loading skeletons, `EmptyState`, hydrated posts through the existing `PostCard`, and a 20-item Load More button.
7. Preserves the same `asOf` value and bounded pagination options for every cursor request.

- [x] **Step 4: Implement the route shell**

Create `app/(app)/feed/page.tsx` as a Server Component with metadata `{ title: "Feed", robots: { index: false, follow: false } }` and render `<FeedContent />`. Keep auth gating in the client component, matching Notifications and Reading List.

- [x] **Step 5: Add Navbar navigation**

Add an authenticated `/feed` link using the existing Navbar styles and icons. Keep anonymous and loading branches unchanged. Add assertions to `Navbar.test.tsx` for visibility and route destination.

- [x] **Step 6: Run component tests**

Run: `pnpm test:component -- app/(app)/feed/_components/FeedContent.test.tsx components/web/Navbar.test.tsx`

Expected: PASS for auth gating, fixed cutoff, pagination, empty state, and navigation.

- [x] **Step 7: Commit the route**

```bash
git add "app/(app)/feed" components/web/Navbar.tsx components/web/Navbar.test.tsx
git commit -m "feat(feed): add private reader feed"
```

### Task 6: Synchronize documentation

**Files:**
- Modify: `FEATURES.md`
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`

- [x] **Step 1: Update the roadmap**

Mark Phase 1.7 Reader Feed complete in `FEATURES.md`, move the next-work marker to the next planned Phase 1C item, and add the implemented feed behavior: `/feed`, current follows, 30-day materialization, global chronological pagination, 20-item pages, and batched lifecycle maintenance.

- [x] **Step 2: Update README structure**

Add `app/(app)/feed/`, `convex/feed.ts`, and the feed’s purpose to the project structure and feature summary. Do not describe the feed as full historical author content.

- [x] **Step 3: Update architecture reference**

Document the `feed` table and all three indexes, the fan-out/backfill/unfollow/cleanup lifecycle, the fixed `asOf` cursor contract, the client-gated route, and the eventual-consistency failure model. Remove any language implying that 1.7 is only planned once this feature is shipped.

- [x] **Step 4: Format and inspect docs**

Run: `pnpm exec prettier --check FEATURES.md README.md docs/ARCHITECTURE.md`

Expected: all three files pass. Inspect `git diff --check` and verify every newly referenced tracked path exists.

- [x] **Step 5: Commit documentation**

```bash
git add FEATURES.md README.md docs/ARCHITECTURE.md
git commit -m "docs: document reader feed"
```

### Task 7: Full verification and developer review gate

**Files:**
- Verify: all changed files from Tasks 1-6
- Verify: `convex/_generated/api.d.ts` and `convex/_generated/dataModel.d.ts`

- [ ] **Step 1: Regenerate Convex types**

Run: `npx convex dev --once`

Expected: Convex code generation completes without schema or function errors.
Verify that `convex/_generated/api.d.ts` includes the `feed` and `crons`
modules and that `convex/_generated/dataModel.d.ts` includes the `feed` table
and `followId` field. Verify the exact index names and field order in
`convex/schema.ts` and by confirming the staged author index becomes queryable
after the staged-index deploy; generated data-model types do not enumerate
index names. Do not hand-edit generated files.

- [x] **Step 2: Run lint**

Run: `pnpm lint`

Expected: PASS with no new warnings or errors attributable to the feed.

- [x] **Step 3: Run backend tests**

Run: `pnpm test:ci`

Expected: PASS, including all feed and existing Convex tests.

- [x] **Step 4: Run component tests**

Run: `pnpm test:component`

Expected: PASS, including the feed route and Navbar tests.

- [ ] **Step 5: Run build**

Run: `pnpm build`

Expected: PASS with generated Convex API types and Next.js type checking complete.

- [ ] **Step 6: Perform the developer review gate**

Review the full branch diff against `main` for:

- feed row idempotency and the accepted race behavior;
- index field order and stable cursor semantics;
- no wall-clock reads inside Convex queries;
- no user identity accepted as an authorization argument;
- transaction limits and scheduler continuation correctness;
- immediate read cutoff and 30-day materialization boundary;
- unfollow deletion isolation;
- missing-post and duplicate-row hydration behavior;
- 20-item global page cap;
- component test coverage and docs synchronization.

Record findings before implementation is considered complete. Any finding must be fixed and re-verified with the relevant focused test and the full CI order above.

- [ ] **Step 7: Inspect final status and diff**

Run: `git status --short --branch`, `git diff main...HEAD --stat`, and `git log --oneline --decorate -10`.

Expected: only intended Phase 1.7 files and commits are present, with no generated secrets or unrelated edits.
