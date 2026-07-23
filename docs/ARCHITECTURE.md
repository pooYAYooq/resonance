# Resonance — Architecture

This document is a reference for when you have been away from the codebase and need
to re-orient fast. It covers the full stack, how the layers connect, and why things were
built the way they were. Read it top-to-bottom once, then use it as a lookup.

---

## Stack

| Layer     | Technology                                | Notes                                                   |
| --------- | ----------------------------------------- | ------------------------------------------------------- |
| Framework | Next.js 16 (App Router)                   | Server and client components; route handlers            |
| Backend   | Convex                                    | Database, serverless functions, real-time subscriptions |
| Auth      | Better Auth via `@convex-dev/better-auth` | Runs inside Convex, not in Next.js                      |
| UI        | shadcn/ui + Tailwind CSS v4               | Primitive components and utility styles                 |
| Forms     | React Hook Form + Zod                     | Client-side forms with schema validation                |
| Theming   | next-themes                               | Dark and light mode toggle                              |

---

## Directory Structure

```
resonance/
├── app/
│   ├── layout.tsx              # Root layout. ThemeProvider, ConvexClientProvider, Toaster
│   ├── globals.css
│   ├── (app)/                  # Route group: main app shell (has Navbar + Footer)
│   │   ├── layout.tsx          # Renders <Navbar /> above and <Footer /> below all (app) pages
│   │   ├── page.tsx            # Landing page. Composes sections from _components/.
│   │   ├── _components/        # Page-specific landing sections (not routed)
│   │   │   ├── HeroSection.tsx
│   │   │   ├── FeaturesSection.tsx
│   │   │   ├── RecentPostsSection.tsx    # fetchQuery, wrapped in <Suspense>
│   │   │   ├── RecentPostsSkeleton.tsx   # Content-shaped fallback
│   │   │   ├── StatsSection.tsx          # Live total via posts.countPosts
│   │   │   └── ExploreSection.tsx
│   │   ├── blog/
│   │   │   ├── page.tsx        # Blog listing. Server Component. Uses fetchQuery.
│   │   │   └── [postId]/
│   │   │       └── page.tsx    # Post detail. fetchQuery + generateMetadata.
│   │   ├── create/
│   │   │   └── page.tsx        # Create post form. Client Component. Uses useMutation.
│   │   ├── settings/
│   │   │   └── page.tsx        # Edit display name + bio. Client Component. useMutation.
│   │   └── u/[userId]/
│   │       ├── page.tsx        # Public profile. Server Component. Uses fetchQuery +
│   │       │                   # react.cache() to dedupe generateMetadata / page fetch.
│   │       └── _components/
│   │           ├── EditProfileButton.tsx   # Client. Shown only to the profile owner.
│   │           └── ProfilePostList.tsx     # Client. usePaginatedQuery for "Load More".
│   ├── auth/                   # Auth pages. Isolated layout. No Navbar.
│   │   ├── layout.tsx          # Full-screen centered layout with Back button
│   │   ├── login/
│   │   └── sign-up/
│   └── api/                    # Next.js route handlers (Better Auth HTTP handler)
│
├── convex/
│   ├── schema.ts               # DB schema: posts, comments, likes, commentLikes, users, stats
│   ├── auth.config.ts          # Convex auth config. Registers Better Auth provider.
│   ├── auth.ts                 # Creates the Better Auth instance; reads SITE_URL.
│   │                           # Google + GitHub OAuth with profile field mapping.
│   ├── http.ts                 # Registers Better Auth HTTP routes on Convex router
│   ├── posts.ts                # createPost, generateImageUploadUrl mutations;
│   │                           # getPosts, getPostById, getPostsByAuthorId,
│   │                           # countPosts queries (countPosts reads the stats table)
│   ├── comments.ts             # createComment mutation, getCommentsByPostId query
│   │                           # (paginated, enriches authorAvatarUrl, isLiked, likeCount)
│   ├── likes.ts                # toggleLike + toggleCommentLike mutations (idempotent); keeps
│   │                           # denormalized posts.likeCount and comments.likeCount in sync
│   ├── stats.ts                # getStats query + incrementPostCount internal
│   │                           # mutation (single-row denormalized counter)
│   ├── users.ts                # syncUser, getCurrentUser, getUserById,
│   │                           # getUserByAuthId, getUserByEmail, getUserProfile,
│   │                           # updateProfile mutations/queries
│
├── components/
│   ├── ui/                     # shadcn/ui primitives (Button, Card, Input, etc.)
│   └── web/
│       ├── ConvexClientProvider.tsx  # Convex + Better Auth session bridge.
│       │                           # Wraps children in <AuthSync>.
│       ├── AuthSync.tsx         # Fires users.syncUser on every auth state change
│       ├── Navbar.tsx           # Top nav. Avatar dropdown (profile/settings/logout).
│       ├── Footer.tsx           # Site-wide footer. Links from lib/constants/footer.ts.
│       ├── FooterCTA.tsx        # Auth-aware CTA card rendered inside Footer
│       ├── AuthCTA.tsx          # Auth-aware CTA button ("Write a post" / "Get Started")
│       ├── CommentSection.tsx   # Client: paginated comment list + submission form
│       ├── CommentCard.tsx      # Display of a single comment with timestamp + comment like button
│       ├── LikeButton.tsx       # Client: heart toggle + count, auth-gated
│       ├── LikeToggle.tsx      # Generic like-toggle primitive (auth redirect, transition,
│       │                       # optimistic state sync, toasts) — wrapped by LikeButton/CommentLikeButton
│       ├── CommentLikeButton.tsx # Thin LikeToggle wrapper bound to toggleCommentLike;
│       │                       # rendered on each CommentCard
│       ├── PostCard.tsx         # Reusable post card. Title is an <h2> so the
│       │                        # page-level <h1> remains unique per page.
│       ├── EmptyState.tsx       # Icon + title + description + optional CTA primitive
│       ├── SectionHeading.tsx   # Heading with optional count + right-side action slot
│       ├── ProfileHeader.tsx    # Reusable profile hero (avatar, name, bio, action)
│       ├── UserAvatar.tsx       # Avatar with DiceBear fallback + initials.
│       └── theme-toggle.tsx     # Dark and light toggle
│
├── schemas/                    # Zod validation schemas (repo root, shared)
│   ├── auth.ts                 # signUpSchema, loginSchema
│   ├── blog.ts                 # postSchema
│   └── comment.ts              # commentSchema (body + postId)
│
└── lib/
    ├── auth-server.ts          # Next.js server-side auth helpers
    ├── auth-client.ts          # Browser-side authClient (sign-in, sign-up, sign-out)
    ├── avatar.ts               # DiceBear fallback URL + initials helpers
    └── constants/
        ├── seo.ts              # SITE_NAME, getSiteUrl(), truncateForDescription()
        └── footer.ts           # Footer site name, nav links, social links
```

