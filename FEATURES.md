# Resonance — Features & Roadmap

> The living roadmap: what's shipped, what's next, and the idea backlog.
>
> **Update rule:** when a feature ships, update its status here (see the
> "Documentation" section in `AGENTS.md`). Detailed phase designs and
> implementation plans live in `docs/superpowers/specs|plans/` (local,
> untracked, and intentionally not gitignored). Human staging review prevents
> these development artifacts from being committed.

**Stack:** Next.js 16 (App Router) + TypeScript + Convex + Better Auth + Tailwind CSS v4 + shadcn/ui

**Purpose:** A multi-author publishing platform where users write posts and readers engage through likes, comments, and follows.

---

## Status Board

Feature status is managed with five labels:

- **Now** — actively being implemented.
- **Next** — the next agreed delivery focus.
- **Later** — planned, but not scheduled.
- **Deferred** — intentionally postponed; revisit when its trigger is met.
- **Shipped** — available in the product.

| Phase                               | Goal                                                                    | Status      |
| ----------------------------------- | ----------------------------------------------------------------------- | ----------- |
| Phase 0 — Foundation Fix            | `users` table, OAuth, auth guards, schema hardening                     | ✅ Complete |
| Phase 1.0 — Backward-compat cleanup | `createdAt`/`updatedAt` tightened to required                           | ✅ Complete |
| Phase 1A — Identity & Engagement    | 1.1 Profiles ✅ · 1.2 Likes ✅ · 1.3 Comment Likes ✅                   | ✅ Complete |
| Phase 1B — Curation & Connection    | 1.4 Follows ✅ · 1.5 Bookmarks ✅ · 1.6 Notifications ✅ · 1.7 Feed ✅  | ✅ Complete |
| Phase 1C — Discovery & Polish       | 1.8 Tags ✅; 1.9–1.11 deferred optional features                        | ✅ Complete |
| Phase 2 — The Author                | Editor, drafts, editing, private analytics, and dashboard visualization | ✅ Complete |
| Phase 3A.0 — UX Correctness         | Public reading, auth returns, viewer state, publishing, honest claims   | ✅ Complete |
| Phase 3A.1 — Product Structure      | Shells, navigation, reader utilities, Profile/Settings, analytics       | ✅ Shipped  |
| Phase 3A.2 — Discover Foundations   | Search, Topics, Latest, Feed recovery; Hot after ranking is defined     | 🔵 Next     |
| Phase 3A.3 — Writing & Management   | Writing environment, review/publish, management, deletion               | 🟡 Later    |
| Phase 3A.4 — Identity & Engagement  | Profiles, Notifications, collections, contextual post presentation      | 🟡 Later    |
| Phase 3A.5 — Visual System & Polish | Typography, color, density, states, responsive interaction              | 🟡 Later    |
| Phase 3 — The Platform              | Moderation, AI, subscriptions, digest                                   | 🟡 Later    |

**Roadmap decision:** Phase 1C is complete with 1.8. Items 1.9–1.11 remain
documented as optional features and are not current delivery commitments.
They should be promoted to **Next** only after there is enough content and
engagement data, or a clear product need for them.

Phase 2 includes the shipped editor, draft lifecycle, private author dashboard,
owner-scoped published editing, private analytics totals, and the four-card
analytics dashboard with its dense 30-day follower-growth chart. Phase 3A.0 and
Phase 3A.1 are shipped; Phase 3A.2 — Discover Foundations is the sole current
delivery focus. The approved Phase 3A target direction, scope map, delivery
slices, sequencing rules, and deferrals are maintained in
[`docs/PHASE_3A.md`](docs/PHASE_3A.md). Section 18 scope areas are not a rigid
implementation order.

**Known issue:** on first OAuth sign-up, the Navbar avatar shows initials
instead of the provider picture until the user record sync completes
(`AuthSync` fires `syncUser` as fire-and-forget).

