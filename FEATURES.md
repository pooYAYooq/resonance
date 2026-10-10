# Resonance Features

> The shipped capability catalog: what Resonance does today, surface by
> surface. Scope, remaining work, and delivery status live in
> [`ROADMAP.md`](ROADMAP.md). Release history lives in
> [`CHANGELOG.md`](CHANGELOG.md).
>
> **Update rule:** when a capability ships, add or update its entry here. When
> scope or status changes, update `ROADMAP.md` in the same change (see the
> "Documentation" section in `AGENTS.md`). Detailed designs and implementation
> plans live in `docs/superpowers/` while their task is active (ignored,
> local-only, never committed); completed artifacts follow the archive
> lifecycle in `AGENTS.md`.

**Stack:** Next.js 16 (App Router) + TypeScript + Convex + Better Auth + Tailwind CSS v4 + shadcn/ui

**Purpose:** A multi-author publishing platform where users write posts and readers engage through likes, comments, and follows.

---

## Currently Implemented

### Authentication

- Email/password **and** Google/GitHub OAuth via Better Auth (runs inside Convex)
- `AuthSync` bridges Better Auth identity into the app-level `users` table on sign-in
- Navbar avatar dropdown (profile / settings / logout); `/create` is auth-gated
- Below 768px, the site and workspace use a logo plus hamburger drawer instead
  of inline account controls. The mobile drawer and desktop workspace sidebar
  share navigation content: Writing, Reading, Account, and Appearance, with
  profile context and unread notifications for authenticated users; anonymous
  users get Home, Discover, Log In, Sign Up, and theme controls.

### Blog Posts

- Create posts with title, body, and optional cover image (Convex storage)
- Create posts with block-level images, audio, and video through the standard
  BlockNote editor; local uploads store canonical Convex Storage IDs through
  the owner-bound claim lifecycle, and remote media must use safe HTTP(S) URLs
- Post bodies use the canonical `blocknote@1` structured document format,
  validated at both the browser form and the Convex write boundary
- Discover at `/blog` defaults to Latest published posts, searches title,
  extracted body text, and author name with `q`, and opens paginated canonical
  Topic listings with `tag`; post detail remains at `/blog/[postId]` with
  dynamic OG metadata
- Denormalized `commentCount` and `likeCount` on posts; O(1) total via `stats` table
- Curated tags on posts (up to five from a shared sixteen-value list), clickable
  tag pills, and exact `/blog?tag=<tag>` filtering
- The published reader aligns its cover, title, metadata, tags, and title divider
  to the site header container around a 700px prose column that left-aligns from
  `xl` up to reserve the wide-screen rail, with an uncapped 16:9 cover and an
  18px published body scale
- Published post attribution includes a 40px avatar and a linked author name,
  falling back to Unknown when the profile name is unavailable. Publication and
  conditional update dates are stacked beneath the name with emphasized labels;
  roomier topic links sit below in a labeled navigation region. Author and topic
  links expose explicit keyboard-focus styles.

### Drafts & Publishing

- Authenticated authors can save incomplete structured posts as private drafts
  and update them through the owner-scoped `saveDraft` mutation
- `/dashboard/drafts` lists the current author's drafts as responsive management
  rows matching My Posts: linked titles, 16:9 covers with a neutral blank fallback,
  tags, Last saved dates, and grouped Resume/Delete actions; no excerpts
- Draft deletion uses a named, irreversible confirmation with cancellation,
  pending/duplicate protection, retryable errors, and focus restoration to the
  trigger, neighboring Resume link, or Create a post action
- Resuming a draft opens `/create?draftId=<id>` with its content, tags, and
  images hydrated into the editor
- Publishing validates the stored draft, transitions it to `published`, and
  triggers published-only feed and notification fan-out
- Authors can edit published posts in place through `/create?editPostId=<id>`;
  edits preserve the post ID, publication time, engagement records, bookmarks,
  and feed position while advancing `updatedAt`
- Published editing can save one pending update as a draft linked to the live
  post; Drafts lists it with the pending title, cover, date, and a Pending
  update label. Promoting it updates the same post and removes the draft;
  deleting the pending draft leaves live content and media untouched, and
  deleting the source post removes the pending draft
- `/dashboard/published` lists the author's published posts as responsive
  management rows with 16:9 covers, linked titles, publication/update dates,
  tags, read-only like/comment counts, and grouped Edit and Delete actions
- Published deletion names the selected post in a keyboard-accessible
  confirmation dialog, explains irreversible removal, blocks duplicate
  submissions while pending, and keeps errors retryable. Cancellation restores
  the trigger; successful deletion focuses a neighboring row or New Post
- Both author lists retain 12-item load-more pagination. Search, filters,
  sorting, layout switching, sharing, and batch deletion are not included
