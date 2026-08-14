# Resonance

> A full-stack blogging platform built with **Next.js**, **Convex**, and **Better Auth**.
> Write, share, and engage with a community of curious minds.

---

## Features

| Feature            | Description                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| **Landing Page**   | Animated hero, feature highlights, live recent posts, community stats, and conversion CTA         |
| **Blog**           | Create structured posts with cover images and block-level inline images, browse paginated listings, read individual posts |
| **Likes**          | Like/unlike posts with live counts on cards and post pages                                        |
| **Comments**       | Paginated comments with author avatars, real-time updates                                         |
| **Follows**        | Follow/unfollow authors; live follower/following counts on profile headers                        |
| **Profiles**       | Public profiles at `/u/[userId]` with posts, bio, avatar, and follow action; edit via `/settings` |
| **Authentication** | Email/password + Google/GitHub OAuth via Better Auth (runs inside Convex)                         |
| **SEO**            | Per-page metadata, Open Graph tags, and dynamic meta generation for blog posts                    |
| **Dark Mode**      | System-aware dark/light theme toggle                                                              |
| **Responsive**     | Mobile-first design, works across all breakpoints                                                 |

## Roadmap and Feature Status

The detailed roadmap lives in [`FEATURES.md`](FEATURES.md). It separates
shipped functionality from delivery priorities and optional ideas so that a
deferred feature is not mistaken for unfinished work.

Feature statuses are:

- **Now** — actively being implemented.
- **Next** — the next agreed delivery focus.
- **Later** — planned, but not scheduled.
- **Deferred** — intentionally postponed until its revisit conditions are met.
- **Shipped** — available in the product.

The short resume point is [`docs/status.md`](docs/status.md). Phase 1C is
complete after Post Tags (1.8); Trending (1.9), User Activity (1.10), and
additional Polish (1.11) remain deferred optional features.

---

## Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org) (App Router)
- **Backend:** [Convex](https://convex.dev) — real-time database & serverless functions
- **Auth:** [Better Auth](https://better-auth.com) via `@convex-dev/better-auth` (runs inside Convex)
- **UI:** [shadcn/ui](https://ui.shadcn.com), [Tailwind CSS v4](https://tailwindcss.com), [Radix UI](https://radix-ui.com)
- **Fonts:** Geist Sans, Geist Mono, Inter (via `next/font`)
- **Forms:** React Hook Form + Zod
- **Testing:** Vitest (edge-runtime for Convex, jsdom for UI components)

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (locked to v10 via `packageManager` in `package.json`)
- A Convex project (sign up at [convex.dev](https://convex.dev))

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up environment variables

Copy `.env.local.example` to `.env.local` and fill in:

| Variable                      | Description                              |
| ----------------------------- | ---------------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL`      | Your Convex deployment URL               |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Your Convex site URL                     |
| `BETTER_AUTH_SECRET`          | 32+ character secret for auth encryption |
| `NEXT_PUBLIC_SITE_URL`        | Public site URL (for OG tags)            |

> **Note:** Also set `SITE_URL` in the **Convex dashboard** environment variables (not `.env.local`) — `convex/auth.ts` and Better Auth read it from there.

### 3. Run the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Convex setup (first time)

```bash
npx convex dev
```

This starts the Convex dev server and syncs your schema/functions.

---

## Development Commands

| Intent               | Command                                                        |
| -------------------- | -------------------------------------------------------------- |
| Dev server           | `pnpm dev`                                                     |
| Lint                 | `pnpm lint`                                                    |
| Format               | `pnpm format`                                                  |
| Typecheck            | `pnpm build` (includes TS type-checking via Next plugin)       |
| Tests (edge-runtime) | `pnpm test:ci` — Vitest with edge-runtime for Convex functions |
| Component tests      | `pnpm test:component` — Vitest with jsdom for React components |
| Single test file     | `pnpm test -- <path>`                                          |
| Build                | `pnpm build`                                                   |

---

## CI Before PR

```bash
pnpm lint && pnpm test:ci && pnpm test:component && pnpm build
```

---

## Project Structure

```text
app/
  (app)/                      # Main app routes (has Navbar + Footer)
    page.tsx                  # Landing page (public, auth-aware CTAs)
    layout.tsx                # App layout with Navbar + Footer
    _components/              # Landing page sections
      HeroSection.tsx
      FeaturesSection.tsx
      RecentPostsSection.tsx
      RecentPostsSkeleton.tsx
      StatsSection.tsx
      ExploreSection.tsx      # Category placeholder grid
    blog/
      page.tsx                # Blog listing with gradient hero + optional tag filter
      _components/            # BlogFilter and cursor-draining BlogPostList
      [postId]/
        page.tsx              # Single post view with likes + comments
    create/
      page.tsx                # Create form with tags, cover image, inline cleanup, and BlockNote editor
      _components/
        PostBodyEditor.tsx    # Browser-only BlockNote adapter with image upload/finalization (ssr:false)
    settings/
      page.tsx                # Edit display name + bio
    u/[userId]/
      page.tsx                # Public profile with paginated posts
      _components/            # ProfilePostList (Edit Profile + Follow live in components/web/)
    reading-list/
      page.tsx                # Private reading list (client-gated + paginated)
      _components/            # ReadingListContent
    notifications/
      page.tsx                # Private notifications feed (client-gated + paginated)
      _components/            # NotificationsList (gate + pagination + mark-all-read) + NotificationRow
    feed/
      page.tsx                # Private reader feed (client-gated + globally paginated)
      _components/            # FeedContent (fixed cutoff + bounded cursor pagination)
  auth/                       # Auth routes (login, sign-up)
    login/page.tsx
    sign-up/page.tsx
    layout.tsx                # Auth layout (no Navbar, full-screen forms)
  api/auth/[...all]/          # Better Auth route handler → Convex HTTP

convex/
  schema.ts                   # Database schema, including owner-bound pendingUploads sessions
  posts.ts                    # Post queries, mutations, cover upload, inline claim consumption, and URL hydration
  pendingUploads.ts           # Owned inline upload sessions, finalization, failed-submit cleanup, and expiry cleanup
  comments.ts                 # Comment queries and mutations (paginated, hydrates isLiked/likeCount)
  likes.ts                    # toggleLike + toggleCommentLike mutations
  follows.ts                  # toggleFollow + isFollowing + getFollowCounts (1.4). by_followerId_and_followingId
                              # index only — by_followingId deferred to 1.6 (notification fan-out)
  bookmarks.ts                # toggleBookmark + isBookmarked + getBookmarkedPosts (1.5).
                              # Private reading list, no denormalized counters.
  notifications.ts            # Notifications fan-out (batched 200 + scheduler), unread count, list, mark-all-read
  feed.ts                     # 30-day materialized reader feed, fan-out/backfill/deletion/cleanup, paginated query
  users.ts                    # User sync, profile queries, updateProfile
  stats.ts                    # Denormalized total post count
  auth.ts                     # Better Auth integration inside Convex (email + OAuth)
  http.ts                     # Convex HTTP actions

components/
  ui/                         # shadcn/ui primitives
  web/                        # App-level components
    AuthCTA.tsx               # Auth-aware CTA button ("Write a post" / "Get Started")
    FooterCTA.tsx             # Auth-aware CTA card for Footer
    Navbar.tsx                # Top nav with avatar dropdown
    NotificationBell.tsx      # Auth-only bell with unread badge; self-subscribes to getUnreadCount
    Footer.tsx
    PostCard.tsx              # Shared post card (listing, landing, profile, feed, saved)
    PostBody.tsx              # Pure Server Component renderer for structured & legacy post bodies
    TagPill.tsx               # Linked pill for /blog?tag= filters
    PostTagSelector.tsx       # Controlled five-tag checkbox selector
    LikeButton.tsx
    LikeToggle.tsx              # Generic like-toggle primitive (auth, transition, toasts)
    CommentLikeButton.tsx       # Comment like button wrapper rendered on CommentCard
    CommentSection.tsx
    CommentCard.tsx
    ProfileHeader.tsx           # Profile hero (avatar, name, bio, stats slot, rightAction slot)
    ProfileStats.tsx            # Reactive follower/following counts row (subscribes getFollowCounts)
    FollowButton.tsx           # Self-contained follow/unfollow toggle (owns toggleFollow mutation)
    BookmarkButton.tsx         # Self-contained bookmark toggle (owns toggleBookmark mutation)
    ProfileActionButton.tsx    # Owns profile rightAction: Edit Profile / FollowButton / anon-redirect
    SectionHeading.tsx
    EmptyState.tsx
    UserAvatar.tsx
    AuthSync.tsx              # Syncs Better Auth identity → users table
    ConvexClientProvider.tsx

schemas/                      # Zod validation schemas (repo root)

lib/
  constants/                  # Site-wide constants (seo, footer, canonical post tags)
  avatar.ts                   # DiceBear fallback + initials helpers
  utils.ts                    # cn() and other helpers
  post-content.ts             # Dependency-free body contract, image validation, captions, and storage-ID extraction
  auth-client.ts              # Better Auth client setup
  auth-server.ts              # Server-side auth helpers
```

---

## Architecture

### Server vs Client Components

| Type                  | Usage                            | Data Fetching                     |
| --------------------- | -------------------------------- | --------------------------------- |
| **Server Components** | Read-only pages & sections       | `fetchQuery` from `convex/nextjs` |
| **Client Components** | Interactivity, hooks, auth state | `useConvexAuth`, mutations        |

### Auth Flow

```text
Browser → Next.js API route (app/api/auth/[...all]/route.ts)
         → Convex HTTP action (convex/http.ts)
         → Better Auth handler (convex/auth.ts)
```

User and session records live in the same Convex DB as application data.

### Data Fetching Patterns

| Section       | Query                                              | Pattern                            |
| ------------- | -------------------------------------------------- | ---------------------------------- |
| Landing stats | `fetchQuery(api.posts.countPosts)`                 | Live total post count              |
| Recent posts  | `fetchQuery(api.posts.getPosts, { numItems: 4 })`  | Paginated, wrapped in `<Suspense>` |
| Blog listing  | `fetchQuery(api.posts.getPosts, { numItems: 50 })` | Full paginated grid                |
| Post detail   | `fetchQuery(api.posts.getPostById)`                | Single post + cover/inline image URL resolution |

---

## Testing

| Suite  | Command               | Runtime | Coverage                      |
| ------ | --------------------- | ------- | ----------------------------- |
| Convex | `pnpm test:ci`        | Edge    | Functions, queries, mutations |
| UI     | `pnpm test:component` | jsdom   | React components, forms       |

---

## Contributing

1. Create a feature branch from `main`
2. Follow **Conventional Commits** (active voice, subject ≤72 chars)
3. Run the full CI pipeline before opening a PR
4. **Open a Pull Request** — do not merge directly to `main`

---

## License

[MIT](LICENSE)