- Better Auth uses its installed 1.5.3 defaults: a finite seven-day session
  expiry with a one-day sliding refresh. Resonance has no custom `session`
  configuration or client inactivity logout timer.

---

## Currently Implemented

### Authentication

- Email/password **and** Google/GitHub OAuth via Better Auth (runs inside Convex)
- `AuthSync` bridges Better Auth identity into the app-level `users` table on sign-in
- Navbar avatar dropdown (profile / settings / logout); `/create` is auth-gated

### Blog Posts

- Create posts with title, body, and optional cover image (Convex storage)
- Create posts with block-level inline images through the BlockNote editor;
  uploads require nonblank alt text, support optional captions, and store
  canonical Convex Storage IDs separately from the cover-image flow
- Post bodies use the canonical `blocknote@1` structured document format,
  validated at both the browser form and the Convex write boundary
- Paginated listing at `/blog` (server-rendered); post detail at `/blog/[postId]` with dynamic OG metadata
- Denormalized `commentCount` and `likeCount` on posts; O(1) total via `stats` table
- Curated tags on posts (up to five from a shared fifteen-value list), clickable
  tag pills, and exact `/blog?tag=<tag>` filtering

### Drafts & Publishing

- Authenticated authors can save incomplete structured posts as private drafts
  and update them through the owner-scoped `saveDraft` mutation
- `/dashboard/drafts` lists the current author's drafts with excerpts, tags,
  last-updated dates, resume links, and delete actions
- Resuming a draft opens `/create?draftId=<id>` with its content, tags, and
  images hydrated into the editor
- Publishing validates the stored draft, transitions it to `published`, and
  triggers published-only feed and notification fan-out
- Authors can edit published posts in place through `/create?editPostId=<id>`;
  edits preserve the post ID, publication time, engagement records, bookmarks,
  and feed position while advancing `updatedAt`
- Public readers, likes, bookmarks, comments, notifications, and feed rows do
  not expose or act on drafts
- Public post details show `publishedAt` and show `updatedAt` only after an edit

### Likes

- `toggleLike` — idempotent, one like per user per post, records in a separate `likes` table
- `LikeButton` on post cards and the post detail page; `likeCount` denormalized on posts
- `/liked` is a private, client-gated reader collection of the current user's liked posts
- `toggleCommentLike` — idempotent, one like per user per comment, records in a separate `commentLikes` table
- `CommentLikeButton` on each `CommentCard`; `likeCount` denormalized on comments; shared `LikeToggle` primitive powers both post and comment like buttons

### Comments

- Paginated comments ("Load More"), auth required to post
- Comment cards enriched with author avatars from the `users` table

### Follows

- `toggleFollow` — idempotent, one follow per user per author, records in a separate `follows` table
- `FollowButton` and `ProfileActionButton` on author profiles (consolidates Edit Profile + Follow into one `rightAction` slot)
- Denormalized `followerCount` and `followingCount` on `users`; `ProfileStats` row on profile headers subscribes to `getFollowCounts` and bumps live
- `isFollowing` query drives the initial button state; `getFollowCounts` drives the reactive stats row
- Two indexes: `by_followerId_and_followingId` (1.4) for the "is X following Y?" check, `by_followingId` (1.6) for the notification fan-out's ordered scan

### Bookmarks

- `toggleBookmark` — idempotent, one bookmark per user per post, records in a separate `bookmarks` table
- `BookmarkButton` on post cards and the post detail page; private, so no denormalized count on `users` or `posts`
- Server-rendered post reads hydrate initial bookmark state with
  `fetchAuthQuery`; bookmark controls continue to reconcile with their private
  live query after auth resolution
- `/saved` is a private, client-gated reader collection with a paginated grid
  of saved posts; unbookmarking from the list removes the card immediately

### Notifications