---

## Component Organization

```
components/
├── ui/          shadcn/ui primitives.
│                Re-generate via the shadcn CLI if any changes need to be made.
│                (Button, Card, Input, Textarea, Field, Skeleton, etc.)
│
└── web/         App-level components. Everything specific to Resonance.
    ├── ConvexClientProvider.tsx
    │     Wraps the entire app tree. Sets up ConvexBetterAuthProvider
    │     with NEXT_PUBLIC_CONVEX_URL. Must be a client component
    │     ("use client") because it manages a real-time WebSocket.
    │     Wraps children in <AuthSync> so user records stay in sync.
    │
    ├── AuthSync.tsx
    │     Client component mounted inside ConvexClientProvider. Fires
    │     the users.syncUser mutation whenever auth state changes, so
    │     the app-level users table mirrors the Better Auth identity
    │     (display name, email, OAuth avatar). Known issue: sync is
    │     fire-and-forget, so on first OAuth sign-up the Navbar can
    │     briefly render initials instead of the provider avatar.
    │
    ├── Navbar.tsx
    │     Reads auth state with useConvexAuth(). Reactive to the
    │     Convex session, not to the Better Auth client directly.
    │     Authenticated users get an avatar dropdown (profile,
    │     settings, logout); calls authClient.signOut() on logout.
    │     "Create" is hidden from unauthenticated visitors.
    │
    ├── Footer.tsx / FooterCTA.tsx / AuthCTA.tsx
    │     Footer is the site-wide footer (quick links, socials,
    │     copyright; link data lives in lib/constants/footer.ts).
    │     FooterCTA is the auth-aware CTA card inside it, and AuthCTA
    │     is the same pattern as a standalone button used on the
    │     landing and blog heroes: authenticated → "Write a post"
    │     (/create), unauthenticated → "Get Started" (/auth/login).
    │
    ├── LikeButton.tsx
    │     Heart toggle with like count, rendered on post cards and
    │     the post detail page. Auth-gated; initial state comes from
    │     the server-rendered post (isLiked, likeCount) and stays in
    │     sync with the live query after toggling.
    │
    ├── LikeToggle.tsx
    │     Generic like-toggle primitive shared by post and comment like
    │     buttons. Owns auth-redirect, the useTransition in-flight state,
    │     the optimistic render-time state sync (no useEffect), and Sonner
    │     toasts. The wrapper components own `useMutation` (so the
    │     mutation arg name — postId vs commentId — stays correct and
    │     type-safe) and pass an already-bound `onToggle` callback.
    │
    ├── CommentLikeButton.tsx
    │     Thin LikeToggle wrapper bound to `api.likes.toggleCommentLike`.
    │     Renders the heart + count on each CommentCard; owns the
    │     `useMutation` call and passes `onToggle={() =>
    │     toggleCommentLike({ commentId })}`. The shared like UX (auth,
    │     transition, toasts) lives in LikeToggle.
    │
    ├── CommentSection.tsx
    │     Client component. Displays the paginated comment thread for a single
    │     post and hosts the reply form. Uses usePaginatedQuery for "Load More"
    │     support and useMutation to submit new ones. Form validation via
    │     React Hook Form + Zod.
    │
    ├── CommentCard.tsx
    │     Stateless display of a single comment. Shows author name,
    │     creation timestamp, body text, and a right-aligned comment like button.
    │
    ├── PostCard.tsx
    │     Reusable post card used in `/blog` and on author profile pages.
    │     Renders cover image (aspect-video), an author row (avatar + name
    │     → profile), title as an <h2>, body excerpt, and a single-row
    │     footer with comment count, date, and a "Read More" link. The
    │     card has a hover-lift treatment (`-translate-y-0.5` + shadow).
    │     The title is intentionally <h2> so each page keeps a single
    │     <h1> for screen-reader / SEO consistency.
    │
    ├── EmptyState.tsx
    │     Shared "no content yet" primitive. Icon + title + optional
    │     description + optional CTA. Used on the profile page's empty
    │     post list and reusable for future empty states (no comments,
    │     empty search, etc.).
    │
    ├── SectionHeading.tsx
    │     Shared heading primitive. Title with optional inline count +
    │     label and a right-side action slot. Used for "Posts" on the
    │     profile page and "Fresh from the community" on the landing
    │     page's `RecentPostsSection`.
    │
    ├── ProfileHeader.tsx
    │     Reusable profile hero: avatar + name + bio + optional right
    │     action (e.g. "Edit Profile"). Anchored on the left on `md:`,
    │     centered on mobile. The post count is intentionally not
    │     rendered here, it lives in the section heading next to the
    │     post list.
    │
    ├── UserAvatar.tsx
    │     Avatar with DiceBear fallback. Accepts avatarUrl, name, and
    │     userId. Falls back to initials on whitespace / empty names.
    │
    └── theme-toggle.tsx
          Wraps next-themes' useTheme(). Toggling updates a class on
          <html>; Tailwind picks it up via the dark: variant.
```

