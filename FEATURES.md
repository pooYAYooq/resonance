# Resonance — Features & Roadmap

> The living roadmap: what's shipped, what's next, and the idea backlog.
>
> **Update rule:** when a feature ships, update its status here (see the
> "Documentation" section in `AGENTS.md`). Detailed phase designs and
> implementation plans live in `docs/superpowers/specs|plans/` (local,
> gitignored).

**Stack:** Next.js 16 (App Router) + TypeScript + Convex + Better Auth + Tailwind CSS v4 + shadcn/ui

**Purpose:** A multi-author publishing platform where users write posts and readers engage through likes, comments, and follows.

---

## Status Board

| Phase                               | Goal                                                       | Status         |
| ----------------------------------- | ---------------------------------------------------------- | -------------- |
| Phase 0 — Foundation Fix            | `users` table, OAuth, auth guards, schema hardening        | ✅ Complete    |
| Phase 1.0 — Backward-compat cleanup | `createdAt`/`updatedAt` tightened to required              | ✅ Complete    |
| Phase 1A — Identity & Engagement    | 1.1 Profiles ✅ · 1.2 Likes ✅ · 1.3 Comment Likes ✅      | ✅ Complete    |
| Phase 1B — Curation & Connection    | 1.4 Follows · 1.5 Bookmarks · 1.6 Notifications · 1.7 Feed | 🔵 1.4 up next |
| Phase 1C — Discovery & Polish       | 1.8 Tags · 1.9 Trending · 1.10 Activity · 1.11 Polish      | ⚪ Pending     |
| Phase 2 — The Author                | Editor, drafts, dashboard, editing, analytics              | ⚪ Future      |
| Phase 3 — The Platform              | Moderation, search, AI, subscriptions, digest              | ⚪ Future      |

**Known issue:** on first OAuth sign-up, the Navbar avatar shows initials
instead of the provider picture until the user record sync completes
(`AuthSync` fires `syncUser` as fire-and-forget).

---

## Currently Implemented

### Authentication

- Email/password **and** Google/GitHub OAuth via Better Auth (runs inside Convex)
- `AuthSync` bridges Better Auth identity into the app-level `users` table on sign-in
- Navbar avatar dropdown (profile / settings / logout); `/create` is auth-gated

### Blog Posts

- Create posts with title, body, and optional cover image (Convex storage)
- Paginated listing at `/blog` (server-rendered); post detail at `/blog/[postId]` with dynamic OG metadata
- Denormalized `commentCount` and `likeCount` on posts; O(1) total via `stats` table

### Likes

- `toggleLike` — idempotent, one like per user per post, records in a separate `likes` table
- `LikeButton` on post cards and the post detail page; `likeCount` denormalized on posts
- `toggleCommentLike` — idempotent, one like per user per comment, records in a separate `commentLikes` table
- `CommentLikeButton` on each `CommentCard`; `likeCount` denormalized on comments; shared `LikeToggle` primitive powers both post and comment like buttons

### Comments

- Paginated comments ("Load More"), auth required to post
- Comment cards enriched with author avatars from the `users` table

### Profiles & Settings

- Public profiles at `/u/[userId]`: avatar, display name, bio, paginated post list
- `/settings`: edit display name and bio
- OAuth avatars mapped from provider profiles (Google `picture` / GitHub `avatar_url`), DiceBear fallback

### UI/UX

- Landing page sections in `app/(app)/_components/`: Hero, Features, Recent Posts (Suspense + content-shaped skeleton), Stats, Explore
- Shared `PostCard` across blog listing, landing, and profile pages
- `EmptyState` and `SectionHeading` primitives; site-wide `Footer` with auth-aware `FooterCTA`
- Dark/light/system theme toggle; toast notifications (Sonner)
- SEO phase 1: per-page metadata, OG/Twitter tags, dynamic post metadata, `noindex` auth pages

---

## Backlog

Each item: essence + rough effort. Phase-numbered items are specified in the
roadmap design doc; "Unscheduled" items are not yet in the phase roadmap.

### Phase 1B — Curation & Connection

- **1.4 Follows** — follow/unfollow authors; denormalized `followerCount`/`followingCount` on `users`. _Medium._
- **1.5 Bookmarks / Reading List** — private bookmarks; `/reading-list` page. _Medium._
- **1.6 Notifications** — bell in Navbar + `/notifications` when a followed author publishes. _Medium-High._
- **1.7 Reader Feed** — `/feed` with posts from followed authors, newest-first, paginated. _Medium._

### Phase 1C — Discovery & Polish

- **1.8 Post Tags** — `tags` array on posts, tag pills, filter `/blog?tag=`. _Medium._
- **1.9 Trending / Popular** — "Latest" / "Popular" tabs on `/blog` via `likeCount`/`commentCount`. _Low._
- **1.10 User Activity Feed** — recent activity ("X liked Y's post") on profiles. _Medium._
- **1.11 Polish** — reading-time estimate (~200 wpm) on cards/detail; share links (copy-to-clipboard / Web Share API). _Low._

### Phase 2 — The Author

- **Rich Text Editor** — replace plain-text body (TipTap, Lexical, or Plate), structured content. _High._
- **Drafts & Publishing** — `draft`/`published` status, drafts on dashboard. _Medium._
- **Author Dashboard** — `/dashboard`: drafts, published posts, analytics summary. _Medium._
- **Post Editing** — edit published posts (versioning strategy TBD in Phase 2 design). _Medium._
- **Post Analytics** — views, likes over time, follower growth charts. _Medium._

### Phase 3 — The Platform

- **Admin Role & Moderation** — hide posts, ban users, content reports. _High._
- **Full-Text Search** — search by title/body/author (Convex search or Algolia/Meilisearch). _Medium._
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

### CI Before PR

```
pnpm lint → pnpm test:ci → pnpm test:component → pnpm build
```
