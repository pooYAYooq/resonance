# Convex Backend

This directory is the Resonance backend: the database, server functions, auth,
scheduled jobs, and file storage all live here. Next.js talks to it through the
generated `api`/`internal` clients.

**Before writing Convex code, read `convex/_generated/ai/guidelines.md`.** It
overrides anything you may have learned about Convex elsewhere.

## Layout

| Area                   | Files                                                                            |
| ---------------------- | -------------------------------------------------------------------------------- |
| Schema and config      | `schema.ts`, `convex.config.ts`, `tsconfig.json`                                 |
| Auth                   | `auth.ts` (Better Auth), `auth.config.ts`, `http.ts` (HTTP router)               |
| Posts and lifecycle    | `posts.ts`, `postLifecycle.ts`, `postDeletion.ts`, `postSummary.ts`              |
| Authoring media safety | `pendingUploads.ts`, `sessionMediaClaims.ts`, `writeAttempts.ts`                 |
| Discover projections   | `discover.ts`, `discoverProjection.ts`                                           |
| Engagement             | `likes.ts`, `comments.ts`, `bookmarks.ts`, `follows.ts`                          |
| Reader/author surfaces | `feed.ts`, `notifications.ts`, `analytics.ts`, `profilePostCount.ts`, `stats.ts` |
| Scheduled jobs         | `crons.ts`                                                                       |

Each non-generated module has a co-located `*.test.ts` run by `pnpm test:ci`
(edge-runtime). See `AGENTS.md` for the full command list.

## Schema Overview

- `users` — app-level identity bridged from Better Auth; denormalized follower
  counts. `posts` is the source of truth for authored content and holds the
  canonical `blocknote@1` body plus denormalized `commentCount`/`likeCount`.
- Engagement tables record one row per relationship and are indexed by both
  directions: `likes`, `commentLikes`, `bookmarks`, `follows`.
- Derived read models are maintained transactionally with the published-post
  lifecycle: `discoverPosts`, `discoverPostSearch`, `discoverPostTopics`,
  `topicStats`, `feed`, `notifications`, and `postSummary` helpers.
- Analytics uses `postViews` (one signed-in unique view per viewer key),
  `authorAnalytics`, and `followerGrowthDays`.
- Operational tables make storage safe and bounded: `pendingUploads`,
  `sessionMediaClaims`, `pendingUploadCleanupLocks`, `writeAttempts`,
  `postDeletionJobs`, `draftUploadCleanupJobs`, and the `stats` counter table.

## Conventions

- Functions use the object-form `query`/`mutation`/`action` API with explicit
  `args` validators. Public functions are owner- and viewer-checked; internal
  helpers use `internalMutation`/`internalQuery`.
- Published deletion is a bounded lifecycle operation across dependent tables
  and counters, not a single `posts` delete. It runs in scheduled batches with
  stale-job recovery.
- Never call `.paginate()` inside an already-paginated mutation (Convex rejects
  it at runtime); use bounded `.take()` reads in those paths.
- Media uploads flow through the owner/session-bound claim lifecycle so
  abandoned uploads are cleaned up without deleting live content.

Push functions to the configured deployment with `npx convex dev` (or `npx
convex deploy` in CI). `SITE_URL` and Better Auth secrets live in the Convex
dashboard environment, not `.env.local`.