- Public readers, likes, bookmarks, comments, notifications, and feed rows do
  not expose or act on drafts
- Public post details show `publishedAt` and show `updatedAt` only after an edit

### Authoring and Review

- Full-page Create and Edit inside the workspace shell, backed by the standard
  BlockNote editor with native menus, remote embeds, code language selection,
  Shiki highlighting, and persistent visible Undo/Redo controls
- Pasted web content is repaired at paste time: copied CSS colors and alignments
  normalize to supported values, media items whose source cannot be stored are
  removed with a notice naming how many were dropped, and an over-capacity
  paste reports the exact limit it crossed
- Canonical `blocknote@1` bodies with H1 reserved for the post title and H2 to
  H6 body headings; the reader renders the same contract without injected HTML
- Silent local recovery for unsaved new posts and drafts, loaded back during
  hydration with no prompt; published edits stay page-local until Update Post
  succeeds
- Unsaved-exit guards: app-link departures for new posts and drafts write the
  latest recovery snapshot before leaving, with a light reminder when storage
  fails, for published edits, or for a selected cover File; Back/Forward
  confirms before leaving in Navigation API browsers and replays the exact
  destination, while older browsers flush recovery synchronously; document
  switches validate the destination before clearing the current session's
  recovery; sign-out confirms strongly with save or discard choices; and the
  native beforeunload warning attaches only while unsaved work or an
  unresolved operation exists
- Start fresh (new posts and drafts) and Cancel update (published edits)
  confirm before discarding, clear only the current session's recovery after
  verified deletion, and never touch saved drafts, posts, or their media
- Media panel rows name their kind and type, show image thumbnails or audio and
  video glyphs, use plain lifecycle wording, and offer Replace and Remove for
  failed media while resolved inline editing stays in BlockNote
- Cover controls are styled Add, Replace, and Remove buttons with same-file
  reselection and a published-ratio 16:9 preview; a missing cover renders the
  shared blank fallback on cards, Discover, and the reader
- Review renders a frozen snapshot of the reviewed title, body, tags,
  cover intent, cover preview, and resolved inline media at the published
  geometry (uncapped 16:9 cover, 700px measure, published title weight), using
  the reader's shared title, attribution, and topic presentation. Author and
  topic links are noninteractive; Follow, engagement, and comments are omitted.
  Review replaces the workspace navigation chrome with a dedicated
  Edit/Preview/Publish-or-Update toolbar. Below 640px, the editing and update
  labels shorten to Edit and Update, and shared title/H2/H3 sizes are
  36px/30px/26px. New posts show Not published yet; published edits show dates.
  Published-edit Review preserves the original publication date and previews
  the pending update date, frozen when Review is entered. The server assigns
  the actual update timestamp on successful submission, so a later submission
  across a UTC date boundary may display a different date in the reader.
- Switching between editing and Review preserves the live body editor instance,
  unsaved content, selection, and undo history. URL target-transition
  confirmations, loading states, and errors remain visible in Review. On mobile,
  the editing toolbar sticks below the measured navbar height; the Preview
  toolbar stays at the top because workspace navigation is hidden.
- Review and submission are blocked while inline media or a recovered saved
  cover is unresolved; a transient cover lookup retries with backoff and on
  focus or reconnect, and the failure alert is reserved for a server-reported
  missing cover
- The title field keeps a persistent underline and receives one-time focus when
  a writing view opens; its placeholder stays visibly distinct from entered text
  at 4.5:1 or better in both themes
- Tag checkboxes use a stronger unchecked border, and a checked box swaps to a
  contrasting border under keyboard focus

### Likes

- `toggleLike` — idempotent, one like per user per post, records in a separate `likes` table
- `LikeButton` on post cards and the post detail page; `likeCount` denormalized on posts
- The post reader uses a larger outlined Like/Liked control after the article,
  immediately before discussion. The Like/Liked label reserves its natural width;
  tabular counts grow naturally rather than reserving maximum-count space.
  Large counts use whole-number lowercase k/m/b/t suffixes, with the exact count
  in the accessible name. Cards and comment reactions retain compact controls.
- `/liked` is a private, client-gated reader collection of the current user's liked posts
- `toggleCommentLike` — idempotent, one like per user per comment, records in a separate `commentLikes` table
- `CommentLikeButton` on each `CommentCard`; `likeCount` denormalized on comments; shared `LikeToggle` primitive powers both post and comment like buttons

### Comments

- Paginated comments ("Load More"), auth required to post
- Comment cards enriched with author avatars from the `users` table

### Follows

