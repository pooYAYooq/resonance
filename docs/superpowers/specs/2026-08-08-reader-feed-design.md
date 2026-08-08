# Reader Feed - Design

## Overview

Phase 1.7 adds a private `/feed` for authenticated readers. The feed shows
posts from authors the reader currently follows, ordered globally by post
publication time. It is intentionally a bounded materialized view: feed rows
cover the most recent 30 days and each page returns at most 20 posts. Author
profiles continue to expose the author's complete post history.

This design follows the shipped Follows, Bookmarks, and Notifications patterns
while keeping the feed data path independent from the notifications table.

## Decisions

### Materialized feed table

Use a denormalized `feed` table with one logical row per reader/post pair:

| Field | Purpose |
|---|---|
| `userId` | Feed owner, derived from the authenticated reader identity |
| `postId` | Referenced post |
| `authorId` | Copied from the post for efficient unfollow cleanup |
| `followId` | Exact follow-row generation that authorized materialization |
| `createdAt` | Original post publication timestamp and canonical ranking field |
| `insertedAt` | Time the feed row was materialized; tie-breaker and operational diagnostic |

The logical uniqueness key is `(userId, postId)`. Convex does not provide a
declarative unique constraint for this table, so normal writes probe a
compound index before inserting. If a row exists for an older follow
generation, the current materialization patches its `followId` to the active
generation instead of skipping it; this lets a refollow reclaim a row before
the old generation's deletion can remove it. A rare concurrent check-then-
insert race is accepted; the read path deduplicates by `postId` defensively
rather than introducing locking or a second coordination system.

The indexes are:

- `by_userId_and_createdAt_and_insertedAt_and_postId` on
  `(userId, createdAt, insertedAt, postId)` for deterministic global
  chronological pagination.
- `by_userId_and_postId` on `(userId, postId)` for idempotent insertion checks.
- `by_userId_and_authorId_and_followId_and_createdAt` on
  `(userId, authorId, followId, createdAt)` for bounded, generation-safe
  deletion when a reader unfollows an author.
- `posts.by_authorId_and_createdAt` on `(authorId, createdAt)` for bounded
  30-day follow backfill.

Because `posts` is populated, the author index ships staged for asynchronous
backfill and is activated in a follow-up schema deployment before any follow
backfill function queries it.

The final Convex index `_creationTime` tie-breaker remains available, but the
application-level `insertedAt` field is explicit and stable across retries.
The canonical order is `createdAt desc`, then `insertedAt desc`, then
`postId desc`. The explicit `postId` index column makes the ordering stable
for equal timestamps while the application-level deduplication still protects
against duplicate logical rows.

### Hard cutoff and page contract

The feed window is the 30 days preceding a fixed `asOf` timestamp. New post
fan-out and follow backfill use mutation time; feed reads receive `asOf` from
the client when the feed mounts and apply `asOf - 30 days` as the lower bound.
The client keeps that value while loading more pages, preventing the window
from moving between cursors. This explicit timestamp is required because
Convex queries must not read the wall clock. Feed reads apply the cutoff so
expired rows cannot leak even before cleanup runs.

The public feed query uses Convex cursor pagination and accepts no page size
above 20. The client uses manual cursor pagination and sends both
`numItems: 20` and `maximumRowsRead: 20`; the query rejects requests that do
not carry that bounded read contract. This avoids relying on Convex's
`numItems` target behavior and preserves every consumed row under the opaque
cursor. Each page is globally ordered across all followed authors, not 20
items per author. Pagination continues through the 30-day window. The query
derives the reader identity server-side and returns an empty, completed page
when unauthenticated, matching private-list behavior in Bookmarks and
Notifications.

### Lifecycle fan-out

#### New post

`createPost` inserts the post first, then invokes an internal feed fan-out.
The fan-out scans followers using `follows.by_followingId`, writes feed rows
in bounded batches, and schedules an opaque-cursor continuation when a batch
is full. The initial batch size is 100 because each follower requires an
idempotency probe and potentially a write; it remains tunable between 100 and
500 after observing Convex transaction metrics. Before materializing, each
batch rechecks the follower relationship by its follow-row ID, so a delayed
fan-out cannot repopulate a feed after unfollow. If the `(userId, postId)` row
exists for an older follow generation, fan-out patches its `followId` to the
current relationship instead of skipping it.

The post remains the source of truth. If the nested feed fan-out fails, its
writes roll back independently while the post remains committed. The caller
logs the failure and schedules one bounded retry from the initial cursor;
operators can invoke the same idempotent fan-out again for any remaining
repair. Feed maintenance is eventually consistent, not a prerequisite for
post creation.

#### Follow

When a reader follows an author, the follow relationship and denormalized
counters are committed as they are today. The inserted follow-row ID is
passed to a separate internal, batched backfill. Each continuation verifies
that this exact follow row still exists before materializing rows, so an old
backfill stops after unfollow and cannot write into a later refollow. If a row
from an older generation is found, backfill patches its `followId` to the
current relationship. The backfill scans
`posts.by_authorId_and_createdAt` within the last 30 days and inserts missing
`(userId, postId)` feed rows. It is scheduled work so a prolific author cannot
make the follow mutation exceed transaction limits.