- `internal.notifications.fanOutForPost` — called after `publishPost`, inserts one row per follower in batches via `.paginate(args.paginationOpts)` with scheduler continuation via the `follows.by_followingId` index
- `users.unreadNotificationCount` denormalized counter; `getUnreadCount` is a single O(1) read for the bell badge
- `NotificationBell` in the Navbar, auth-only, left of the avatar
- `/notifications` page, client-gated, paginated, marks all read on visit
- `markAllRead` resets the counter; rows remain as visual history

### Reader Feed

- `/feed` is a private, client-gated route showing posts from the reader's current follows
- A 30-day materialized `feed` table provides one globally ordered stream across authors
- Pages contain at most 20 posts and use a fixed `asOf` cutoff for stable cursor pagination
- Post fan-out, follow backfill, unfollow deletion, and daily expiration cleanup run in bounded scheduled batches

### Profiles & Settings

- Public profiles at `/u/[userId]`: avatar, display name, bio, paginated post list
- `/profile/edit` owns display name and bio for the public identity; `/settings`
  owns Appearance and Account configuration. Provider avatar and email remain
  contextual/read-only where shown.
- OAuth avatars mapped from provider profiles (Google `picture` / GitHub `avatar_url`), DiceBear fallback

### UI/UX

- Landing page sections in `app/(marketing)/_components/`: Hero, Features,
  Recent Posts (Suspense + content-shaped skeleton), Stats
- Shared `PostCard` across blog listing, landing, and profile pages
- `EmptyState` and `SectionHeading` primitives; `FooterCTA` remains limited to
  the legacy footer variant and is not rendered by the workspace shell
- Dark/light/system theme toggle; toast notifications (Sonner)
- SEO phase 1: per-page metadata, OG/Twitter tags, dynamic post metadata, `noindex` auth pages

---

## Backlog

Each item: essence + rough effort. Phase-numbered items are specified in the
roadmap design doc; "Unscheduled" items are not yet in the phase roadmap.

### Phase 1B — Curation & Connection

- **1.4 Follows** ✅ — follow/unfollow authors; denormalized `followerCount`/`followingCount` on `users`. _Medium._ Ships a `by_followingId` index that 1.6 notifications and the 1.7 feed reuse; later phases build on what 1.4 shipped and must not duplicate the follow relationship.
- **1.5 Bookmarks / Saved Posts** ✅ — private bookmarks at `/saved`.
  _Medium._ Unrelated to `follows`; new `bookmarks` table mirroring `likes`,
  **no** denormalized count on `users` (bookmarks are private). The shared
  `LikeToggle` primitive is the ready seam (Phase 1.3 key decision).
  `BookmarkButton` receives its initial state from server-rendered reads via
  `fetchAuthQuery` and keeps it reconciled with a client-side subscription.
- **1.6 Notifications** ✅ — bell in Navbar + `/notifications` when a followed author publishes. _Medium-High._ Fan-out after `publishPost` via `ctx.scheduler.runAfter(0, internal.notifications.fanOutForPost, ...)`; uses the `follows.by_followingId` index for ordered scanning. 1.7's feed strategy is its own first-class design decision; 1.6 only shares the `by_followingId` index, not the feed data path.

### Deferred Phase 1C — Optional Discovery & Polish

- **1.8 Post Tags** ✅ **Shipped** — `tags` array on posts, tag pills, filter `/blog?tag=`. _Medium._
- **1.9 Trending / Popular** — **Deferred** — "Latest" / "Popular" tabs on `/blog` via `likeCount`/`commentCount`. Revisit when the site has enough posts and engagement for ranking to be useful. _Low._
- **1.10 User Activity Feed** — **Deferred** — recent activity ("X liked Y's post") on profiles. Revisit when profiles have enough activity to avoid a noisy or empty feed and privacy rules are defined. _Medium._
- **1.11 Polish** — **Deferred** — reading-time estimate (~200 wpm) on cards/detail; share links (copy-to-clipboard / Web Share API). Consider share links independently when distribution becomes a priority. _Low._

### Phase 2 — The Author