---

## Layouts and Route Groups

```
app/
├── layout.tsx          Root layout. Providers that must wrap everything:
│                         ThemeProvider, ConvexClientProvider, Toaster
│
├── (app)/
│   └── layout.tsx      Adds <Navbar /> above and <Footer /> below page
│                       content, in a flex column so the footer pins to
│                       the bottom on short pages. All app pages live here.
│
└── auth/
    └── layout.tsx      Full-screen centered layout.
                        No Navbar. Has a Back button.
                        Auth pages are deliberately isolated so there is
                        no visual chrome distracting from the form.
```

Page-specific components that only one route uses live next to that route in
a `_components/` folder (e.g. `app/(app)/_components/` for the landing
sections, `app/(app)/u/[userId]/_components/` for the profile page). Shared
components live in `components/web/`.

Route groups (the `(app)` folder name) are a Next.js App Router convention. The
parentheses mean the folder name is not part of the URL. `/blog` resolves to
`app/(app)/blog/page.tsx`.

---

## Auth Flow

Better Auth runs inside Convex, not in the Next.js server. User and session records
live in the same Convex database as your app data. No separate auth DB.

### How the pieces wire together

```
┌────────────────────────────────────────────────────────────────┐
│                        CONVEX BACKEND                          │
│                                                                │
│  convex/auth.ts          Creates the Better Auth instance.     │
│    └─ betterAuth()       Uses Convex DB adapter.               │
│                          Reads SITE_URL from Convex env.       │
│                                                                │
│  convex/auth.config.ts   Registers Better Auth as the          │
│                          Convex auth provider.                 │
│                                                                │
│  convex/http.ts          Mounts Better Auth HTTP routes        │
│    └─ registerRoutes()   (sign-in, sign-up, session)           │
│                          served at NEXT_PUBLIC_CONVEX_SITE_URL │
└────────────────────────────────────────────────────────────────┘
         ▲ HTTP calls (sign-in / sign-up / session)
         │
┌───────────────────────────────────────────────────────────────┐
│                       NEXT.JS SERVER                          │
│                                                               │
│  lib/auth-server.ts      Server-side helpers from             │
│    convexBetterAuthNextJs()  convexBetterAuthNextJs():        │
│    ├─ handler            → used in app/api/ route handler     │
│    ├─ preloadAuthQuery   → preload queries with auth token    │
│    ├─ isAuthenticated    → boolean check in Server Components │
│    ├─ getToken           → raw token for SSR data fetching    │
│    └─ fetchAuthQuery/    → authenticated server-side fetches  │
│       Mutation/Action                                         │
└───────────────────────────────────────────────────────────────┘
         ▲ session reads
         │
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                 │
│                                                                 │
│  lib/auth-client.ts      authClient from better-auth/react      │
│    └─ convexClient()     with the convexClient plugin.          │
│                          Used for signIn / signUp / signOut.    │
│                                                                 │
│  ConvexClientProvider    Wraps the app in                       │
│    └─ ConvexBetterAuth   ConvexBetterAuthProvider bridges       │
│       Provider           the real-time Convex client with       │
│                          the Better Auth session.               │
│                          Needs NEXT_PUBLIC_CONVEX_URL.          │
│                                                                 │
│  Navbar                  Reads auth state via                   │
│    └─ useConvexAuth()    useConvexAuth(). Reactive,             │
│                          sourced from Convex (not authClient)   │
└─────────────────────────────────────────────────────────────────┘
```

