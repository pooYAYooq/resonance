# Resonance Roadmap — Vertical Slices by User Journey

## Overview

Resonance is a multi-author publishing platform. The goal of this roadmap is to move from a solid but feature-thin blog toward a compelling, portfolio-worthy product with clear user value at every step.

The roadmap distinguishes delivery commitment from future ideas. Features are
classified as **Now**, **Next**, **Later**, **Deferred**, or **Shipped**. A
deferred feature remains documented and traceable, but does not block the next
phase or imply that implementation is overdue.

We will build in **four phases**, each building on the last:

0. **Phase 0 — Foundation Fix** (Completed)
1. **Phase 1 — The Reader** (Current focus)
2. **Phase 2 — The Author**
3. **Phase 3 — The Platform**

---

## Phase 0 — Foundation Fix

> Goal: Fix structural gaps before building social features. Without this, likes/profiles will feel broken (empty avatars, no user data, missing auth guards).

### Tasks

#### 0.1 Add Google + GitHub OAuth

- Configure Better Auth with Google and GitHub social providers.
- Update sign-in/sign-up pages with social login buttons.
- Store provider avatar URL and display name when available.

#### 0.2 Create `users` Table

- Add `users` table to Convex schema with fields: `userId` (Better Auth ID), `displayName`, `bio`, `avatarUrl`, `email`, `createdAt`.
- Indexes: `by_userId`, `by_displayName`, `by_email`.
- Auto-sync user record on first sign-in via Convex mutation (`syncUser`).
- Global `AuthSync` component in `ConvexClientProvider` fires `syncUser` on every auth state change.
- `authorId` in `posts` and `comments` remains `v.string()` (Better Auth user ID) — no migration to `v.id("users")`.

#### 0.3 Auth Guards

- Hide "Create" link in Navbar for unauthenticated users.
- Redirect unauthenticated users from `/create` to `/auth/login`.

#### 0.4 Schema Improvements

- Add `createdAt: v.optional(v.number())` and `updatedAt: v.optional(v.number())` to `posts` (optional for backward compatibility with existing data).
- Add `createdAt: v.optional(v.number())` to `comments` (optional for backward compatibility).
- Add `stats` table with `totalPosts` counter instead of `countPosts` loading all posts.
- Add pagination to `getCommentsByPostId` (replace `.take(500)`).
- Enrich comments with `authorAvatarUrl` from the `users` table in `getCommentsByPostId`.

#### 0.5 Code Organization

- Move page-specific components (`components/web/home/*`) to `app/(app)/_components/`.
- Move Zod schemas from `app/schemas/` to `schemas/` at root.

### Phase 0 — Completed

- [x] Directory reorganization complete (`home/` → `_components/`, `app/schemas/` → `schemas/`).
- [x] Google and GitHub OAuth buttons appear on sign-up and login pages.
- [x] Signing in with OAuth creates a `users` record with name, email, and avatar URL.
- [x] The Navbar shows the user's avatar (or initials fallback) when logged in.
- [x] Unauthenticated users do not see the "Create" link and are redirected from `/create`.
- [x] `countPosts` returns instantly via the `stats` table (not loading all posts).
- [x] Comments are paginated (not hard-limited to 500).
- [x] All new posts and comments populate `createdAt`; existing posts gracefully fall back to `_creationTime`.
- [x] `pnpm lint && pnpm test:ci && pnpm test:component && pnpm build` passes.

---

## Phase 1 — The Reader

> Goal: Make it delightful to _consume_ content. Give readers identity, power, and curation tools.

### Prerequisite: 1.0 Backward-Compat Cleanup - Done

Phase 0 introduced `createdAt`/`updatedAt` as `v.optional()` for backward compatibility with existing seed data. Before building Phase 1 features, tighten these to required:

- `convex/schema.ts`: `posts.createdAt` → `v.number()`, `posts.updatedAt` → `v.number()`, `comments.createdAt` → `v.number()`.
- `app/(app)/blog/[postId]/page.tsx`: Remove `?? post._creationTime` fallback — use `post.createdAt` directly.
- `components/web/CommentSection.tsx`: Remove `?? comment._creationTime` fallback — use `comment.createdAt` directly.

### Known Issues

- **Avatar timing on first OAuth sign-up:** On first sign-up, the Navbar avatar shows initials instead of the OAuth profile picture. The `AuthSync` component fires `syncUser` as fire-and-forget, and `getCurrentUser` may resolve before the user record exists. Fix: make `AuthSync` track sync completion before Navbar queries for user data.

### Features

Phase 1 is split into three sub-parts, ordered by priority and dependency. Each sub-part gets its own implementation plan, written just before execution.

#### Phase 1A — Identity & Engagement

Build the basics: who are readers, and how do they express appreciation?

##### 1.1 User Profiles - Start from here