1. **2.1 Rich Text Editor Foundation** — replace the plain-text body with a structured editor and define the canonical content format. ✅ Shipped
2. **2.2 Inline Image Support** — upload block-level images to Convex Storage, publish canonical storage IDs, and support required alt text plus optional captions. ✅ Shipped
3. **2.3 Structured Content Publishing** — harden the structured-content contract end to end: posts use validated `blocknote@1` documents at both the form and the Convex write boundary, and card/metadata excerpts never expose serialized JSON. ✅ Shipped
4. **2.4 Drafts & Publishing Workflow** — add `draft`/`published` status, save drafts, resume editing, and publish intentionally. ✅ Shipped
5. **2.5 Author Dashboard** — add `/dashboard` with drafts, published posts, and author actions. ✅ Shipped
6. **2.6 Post Editing** — allow authors to edit drafts and published posts with ownership checks. ✅ Shipped
7. **2.7 Analytics Foundation** — records one signed-in unique view per published post and privately summarizes author unique views, likes received, current followers, and 30-day follower growth. ✅ Shipped
8. **2.8 Analytics Dashboard UI** — add four summary cards and an accessible, presentation-only 30-day follower-growth chart to the dashboard. ✅ Shipped

#### Deferred Editor Polish

- **Undo/Redo Controls** — add visible editor controls and decide whether they belong in the formatting toolbar or a compact history toolbar. _Low._
- **Editor Keyboard Navigation** — improve focus management and keyboard navigation for slash menus and floating formatting menus. _Medium._
- **Editor Interaction Polish** — improve menu focus, shortcut discoverability, accessible labels, and mobile behavior. _Medium._

Phases 2.2 and 2.3 did not include drafts, post editing, paragraph-inline
images, or general storage garbage collection. Those remain separate
author-workflow scope items.

### Phase 3 — The Platform

- **Admin Role & Moderation** — hide posts, ban users, content reports. _High._
- **AI Features** — content suggestions, summarization, auto-tags. _High._
- **Subscriptions / Tipping** — Stripe integration, premium gating. _High._
- **Email Digest** — weekly top posts from followed authors. _Medium._

### Unscheduled

- **Reply to Comments** — 1-level threading (`parentId` on comments), inline reply form. _Medium._
- **Custom 404 Page** — branded not-found page with navigation. `Quick Win` _Low._
- **About & Contact Pages** — static `/about`; `/contact` form. _Low._
- **Empty-state Rollout** — `EmptyState` currently used on profiles only; extend to `/blog`, comments, search. `Quick Win` _Low._
- **Custom Avatar Upload** — `avatarStorageId` + upload UI (OAuth/DiceBear avatars already work). _Medium._
- **SEO Phase 2** — JSON-LD structured data, `sitemap.xml`, `robots.ts`. _Medium._
- **Loading Skeletons Phase 2** — content-shaped skeletons for `/blog` listing and comments. _Low._

---

## Technical Notes

### Convex Guidelines

Always read `convex/_generated/ai/guidelines.md` before modifying Convex code.

### shadcn/ui

Use `pnpm shadcn add <component>` to add new primitives. Do not edit `components/ui/` manually.

### Testing

- Convex functions: `pnpm test:ci` (edge-runtime)
- UI components: `pnpm test:component` (jsdom)

### Phase 3A Documentation and Review Gates

- Read `docs/PHASE_3A.md` and `docs/PHASE_3A_DECISIONS.md` before planning or
  changing a Phase 3A slice. The current local implementation plan supplements
  these documents but never replaces them.
- Before every staging action, present the intended diff and documentation
  impact for human review. Before every commit, present the staged diff and
  fresh verification evidence. Before every PR, present all commits, the full
  base diff, verification evidence, and documentation consistency for human
  review. Explicit approval is required at each gate.

### CI Before PR

```
pnpm lint → pnpm test:ci → pnpm test:component → pnpm build
```