### Sign-up / sign-in sequence

```
Browser                 Next.js              Convex HTTP
  │                        │                     │
  │── authClient.signIn ──>│                     │
  │   (lib/auth-client.ts) │                     │
  │                        │── POST /auth/... ──>│
  │                        │                     │── Better Auth handler
  │                        │                     │   writes session to
  │                        │                     │   Convex DB
  │                        │<── session token ───│
  │<── session token ──────│                     │
  │                        │                     │
  │  ConvexBetterAuthProvider picks up token     │
  │  and attaches it to all subsequent Convex    │
  │  queries / mutations automatically           │
```

Auth supports email + password and OAuth (Google and GitHub). Email
verification is disabled. For OAuth sign-ins, `convex/auth.ts` maps provider
profile fields (Google `picture`, GitHub `avatar_url`) onto the Better Auth
user so avatars display immediately; `AuthSync` then copies identity fields
into the app-level `users` table.

---

## Data Flow

Two distinct rendering patterns are used depending on what the page needs.

```
┌──────────────────────────────────────────────────────────────────┐
│  PATTERN A: Server Component  (app/(app)/blog/page.tsx)          │
│                                                                  │
│  Next.js Server                        Convex                    │
│      │                                     │                     │
│      │── fetchQuery(api.posts.getPosts) ──>│                     │
│      │   (convex/nextjs, runs at           │── reads posts table │
│      │    request time on the server)      │                     │
│      │<── posts[] ─────────────────────────│                     │
│      │                                     │                     │
│      │  Renders HTML with data baked in.                         │
│      │  Wrapped in <Suspense> with skeleton fallback.            │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  PATTERN B: Client Component  (app/(app)/create/page.tsx)        │
│                                                                  │
│  Browser (React)                       Convex                    │
│      │                                    │                      │
│      │  React Hook Form + Zod             │                      │
│      │  validates input                   │                      │
│      │                                    │                      │
│      │── useMutation(api.posts            │                      │
│      │     .createPost) ─────────────────>│                      │
│      │                                    │── safeGetAuthUser()  │
│      │                                    │   throws if unauthed │
│      │                                    │── writes to posts    │
│      │<── result ─────────────────────────│                      │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  PATTERN C: Client-side (comments)  (blog/[postId]/page.tsx)     │
│                                                                  │
│  Next.js Server                                                  │
│      │                                                            │
│      │  Renders <CommentSection> with initialTotalCount           │
│      │  (no server data fetch for comments)                        │
│      │                                                            │
│  Browser (React)                       Convex                    │
│      │                                    │                      │
│      │── usePaginatedQuery(api.comments   │                      │
│      │     .getCommentsByPostId) ─────────>│── reads comments     │
│      │<── PaginationResult ─────────────── │   table (paged)      │
│      │                                    │                      │
│      │── useMutation(api.comments         │                      │
│      │     .createComment) ─────────────>│── writes to comments │
│      │<── new comment ID ─────────────────│   (auth required)    │
│      │                                    │                      │
│      │── loadMore(numItems) ─────────────>│── next page          │
└──────────────────────────────────────────────────────────────────┘
```