- Every user gets a public profile page at `/u/[userId]`.
- Profile fields: display name, bio (max 160 chars), avatar (reuses existing `UserAvatar`).
- Profile shows: user's published posts, follower count, following count.
- Users can edit their own profile via a settings page.
- Navbar dropdown menu: profile, settings, logout (replaces current inline logout button).

##### 1.2 Likes

- Readers can like/unlike any post.
- Like count displayed on post cards and post detail.
- One like per user per post. Toggling is idempotent.
- Real-time like count updates on the post page.
- Denormalized `likeCount` on `posts` table.

##### 1.3 Comment Likes

- Extend the like pattern to comments.
- One like per user per comment. Toggling is idempotent.
- Like count displayed on each comment card.

#### Phase 1B — Curation & Connection

Build the social graph and personal curation tools.

##### 1.4 Follows

- Readers can follow/unfollow authors.
- Author profile shows follower count.
- Reader profile shows following count and list of followed authors.
- One follow per user per author.
- Denormalized `followerCount` and `followingCount` on `users` table.

##### 1.5 Bookmarks / Reading List

- Readers can bookmark posts to read later.
- "My Reading List" page at `/reading-list`.
- Bookmarks are private to the user.
- Remove bookmark from reading list or from post page.

##### 1.6 Notifications

- When an author you follow publishes a new post, you get a notification.
- Simple notification bell in the Navbar with a badge count.
- Notifications list page at `/notifications`.
- Mark all as read. Mark individual as read.
- Real-time notification count update.

##### 1.7 Reader Feed

- Personalized timeline at `/feed` showing posts only from followed authors.
- Ordered newest-first, paginated.
- Empty state encourages following authors.

#### Phase 1C — Discovery & Polish — Complete after 1.8

Make the platform feel complete and discoverable.

##### 1.8 Post Tags / Categories — Shipped

- Authors tag posts when creating/editing (e.g., "tech", "design", "tutorial").
- Readers can filter the blog listing by tag.
- Tags displayed on post cards and post detail.

##### 1.9 Trending / Popular Posts — Deferred optional feature

- Sort blog listing by like count or comment count.
- Tab toggle on `/blog`: "Latest" / "Popular".
- Leverages denormalized `likeCount` and existing `commentCount`.

##### 1.10 User Activity Feed — Deferred optional feature

- Profile page shows recent activity: "X liked Y's post", "X started following Y".
- Public on user profiles as social proof.

##### 1.11 Polish — Deferred optional feature

- **Reading Time Estimate:** Calculate from word count (avg 200 wpm), display on post cards and post detail.
- **Share Links:** Copy-to-clipboard or native Web Share API on post pages.

### Schema Additions

New tables and fields needed across Phase 1:

| Table            | Fields                                                     | Indexes                            | Purpose                             |
| ---------------- | ---------------------------------------------------------- | ---------------------------------- | ----------------------------------- |
| `likes`          | `userId`, `postId`, `createdAt`                            | `[userId, postId]` unique          | One like per user per post          |
| `commentLikes`   | `userId`, `commentId`, `createdAt`                         | `[userId, commentId]` unique       | One like per user per comment       |
| `follows`        | `followerId`, `followingId`, `createdAt`                   | `[followerId, followingId]` unique | One follow per user per author      |
| `bookmarks`      | `userId`, `postId`, `createdAt`                            | `[userId, postId]` unique          | Private reading list                |
| `notifications`  | `userId`, `type`, `postId`, `actorId`, `read`, `createdAt` | `[userId, read]`                   | "New post from followed author"     |
| `posts` (extend) | `likeCount: v.number()`, `tags: v.array(v.string())`       | —                                  | Denormalized count + categorization |
| `users` (extend) | `followerCount: v.number()`, `followingCount: v.number()`  | —                                  | Denormalized social counts          |
| `stats` (extend) | `totalUsers`, `totalComments`                              | —                                  | Extend the singleton                |

---

## Phase 2 — The Author — Next focus

> Goal: Make it rewarding to _create_ content.

### Tentative Features

1. **Rich Text Editor** — Replace the plain text `body` field with a real editor (TipTap, Lexical, or Plate). Store content as structured JSON or Markdown.
2. **Drafts & Publishing Workflow** — Posts can be `draft` or `published`. Authors see their drafts on a dashboard.
3. **Post Analytics** — Views, likes over time, follower growth. Simple charts on `/dashboard`.
4. **Author Dashboard** — `/dashboard` with drafts, published posts, analytics summary.
5. **Post Editing** — Edit published posts (creates new version or updates in place — TBD in Phase 2 design).

---

## Phase 3 — The Platform

> Goal: Make the platform self-sustaining and advanced.

### Tentative Features