- `toggleFollow` — idempotent, one follow per user per author, records in a separate `follows` table
- `FollowButton` and `ProfileActionButton` on author profiles (consolidates Edit Profile + Follow into one `rightAction` slot)
- Published post bylines reuse a compact Follow control beside the author name,
  hidden on the author's own posts. Initial follow state is server-hydrated and
  reconciled with the authenticated live query; signed-out clicks return through
  login to the post. Both labels reserve the same width to avoid layout shifts.
- Denormalized `followerCount` and `followingCount` on `users`; `ProfileStats` row on profile headers subscribes to `getFollowCounts` and bumps live
- `isFollowing` query drives the initial button state; `getFollowCounts` drives the reactive stats row
- Two indexes: `by_followerId_and_followingId` (1.4) for the "is X following Y?" check, `by_followingId` (1.6) for the notification fan-out's ordered scan

### Bookmarks

- `toggleBookmark` — idempotent, one bookmark per user per post, records in a separate `bookmarks` table
- `BookmarkButton` on post cards and the post detail page; private, so no denormalized count on `users` or `posts`
- Reader bookmarks show outlined Save/Saved labels with reserved width alongside
  Like, before discussion. Back to all posts follows discussion.
- Server-rendered post reads hydrate initial bookmark state with
  `fetchAuthQuery`; bookmark controls continue to reconcile with their private
  live query after auth resolution
- `/saved` is a private, client-gated reader collection with a paginated grid
  of saved posts; unbookmarking from the list removes the card immediately

### Notifications

- `internal.notifications.fanOutForPost` — called after `publishPost`, inserts one row per follower in batches via `.paginate(args.paginationOpts)` with scheduler continuation via the `follows.by_followingId` index
- `users.unreadNotificationCount` denormalized counter; `getUnreadCount` is a single O(1) read for the bell badge
- `NotificationBell` in the desktop Navbar, auth-only, left of the avatar;
  mobile navigation shows a Notifications link with an unread count
- `/notifications` page, client-gated, paginated, marks all read on visit
- `markAllRead` resets the counter; rows remain as visual history

### Discover

- `/blog` provides Latest, published-post and author-name Search, and active
  canonical Topics with bounded pagination and Discover-specific editorial
  summaries
- Published posts maintain bounded `discoverPosts`, `discoverPostTopics`, and
  `topicStats` projections through publish/edit lifecycle synchronization;
  bounded backfill and author-name repair are retry-safe
- An authenticated empty Feed state links to Discover so readers can find
  authors and topics before following them

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

### Analytics

- Private author analytics at `/dashboard/analytics`, scoped to signed-in
  unique readers and labeled honestly as such
- Four summary cards: Unique Readers, Likes Received, Current Followers, and
  New Followers over 30 days
- A 30-day follower-growth chart rendered from the same summary query

### UI/UX

- Landing page sections in `app/(marketing)/_components/`: Hero, Features,
  Recent Posts (Suspense + content-shaped skeleton), Stats
- Shared `PostCard` across blog listing, landing, and profile pages
- `EmptyState` and `SectionHeading` primitives; `FooterCTA` remains limited to
  the legacy footer variant and is not rendered by the workspace shell
- Dark/light/system theme toggle; toast notifications (Sonner)
- Accessibility verification across the five v1.0 journeys: keyboard, focus,
  names, and mobile navigation checked in both themes at the tiered widths on
  Chromium, with fixes, owner handoffs, and limitations recorded in
  `docs/ACCESSIBILITY.md`
- Keyboard focus renders as a single solid 1px line: bordered controls recolor
  their rounded edge, other targets use an offset outline, and the BlockNote
  editor canvas shows an outline where its own stylesheet suppresses one
- SEO phase 1: per-page metadata, OG/Twitter tags, dynamic post metadata, `noindex` auth pages

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

- Follow the progressive documentation loading rule in `AGENTS.md`. Open
  `docs/PHASE_3A.md` or `docs/PHASE_3A_DECISIONS.md` only for the product
  direction or decision relevant to the task. The active local implementation
  plan supplements these documents but never replaces them.
- Before every staging action, present the intended diff and documentation
  impact for human review. Before every commit, present the staged diff and
  fresh verification evidence. Before every PR, present all commits, the full
  base diff, verification evidence, and documentation consistency for human
  review. Explicit approval is required at each gate.

### CI Before PR

```
pnpm lint → pnpm test:ci → pnpm test:component → pnpm build
```

### Known Issue

- On first OAuth sign-up, the Navbar avatar shows initials instead of the
  provider picture until the user record sync completes (`AuthSync` fires
  `syncUser` as fire-and-forget).

### Sessions

- Better Auth uses its installed 1.5.3 defaults: a finite seven-day session
  expiry with a one-day sliding refresh. Resonance has no custom `session`
  configuration or client inactivity logout timer.