**When to use which:**

- Server Component + `fetchQuery` → read-only pages, good for SEO, no client JS needed.
- Client Component + `useMutation`/`useQuery` → anything that writes data or needs
  real-time reactivity.
- Client-side + `usePaginatedQuery` → data that needs pagination and real-time updates
  (e.g. a comment list with "Load More" and a reply form).

---

## Key Decisions

### 1. Why Convex?

Real-time subscriptions out of the box, TypeScript-first schema, and fully serverless.
No separate API server to maintain. Queries and mutations are just TypeScript functions.
The schema in `convex/schema.ts` is the single source of truth for the DB shape.

### 2. Why Better Auth instead of Clerk or Auth.js?

- **Cost:** Open-source and self-hosted. No per-MAU pricing.
- **Integration:** `@convex-dev/better-auth` is the official package, so user/session
  data lives directly in Convex. No second database or third-party service.
- **Control:** You own the auth logic. Adding providers or custom flows means editing
  your own code, not reading someone else's dashboard docs.

### 3. Why does Better Auth run on Convex instead of Next.js?

If it ran in Next.js, sessions and user records would need their own database. By
running Better Auth inside Convex functions (via `convex/auth.ts` and `convex/http.ts`),
everything (posts, users, sessions) lives in one place. Fewer moving parts.

### 4. Why two separate layouts ((app) vs auth)?

The main app needs a persistent Navbar. Auth pages need to be distraction-free,
full-screen forms. Route groups let you express this with zero conditional rendering logic.
The layout file handles it structurally.

### 5. Why the mixed Server / Client Component rendering strategy?

- `/blog` is read-only and benefits from server-side rendering for SEO and fast initial
  load. `fetchQuery` runs at request time. No client JS required to see the content.
- `/create` needs React Hook Form state and fires a Convex mutation directly from the
  browser. It has to be a Client Component.

The rule of thumb: default to Server Components; drop to Client Components only when
you need interactivity, browser APIs, or real-time Convex hooks.

### 6. Why load comments client-side instead of server-rendering them?

The post page server-renders the post itself (SEO + fast first paint) but
deliberately does **not** fetch comments on the server. The page only passes
the denormalized `post.commentCount` to `<CommentSection>` as
`initialTotalCount`, and the client component takes it from there:
`usePaginatedQuery(api.comments.getCommentsByPostId)` for the "Load More"
list and `useMutation(api.comments.createComment)` for the submission form
(React Hook Form + Zod validation). Trade-off: comments appear a beat after
the post content, but the list is live — new comments from other readers
show up without a refresh, and pagination state stays entirely on the
client. Comments are below the fold and not SEO-critical, so the extra
server round-trip would buy little.

