# Resonance

> A full-stack blogging platform built with **Next.js**, **Convex**, and **Better Auth**.
> Write, share, and engage with a community of curious minds.

---

## Features

| Feature              | Description                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Landing Page**     | Animated hero, feature highlights, live recent posts, community stats, and conversion CTA                                                                                                  |
| **Discover**         | Latest published posts, full-text Search over title/body/author, active canonical Topics, bounded paginated editorial summaries, and Feed recovery                                         |
| **Blog and Posts**   | Create structured posts with cover images and block-level inline images, save drafts, publish intentionally, edit published posts in place, and read individual posts                      |
| **Likes**            | Like/unlike posts with live counts on cards and post pages                                                                                                                                 |
| **Comments**         | Paginated comments with author avatars, real-time updates                                                                                                                                  |
| **Follows**          | Follow/unfollow authors; live follower/following counts on profile headers                                                                                                                 |
| **Profiles**         | Public profiles at `/u/<username>` with posts, bio, avatar, and follow action; owned non-canonical spellings redirect, and author links use the current username; edit via `/profile/edit` |
| **Author Dashboard** | Private workspace at `/dashboard` with drafts, published posts, and published-post edit actions; analytics at `/dashboard/analytics`                                                       |
| **Authentication**   | Email/password + Google/GitHub OAuth via Better Auth (runs inside Convex)                                                                                                                  |
| **SEO**              | Per-page metadata, Open Graph tags, and dynamic meta generation for blog posts                                                                                                             |
| **Dark Mode**        | System-aware dark/light theme toggle                                                                                                                                                       |
| **Responsive**       | Mobile-first design, works across all breakpoints                                                                                                                                          |

## Roadmap and Feature Status

[`ROADMAP.md`](ROADMAP.md) is the single source of truth for scope, remaining
work, and delivery status. It defines the v1.0 release boundary (Phase 3A
complete) and the numbered remaining-work list.

[`FEATURES.md`](FEATURES.md) is the shipped capability catalog: what Resonance
does today, surface by surface. [`CHANGELOG.md`](CHANGELOG.md) holds release
history.

The short resume point is [`docs/status.md`](docs/status.md): current focus,
next action, and blockers. Shipped capabilities are cataloged in `FEATURES.md`;
scope and progress live only in `ROADMAP.md`.

---

## Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org) (App Router)
- **Backend:** [Convex](https://convex.dev) — real-time database & serverless functions
- **Auth:** [Better Auth](https://better-auth.com) via `@convex-dev/better-auth` (runs inside Convex)
- **UI:** [shadcn/ui](https://ui.shadcn.com), [Tailwind CSS v4](https://tailwindcss.com), [Radix UI](https://radix-ui.com)
- **Fonts:** Work Sans (product voice and reading text) and Neuton (published headings) via `next/font`
- **Forms:** React Hook Form + Zod
- **Testing:** Vitest (edge-runtime for Convex, jsdom for UI components)

---

## Getting Started

### Prerequisites

- Node.js 20.19+, 22.13+, or 24+ (required by Next.js 16 and the Vitest toolchain)
- pnpm (locked to v10 via `packageManager` in `package.json`)
- A Convex project (sign up at [convex.dev](https://convex.dev))

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up environment variables

Copy `.env.local.example` to `.env.local` and fill in:

| Variable                      | Description                   |
| ----------------------------- | ----------------------------- |
| `NEXT_PUBLIC_CONVEX_URL`      | Your Convex deployment URL    |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Your Convex site URL          |
| `NEXT_PUBLIC_SITE_URL`        | Public site URL (for OG tags) |

> **Note:** Also set `SITE_URL` and `BETTER_AUTH_SECRET` (32+ high-entropy characters) in the **Convex dashboard** environment variables (not `.env.local`) — `convex/auth.ts` and Better Auth read them from there.

For phone testing over the local network, the optional Convex-side
`AUTH_TRUSTED_ORIGINS` accepts additional exact origins, separated by commas.
Keep `SITE_URL` unchanged and use email/password for that LAN preview; OAuth
callbacks still use `SITE_URL`. See the example in [.env.local.example](.env.local.example).

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

| Intent               | Command                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| Dev server           | `pnpm dev`                                                                                         |
| Lint                 | `pnpm lint`                                                                                        |
| Format               | `pnpm format`                                                                                      |
| Typecheck            | `pnpm exec tsc --noEmit` (standalone; also runs in CI); `pnpm build` includes Next's type checking |
| Tests (edge-runtime) | `pnpm test:ci` — Vitest on edge-runtime: Convex, `app`, `lib`, and `schemas` unit tests            |
| Component tests      | `pnpm test:component` — Vitest with jsdom for React components                                     |
| Single test file     | `pnpm test -- <path>`                                                                              |
| Build                | `pnpm build`                                                                                       |

---

## CI Before PR

```bash
pnpm lint && pnpm exec tsc --noEmit && pnpm test:ci && pnpm test:component && pnpm build
```

---

## Project Structure

```text
app/
  (workspace)/                # Authenticated workspace: sidebar at md+, site Navbar below md; no Footer
    layout.tsx                # WorkspaceShell auth boundary and responsive navigation chrome
    create/
      layout.tsx              # Metadata-only child layout
      page.tsx                # New, draft, and published-edit writing modes
      _components/
        PostBodyEditor.tsx    # Browser-only standard BlockNote adapter (ssr:false); uses the shared upload hook
        AuthoringSideMenu.tsx # Drag-safe block side menu; click-only handle menu over a Radix popover
        BlockHandleMenu.tsx   # Handle menu body; kept off the "use client" entry file
        CoverAuthoring.tsx    # Cover dropzone and published-ratio 16:9 preview above the title, with replace/remove recovery
        MediaAuthoring.tsx    # Details-level inline media status, thumbnails or glyphs, and replace/remove recovery
        ReviewSurface.tsx     # Frozen read-only review preview; the studio header owns Back and Publish/Update
        reviewReadiness.ts    # Review-entry media gate; blocks final publish/update on a missing or invalid cover
        reviewSnapshot.ts     # Reviewed content, cover intent, and submission builders for frozen Review
        useDraftRecovery.ts   # New/draft local recovery; published edits stay page-local
        EditorAbandonDialog.tsx # Start fresh / Cancel update confirmation with blocked state
    dashboard/
      layout.tsx              # Metadata-only child layout
      page.tsx                # Dashboard root with drafts and published-post previews
      feed/
        page.tsx              # Private reader feed inside the workspace shell
        _components/           # FeedContent and bounded pagination tests
      notifications/
        page.tsx              # Private notifications inside the workspace shell
        _components/           # Shared page/drawer list, rows, expansion, and deletion dialog
      analytics/page.tsx      # Private author analytics: summary cards and follower-growth chart
      saved/
        page.tsx              # Private Saved posts page within the dashboard shell
        _components/          # SavedSection (client gate, pagination, time grouping)
      liked/
        page.tsx              # Private Liked posts page within the dashboard shell
        _components/          # LikedSection (client gate, pagination, time grouping)
      drafts/page.tsx         # Full owner-scoped draft list
      published/page.tsx      # Current-author published management rows
      _components/            # Dashboard overview previews and management sections
        DraftManagementRow.tsx # Responsive draft rows with cover fallback and Resume/Delete
        PublishedRow.tsx       # Responsive cover, metadata, engagement, and author actions
        DeletePostDialog.tsx   # Confirmed draft and published deletion with pending/error and focus
    _components/              # Workspace shell, sidebar, mobile drawer, utilities, and navigation
      WorkspacePreviewContext.tsx # Lets Review temporarily replace workspace navigation chrome
  (marketing)/                # Public marketing routes (Navbar + marketing Footer)
    layout.tsx                # SiteShell with the marketing footer
    page.tsx                  # Landing page (public, auth-aware redirect)
    _components/              # Landing page sections
      HeroSection.tsx
      FeaturesSection.tsx
      RecentPostsSection.tsx
      RecentPostsSkeleton.tsx
      StatsSection.tsx
  (site)/                     # Reader routes (Navbar + compact Footer)
    layout.tsx                # SiteShell with the compact footer
    blog/
      page.tsx                # Discover route with normalized URL state
      _components/            # Search, Topics, states, summaries, and paginated results
      [postId]/
        page.tsx              # Single post view with likes, comments, and publication timestamps
        comments/[commentId]/ # Focused conversation, server-loaded target + live updates
    feed/page.tsx              # Redirects to /dashboard/feed
    liked/page.tsx            # Redirect to /dashboard/liked
    notifications/page.tsx    # Redirects to /dashboard/notifications
    profile/edit/
      page.tsx                # Authenticated identity + selected-work editor
      _components/            # ProfileIdentityForm, CountryPicker, SelectedWorkEditor, edit-state helpers
    saved/page.tsx            # Redirect to /dashboard/saved
    settings/
      page.tsx                # Appearance and account configuration
    u/[username]/
      page.tsx                # Public author page: hero band, identity, socials, stats, action, bounded work
      not-found.tsx           # Route-scoped 404 shared with the missing-profile path
      _components/            # AuthorProfile (canvas) + AuthorShowcase (bounded live work)
      posts/
        page.tsx              # Public catalogue: compact header over the paged published-post list
        _components/          # AuthorCatalogue (12-per-page list) + CatalogueQueryBoundary (retry)
  auth/                       # Auth routes (login, sign-up)
    login/page.tsx
    sign-up/page.tsx
    layout.tsx                # Auth layout (no Navbar, full-screen forms)
  api/auth/[...all]/          # Better Auth route handler → Convex HTTP

convex/
  schema.ts                   # Database schema, including Discover projections and counters, and users.welcomeDismissedAt
                              # (one-time welcome state)
  posts.ts                    # Draft save/publish, published editing/deletion, published-only reads, uploads, claims, and URL hydration
  postLifecycle.ts             # Transactional post writes, deterministic preconditions, and projection synchronization
  discover.ts                 # Public Latest, Search, Topics, and Topic-post queries
  discoverProjection.ts       # Compact/Search projection synchronization, repair, and invariants
  pendingUploads.ts           # Owned inline upload sessions, finalization, failed-submit cleanup, and expiry cleanup
  sessionMediaClaims.ts       # Session-scoped media retention claims with expiry and lifecycle transitions
  writeAttempts.ts             # Author-bound idempotent write reservations, retained outcomes, reconciliation, and cleanup
  pendingPostEdits.ts          # One pending published update per post: version checks, promotion, cleanup
  comments.ts                 # Paginated comments, bounded focused-conversation query, and authenticated writes
  likes.ts                    # toggleLike + toggleCommentLike mutations and private paginated liked-post query
                              # uses by_postId_and_userId for toggles and by_userId_and_createdAt for liked-post pagination
  follows.ts                  # Follow toggle/state/counts; follower index supports reader-feed fan-out
  bookmarks.ts                # toggleBookmark + isBookmarked + getBookmarkedPosts (1.5).
                              # Private reading list, no denormalized counters.
  notificationEvents.ts       # Transactional engagement notification writer, dedupe, excerpts, and follow allowance
  notifications.ts            # Unread count, hydrated list, read actions, scoped deletion, and indexed retention cleanup
  crons.ts                    # Recurring notification/feed expiry, media cleanup, and deletion recovery
  feed.ts                     # Published-only 30-day materialized reader feed, fan-out/backfill/deletion/cleanup, paginated query
  postDeletion.ts             # Internal bounded deletion continuations, draft upload cleanup, and stale-job recovery
  profilePostCount.ts         # Transactional profile count adjustment helper
  users.ts                    # User sync, profile queries, Discover rename repair
  profileModel.ts             # Shared profile validators, revision-checked identity/selection helpers
  profiles.ts                 # Public identity/showcase/catalogue reads; authenticated identity and selection edits
  usernameModel.ts            # Transactional username claim lookup, classification, revision checks, and rate-limiter enforcement
  usernames.ts                # Authenticated claim + public availability APIs; internal account provisioning and permanent retirement
  accountProvisioning.ts      # Shared profile create/refresh from Better Auth identity; guarantees one generated username
  welcome.ts                  # One-time dashboard welcome state and account-persisted dismissal
  rateLimiter.ts              # Transactional allowances for username claims and follow notifications
  convex.config.ts            # Mounts the app's Convex components (the rate-limiter)
  stats.ts                    # Denormalized total post count
  auth.ts                     # Better Auth integration inside Convex (email + OAuth, user onCreate/onDelete triggers)
  http.ts                     # Convex HTTP actions

components/
  ui/                         # shadcn/ui primitives
  web/                        # App-level components
    AuthCTA.tsx               # Auth-aware CTA button ("Write a post" / "Get Started")
    FooterCTA.tsx             # Auth-aware CTA card for Footer
    Navbar.tsx                # Top nav with reader/workspace links, notifications, and account hub actions
    MobileNavMenu.tsx         # Mobile drawer and shared AppNavigation for the workspace sidebar
    NotificationBell.tsx      # Auth-only bell with unread badge; opens the notification drawer
    NotificationLink.tsx      # Guarded destinations, intent prefetch, and delayed status feedback
    Footer.tsx
    PostCard.tsx              # Shared post card (landing, dashboard preview, feed)
    CollectionPostCard.tsx    # Saved/Liked card: 3:2 cover, byline after title, tags under cover,
                              # page-specific action, flat mobile row
    CollectionGroupList.tsx   # Session-scoped collapsible collection time groups with chevron, label, and count
    CoverImage.tsx            # Custom cover image or the blank transparent fallback surface with a subtle bottom border
    PostCover.tsx             # Uncapped published 16:9 cover frame: shared ratio and single crop seam
    PostArticleHeader.tsx     # Shared reader and noninteractive Review title, attribution, and topics
    PostBody.tsx              # Pure Server Component renderer for structured post bodies
    PostBodyPreview.tsx       # Synchronous client preview renderer used by Review
    HighlightedCode.tsx       # Server-rendered Shiki token spans with plain-text fallback
    HighlightedCodeClient.tsx # Client Shiki highlighting for the Review preview
    post-body-shared.tsx      # Pure inline/alignment/media helpers shared by both renderers
    TagPill.tsx               # Linked pill for /blog?tag= filters
    PostTagSelector.tsx       # Controlled five-tag grid of shadcn Checkbox rows
    LikeButton.tsx
    LikeToggle.tsx              # Generic like-toggle primitive (auth, transition, toasts)
    CommentLikeButton.tsx       # Comment like button wrapper rendered on CommentCard
    CommentSection.tsx         # Live paginated article discussion with legacy anchor support
    CommentComposer.tsx        # Shared authenticated reply form for article and focused conversation
    CommentDestination.tsx     # Server-loaded selected comment with auth-aware live updates and focus handoff
    CommentTimestamp.tsx       # Hydration-safe UTC initial timestamp, then reader-local time
    CommentCard.tsx
    AuthorPostCard.tsx          # Reader-facing author-work card (3:2 frame, cover recovery Retry)
    AuthorJoinedDate.tsx        # Hydration-safe calendar/relative join-date label with refresh
    HarmonicWaves.tsx           # Static hero-band harmonic-wave artwork
    ProfileStats.tsx            # Reactive follower/following counts row (subscribes getFollowCounts)
    FollowButton.tsx           # Self-contained follow/unfollow toggle (owns toggleFollow mutation)
    BookmarkButton.tsx         # Self-contained bookmark toggle (owns toggleBookmark mutation)
    ProfileActionButton.tsx    # Owns profile rightAction: Edit Profile / FollowButton / anon-redirect
    SectionHeading.tsx
    EmptyState.tsx
    UserAvatar.tsx
    AuthSync.tsx              # Syncs Better Auth identity → users table, with a recoverable retry banner
    WelcomeDialog.tsx         # Dashboard-scoped one-time welcome; dismissal persisted on the account
    AuthoringExitProvider.tsx # Root exit coordinator: recovery, history, sign-out, native warning
    AuthoringExitDialog.tsx   # Light/strong/blocking exit surfaces
    ConvexClientProvider.tsx

schemas/                      # Zod validation schemas (repo root)

scripts/                      # Dependency-free Git artifact check and tooling tests

lib/
  constants/                  # Site-wide constants (seo, footer, canonical post tags)
  avatar.ts                   # DiceBear fallback + initials helpers
  utils.ts                    # cn() and other helpers
  post-capacity.ts            # Shared Unicode, structural, source/document, Search-corpus, and author-name limits
  post-content.ts             # Dependency-free blocknote@1 envelope parsing, excerpts, and storage-ID extraction
  blocknote-contract.ts       # Finite canonical projection and validation of BlockNote default blocks
  heading.ts                  # Shared H2-H6 body-heading normalization; title owns H1
  code-languages.ts           # Canonical code-block IDs, labels, aliases, and Shiki grammars
  safe-link.ts                # Shared http/https/mailto author-link validator
  cover.ts                    # Shared cover URL resolver; null renders the blank fallback
  collection-time-groups.ts   # Rolling local-time buckets for Saved/Liked collection groups
  collection-group-storage.ts # Session-scoped collapsed group keys per user and collection
  use-list-focus-restore.ts   # Shared keyboard focus restoration after list removal and pagination
  profile-identity.ts         # Profile identity types, code-point limits, and normalizer
  profile-socials.ts          # Social platform allowlists and URL validation/canonicalization
  profile-joined-date.ts      # UTC calendar and relative join-date formatting
  username.ts                 # Shared username spelling rules, reserved names, canonical derivation, and profile-path builder
  constants/profile-countries.ts # Approved selectable country snapshot with source/license note
  draft-recovery.ts           # Versioned localStorage snapshot for unsaved new posts and drafts
  authoring-exit-policy.ts    # Pure exit decisions: recover, confirm, or block per intent
  authoring-history.ts        # Navigation API traversal adapter with one-shot replay
  authoring-unsaved-work.ts   # Meaningful-dirty comparison and blank-proposal detection
  use-inline-image-upload.ts  # Owner-bound BlockNote file upload and preview lifecycle hook
  shiki/                      # Generated editor grammars and server-side highlighting adapter
  discover.ts                 # Discover URL normalization and mode-switch links
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

Account creation provisions the app profile and its generated `Reso_` username
inside the same Convex transaction as the auth write, so a new account is usable
at `/u/<username>` immediately. The one-time welcome's state lives on the
account as `users.welcomeDismissedAt`; see
[Account Provisioning and the One-Time Welcome](docs/ARCHITECTURE.md#account-provisioning-and-the-one-time-welcome).

### Data Fetching Patterns

| Section       | Query                                                                | Pattern                                         |
| ------------- | -------------------------------------------------------------------- | ----------------------------------------------- |
| Landing stats | `fetchQuery(api.posts.countPosts)`                                   | Live total post count                           |
| Recent posts  | `fetchQuery(api.posts.getPosts, { numItems: 4 })`                    | Paginated, wrapped in `<Suspense>`              |
| Discover      | `usePaginatedQuery(api.discover.getDiscoverPosts)` / `getTopicPosts` | Reactive Latest/Search/Topic projection reads   |
| Post detail   | `fetchQuery(api.posts.getPostById)`                                  | Single post + cover/inline image URL resolution |

---

## Testing

| Suite  | Command               | Runtime | Coverage                      |
| ------ | --------------------- | ------- | ----------------------------- |
| Convex | `pnpm test:ci`        | Edge    | Functions, queries, mutations |
| UI     | `pnpm test:component` | jsdom   | React components, forms       |

---

## Contributing

Follow [the PR workflow](docs/PR_CHECKLIST.md) for new PRs, review updates, and
merge handoff. [AGENTS.md](AGENTS.md) defines message and approval rules.

- Work on a non-`main` branch and deliver code and its documentation together.
- Use full Conventional Commits with an imperative subject and a meaningful
  what/why body. PR descriptions include rationale, actual verification,
  relevant links, and limitations. Use no en/em dashes in either message.
- Run the applicable checks before handoff. Keep local plans and raw evidence
  out of commits; `pnpm check:artifacts` checks known local-only paths in the
  Git index, and `pnpm test:tooling` exercises that check in temporary repos.
- Use the existing PR for review fixes. Merge through GitHub after the final
  documentation and verification gate; cleanup needs no merge-record PR.

No paid project-management service is required. The roadmap holds scope and
GitHub holds review/merge state. Issues can capture actionable bugs, labels
can classify them, milestones can group release work, and Projects can provide
an optional board. Link to the authoritative record instead of maintaining
duplicate status lists.

---

## License

[MIT](LICENSE)