1. **Admin Role & Moderation** — Admin users can hide posts, ban users. Content reports.
2. **Full-Text Search** — Search posts by title, body, author. Convex `search` or external (Algolia/Meilisearch).
3. **AI Features** — Content suggestions, post summarization, auto-tags.
4. **Subscriptions / Tipping** — Premium content gating, Stripe integration for tipping authors or subscribing.
5. **Email Digest** — Weekly digest of top posts from followed authors.

---

## Decision Log

| Date       | Decision                                               | Rationale                                                                                                                                                                                                                              |
| ---------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-03 | Vertical slices by user journey                        | Avoids building infrastructure for unused features. Each phase is portfolio-shippable.                                                                                                                                                 |
| 2026-06-03 | Phase 1 = Reader features first                        | Existing foundation (auth, posts, comments) lacks reader engagement. Easiest path to visible product improvement.                                                                                                                      |
| 2026-06-03 | Denormalized counts (followerCount, etc.)              | Convex reads are cheap; writes are where we pay. Denormalizing counts avoids aggregation queries for common UI patterns.                                                                                                               |
| 2026-06-03 | User profiles keyed by `userId` (string)               | Aligns with Better Auth's user id type. Consistent with existing `authorId` in posts/comments.                                                                                                                                         |
| 2026-06-03 | Notifications only for "new post from followed author" | Simplest real-time notification to build. Can extend types in Phase 2/3.                                                                                                                                                               |
| 2026-06-09 | `authorId` stays as `v.string()`                       | No migration to `v.id("users")`. Better Auth user IDs are strings; the `users` table is an enrichment layer keyed by `userId` string, not Convex `_id`. Avoids a breaking schema migration.                                            |
| 2026-06-09 | `createdAt`/`updatedAt` optional during Phase 0        | Backward compatibility with existing seed data. Tightened to required in Phase 1.0 prerequisite.                                                                                                                                       |
| 2026-06-09 | Comment avatar enrichment via backend join             | `getCommentsByPostId` looks up `avatarUrl` from the `users` table and returns `authorAvatarUrl` per comment. Frontend threads it through `CommentCard` → `UserAvatar`.                                                                 |
| 2026-06-09 | Profile URL: `/u/[userId]`                             | `authorId` is a string (Better Auth ID), not a slug. `/u/[userId]` is simpler and avoids a slug-uniqueness system.                                                                                                                     |
| 2026-06-10 | Phase 1 split into 3 sub-parts (1A, 1B, 1C)            | Large phase broken into independently shippable slices. 1A builds identity + engagement primitives, 1B builds social graph + curation, 1C adds discovery + polish. Each gets its own plan file.                                        |
| 2026-06-10 | Plans written one-by-one before execution              | Avoids cascading updates — each plan is written with full context of what was just built, not speculatively for all features upfront.                                                                                                  |
| 2026-06-10 | Trivial features bundled as 1.11 Polish                | Reading time estimate and share links are ~10 min each with no backend. Bundled into one task rather than separate features.                                                                                                           |
| 2026-06-14 | Added `mapProfileToUser` for Google/GitHub OAuth       | Phase 0.1 was structurally complete but missing explicit field mapping. `picture`/`avatar_url` were cast to undefined via `as string`, silently dropping avatars. Fixed post-merge via PR #35.                                         |
| 2026-08-10 | Deferred optional Phase 1C follow-ups                  | Post Tags (1.8) completes the current reader milestone. Trending, activity, and polish remain available in the backlog without blocking Phase 2; revisit them when content volume, engagement, or distribution needs justify the work. |

---

## Post-Phase 1 Success Criteria

### Phase 1A — Identity & Engagement

- [ ] A visitor can view any user's profile at `/u/[userId]` and see their posts.
- [ ] A logged-in user can edit their own profile (name, bio, avatar).
- [ ] A logged-in user can like/unlike posts, and the count updates in real time.
- [ ] A logged-in user can like/unlike comments, and the count updates in real time.
- [ ] Navbar shows a dropdown menu (profile, settings, logout) instead of inline logout.

### Phase 1B — Curation & Connection

- [ ] A logged-in user can follow/unfollow authors, and counts update in real time.
- [ ] A logged-in user can bookmark posts and view their reading list at `/reading-list`.
- [ ] A logged-in user receives a notification when a followed author publishes a post.
- [ ] A logged-in user has a personalized feed at `/feed` showing posts from followed authors.

### Phase 1C — Discovery & Polish

- [x] Authors can tag posts, and readers can filter the blog listing by tag.
- [ ] **Deferred:** Blog listing has a "Popular" tab sorted by like/comment count.
- [ ] **Deferred:** User profiles show recent activity (likes, follows).
- [ ] **Deferred:** Post cards display estimated reading time.
- [ ] **Deferred:** Post pages have a share button.

### General

- [ ] All new features have Convex tests and component tests where applicable.
- [ ] `pnpm lint && pnpm test:ci && pnpm test:component && pnpm build` passes.