### 7. Why use `react.cache()` for `generateMetadata` + the page?

Next.js renders a Server Component twice per request: once for `generateMetadata`
and once for the page body. Calling `fetchQuery` directly in both means two round
trips to Convex and the risk that the two reads see different states. We wrap the
fetch in a module-level `cache(async (userId) => fetchQuery(...))` and call that
helper from both `generateMetadata` and the page. React dedupes the calls within
the same request, so both phases share a single Convex read. The same pattern is
used for any Server Component where metadata and body need the same data.

### 8. Why hoist author lookups out of paginated maps?

In `getPostsByAuthorId` the author is the same for every post in the page, so we
`ctx.db.query("users")...unique()` **once** before `Promise.all(result.page.map(...))`,
then read the cached `user` value inside the map. Doing it inside the map would
issue one user lookup per post. The image URL still has to be resolved per post
because each `imageStorageId` is unique — that one stays in the map.

### 9. Why share a single `PostCard` across every list surface?

Every surface that lists posts, the blog listing, the landing page's
`RecentPostsSection`, and the profile page's post list, renders posts
through the same `PostCard` component with the same cover aspect ratio
(`aspect-video`) and hover-lift treatment. Visual consistency comes from
reusing one component, not from aligning hand-written styles across files.
A future change to the card (e.g. a new badge, a new affordance) is a
single-file edit, not a sweep.

### 10. Why a single-row `stats` table for the total post count?

Convex has no built-in count operation, and `.collect().length` loads every
post into memory. The landing page stats section needs an O(1) read, so
`createPost` calls the internal `incrementPostCount` mutation after every
insert and `posts.countPosts` simply reads the single `stats` row. Writes
are where we pay; reads stay cheap.

### 11. Why is `likes` a separate table instead of an array on posts?

An unbounded `likedBy` array would grow the post document toward Convex's
1 MB document limit and bloat every read that doesn't need like data. A
separate `likes` table (one row per user per post, indexed
`by_postId_and_userId`) supports both "did this user like this post?" and
"all likes for this post" as index queries. The hot-path count is
denormalized onto `posts.likeCount`, kept in sync by `toggleLike`, so cards
and detail pages render counts without touching the `likes` table.

### 12. Why a shared `LikeToggle` primitive?

Post and comment like buttons share the same UX — auth-gated redirect,
in-flight transition state, optimistic local count synced from
server-rendered props without a `useEffect`, and success/error toasts —
differing only in the mutation reference, the argument name (`postId`
vs `commentId`), and the label/toast strings. `LikeToggle` owns the
shared behavior; each wrapper (`LikeButton`, `CommentLikeButton`) owns
its `useMutation` call and passes an already-bound `onToggle` callback
so the mutation arg name stays type-safe. This keeps the two buttons
visually and behaviorally consistent, avoids ~60 lines of duplication,
and gives future bookmark-style toggles (1.5) a ready seam. The
`commentLikes` table mirrors `likes` (decision #11): separate table, no
unbounded array, denormalized `comment.likeCount` kept in sync by
`toggleCommentLike`.

---

## Environment Variables

| Variable                      | Where it lives            | Used by                                  |
| ----------------------------- | ------------------------- | ---------------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL`      | Next.js `.env.local`      | `ConvexClientProvider`: WebSocket URL    |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Next.js `.env.local`      | Points browser auth calls at Convex HTTP |
| `BETTER_AUTH_SECRET`          | Next.js `.env.local`      | Better Auth encryption (32+ chars)       |
| `NEXT_PUBLIC_SITE_URL`        | Next.js `.env.local`      | `metadataBase` / absolute OG image URLs  |
| `SITE_URL`                    | Convex dashboard env vars | `convex/auth.ts`: Better Auth base URL   |

`NEXT_PUBLIC_*` variables are exposed to the browser bundle. `SITE_URL` stays
server-side inside Convex.