#### Unfollow

When a reader unfollows an author, the relationship and counters are updated
as they are today. A separate batched deletion receives the deleted follow-row
ID and removes that reader's feed rows for the author using
`by_userId_and_authorId_and_followId_and_createdAt`, restricted to that exact
follow generation. This prevents an old deletion continuation from removing
rows materialized by a later refollow, including when timestamps collide. The
current follow graph is authoritative: an unfollow removes the author's
existing feed posts once deletion batches complete and prevents future
fan-out.

#### Expiration and deletion

Feed reads enforce the cutoff immediately. A scheduled cleanup removes rows
older than 30 days in bounded batches so the materialized table does not grow
without limit. Cleanup also removes rows whose referenced post no longer
exists. Overlapping cleanup chains are permitted and idempotent: each chain
deletes only rows it observes and repeated deletion of an already-removed row
is harmless. Feed hydration still skips missing posts so cleanup lag cannot
break the feed query.

## Query and hydration

`feed.getFeed` is a public, authenticated-context query with
`paginationOptsValidator` and an `asOf` timestamp argument. It requires
`numItems === 20` and `maximumRowsRead === 20`, queries only rows for the
derived reader identity, applies both `createdAt >= asOf - 30 days` and
`createdAt <= asOf` bounds, and passes the pagination options unchanged to
`.paginate()`. The maximum-read bound
keeps each database page and hydration work bounded without discarding rows.

Hydration follows `getPosts` and `getBookmarkedPosts`: resolve image URLs,
author display data, and the reader's like state. Missing posts are omitted.
Rows with the same `postId` are collapsed during hydration to tolerate the
rare concurrent insertion race. The returned pagination cursor remains the
Convex cursor for the underlying feed query; deduplication may produce fewer
than 20 visible items in an exceptional page without attempting to rewrite
the opaque cursor. The client also deduplicates the flattened result across
all loaded pages, because a duplicate row can straddle two server cursors.

The `/feed` route uses a server component shell for metadata and a client
component for the authenticated gate and manual `useQuery` cursor pagination.
Unauthenticated visitors are redirected to `/auth/login`. The page uses the
existing post card/grid and empty-state patterns. A navigation entry is added
for authenticated readers without changing anonymous navigation behavior.

## Error handling and consistency

- Identity is always derived server-side; no feed mutation accepts a reader
  identity as an authorization argument.
- Internal fan-out, backfill, deletion, and cleanup functions are trusted only
  through their authenticated callers or scheduler references.
- All bulk operations use bounded writes and scheduler continuations. The
  initial maintenance batch is 100 rows; transaction metrics may justify a
  later value through 500.
- Feed maintenance failures do not roll back the source-of-truth post or
  follow relationship when invoked as nested work.
- Repeated work is safe through `(userId, postId)` probes and idempotent
  continuations.
- Feed availability is eventually consistent during maintenance; the next
  reactive query reflects completed batches.
- Follow/backfill and unfollow/delete operations are generation-safe: exact
  follow-row IDs authorize both materialization and deletion.

## Testing

### Convex tests

- Feed query returns an empty completed page for unauthenticated callers.
- Feed query orders posts globally by `createdAt`, respects the 30-day cutoff,
  and visibly returns no more than 20 posts per page.
- Fan-out inserts one logical row per current follower and skips ordinary
  duplicates.
- Fan-out schedules continuation work when a batch reaches the configured
  limit.
- Follow backfill includes existing posts within 30 days and excludes older
  posts.
- Unfollow deletion removes only the reader's rows for the unfollowed author
  and exact follow generation, and supports continuation batches.
- Missing posts and duplicate feed rows do not break hydration.
- Delayed backfill after unfollow, refollow during deletion, duplicate rows
  across page boundaries, and overlapping cleanup chains remain safe.

Authentication-path limitations follow the existing `convex-test` limitation
around Better Auth's `safeGetAuthUser`; unauthenticated short-circuits and
internal fan-out behavior remain directly testable, while authenticated UI
behavior is covered through component tests and manual verification.

### Component tests

- `/feed` redirects unauthenticated users.
- Authenticated users see the empty state when they follow nobody or have no
  posts in the window.
- Post cards render in one global paginated list.
- Load More requests the next cursor and never requests more than 20 items.
- The feed navigation entry is present only for authenticated readers.

## Non-goals

- No full historical feed. Full history remains on author profiles.
- No ranked or personalized scoring. Chronological ordering is the initial
  ranking; the table leaves room for a future ranking field or index.
- No notifications, activity feed, bookmarks, or follow suggestions in this
  slice.
- No declarative uniqueness or locking layer beyond idempotency probes and
  defensive read deduplication.
- No synchronous bulk backfill or deletion inside the user-facing mutation.

## Documentation and review gates

Implementation must update `FEATURES.md`, `README.md` project structure, and
`docs/ARCHITECTURE.md` for the new table, functions, route, and indexes.

Before implementation begins, the approved design must be converted into an
implementation plan. After the plan is written, a developer review gate must
inspect the design and plan for correctness, Convex transaction limits,
pagination stability, auth boundaries, test coverage, and documentation
sync. Implementation starts only after that review gate passes.
