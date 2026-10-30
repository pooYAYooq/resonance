# Resonance Features

> The capability catalog for this revision: what Resonance does, surface by
> surface. Scope, remaining work, and delivery status live in
> [`ROADMAP.md`](ROADMAP.md). Release history lives in
> [`CHANGELOG.md`](CHANGELOG.md).
>
> **Update rule:** when a capability changes, add or update its entry here. When
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
- Every new account (email/password, Google, or GitHub) is provisioned an app
  profile and one generated `Reso_` + 10-character username in the same
  transaction as the auth account creation; automatic assignment never consumes
  the 90-day new-name allowance
- A one-time dashboard welcome remembers its dismissal on the account across
  sessions and browser contexts
- `AuthSync` bridges Better Auth identity into the app-level `users` table on sign-in
- Navbar avatar dropdown (profile / settings / logout); `/create` is auth-gated
- Login and sign-up use a full-height responsive layout. Below `sm` the form
  drops the card shell and uses the full content width, with Google and GitHub
  side by side; the desktop card returns at `sm` and above. Login fits a
  375x553 viewport without scrolling, and sign-up fits 375x667 with its extra
  field.
- Password fields include an accessible show/hide control. The toggle exposes
  its state with `aria-pressed` and switches its label between Show password
  and Hide password.
- Every sign-out asks for confirmation. A clean or non-editor session gets a
  light dialog; unsaved editor work keeps the strong save/discard guard.
- Sessions have a hard 30-day absolute limit. Activity cannot extend the
  expiry, so users sign in again after 30 days.
- Below 768px, the site and workspace use a full-width hamburger drawer. Signed-in
  users get the same Writing and Reading destinations as the desktop sidebar,
  with a profile link at the top, a shared Settings and Theme row, and Sign Out
  below the navigation. Accounts without a username link to profile setup. The
  navbar bell provides access to notifications. Anonymous users get Home,
  Discover, Log In, Sign Up, and theme controls.
- The desktop workspace sidebar collapses from 312px to a 54px icon rail with
  hover and keyboard-focus labels, active destination styling, and an unread
  notification dot. Its expand control is visible on devices that cannot hover.
  It starts expanded and remembers the choice in browser-local storage across
  reloads. The toggle still works in memory when storage is unavailable.

### Blog Posts

- Create posts with title, body, and a required publication cover (Convex storage);
  drafts and pending edits can be saved without a cover
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
  triggers published-only reader-feed fan-out
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
  Shiki highlighting, and centered Undo/Redo controls below the editor with
  accessible labels and tooltips
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
  unresolved operation exists. Notification drawer destinations follow the same
  guard and preserve the exact target after Leave or a successful Save & leave;
  opening the drawer alone is not a departure.
- Start fresh (new posts and drafts) and Cancel update (published edits)
  confirm before discarding, clear only the current session's recovery after
  verified deletion, and never touch saved drafts, posts, or their media
- Media panel rows name their kind and type, show image thumbnails or audio and
  video glyphs, use plain lifecycle wording, and offer Replace and Remove for
  failed media while resolved inline editing stays in BlockNote
- Cover controls are styled Add, Replace, and Remove buttons with same-file
  reselection and a published-ratio 16:9 preview. Publishing and published
  updates require an owned, available JPEG, PNG, or WebP image of nonzero size,
  at most 5 MiB. Covers can be added before writing or after reviewing.
  Review remains available without a cover, showing a neutral 16:9 placeholder;
  only final Publish/Update is blocked. A visible reminder and Add cover action
  return to editing and focus the picker without losing writing. A selected
  local cover uploads on submit; draft saving remains available without one.
  Removing a focused cover action returns focus to Add cover. Draft and publish
  validation reject an empty or unsupported selected file before Review, and the
  server re-verifies every upload at finalization: the object must be nonempty
  and, for images, its stored bytes must match the declared JPEG, PNG, or WebP
  signature. Invalid replacements cannot silently fall back to a saved cover.
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
- Liked posts appear in `/dashboard/liked`, grouped by liked time with a heart-only collection action
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
- `by_followerId_and_followingId` supports the "is X following Y?" check;
  `by_followingId` supports the reader feed's ordered follower scan.

### Bookmarks

- `toggleBookmark` — idempotent, one bookmark per user per post, records in a separate `bookmarks` table
- `BookmarkButton` on post cards and the post detail page; private, so no denormalized count on `users` or `posts`
- Reader bookmarks show outlined Save/Saved labels with reserved width alongside
  Like, before discussion. Back to all posts follows discussion.
- Server-rendered post reads hydrate initial bookmark state with
  `fetchAuthQuery`; bookmark controls continue to reconcile with their private
  live query after auth resolution
- Saved posts appear in `/dashboard/saved`, grouped by saved time with a bookmark-only collection action

### Private collections

- `/dashboard/saved` and `/dashboard/liked` are separate authenticated pages
  inside the dashboard shell, with independent Saved and Liked navigation links.
- `/saved` and `/liked` redirect to their corresponding dashboard pages; they
  no longer render collection pages in the reader shell.
- Results are grouped by when the current user saved or liked a post, using the
  relationship timestamp: Today, Yesterday, Previous 7 days, Previous 30 days,
  and Earlier. Groups use local time and remain newest first.
- Each group header is collapsible, starts expanded, and shows its currently
  loaded post count. The header uses a left chevron, label, and count; expanded
  headers keep a subtle muted background. Collapse state is session-scoped per
  signed-in user and collection: it survives route changes and reloads in the
  browser tab, while a new tab or browser restart starts expanded. Group counts
  reflect loaded posts; additional pages extend the groups.
- Tablet and desktop use cards with a 3:2 cover, the title, an avatar/author
  byline directly below the title, author-selected tags in a full-width row under
  the cover, and one collection action. Phones use flat list rows with no card
  chrome, a 3:2 cover, no tags, the byline, one action, and a divider between
  rows. Cards return at `sm`; the desktop grid uses two columns with equal row
  heights.
- Saved exposes only the bookmark action, and Liked exposes only the heart
  action. Removing that action removes the row reactively. Toggle names include
  the post title, and focus restoration retains the page-specific action across
  rows while ignoring group headings when choosing fallback targets. Empty
  collections link to Discover.
- Collection cards do not show a saved/liked timestamp or the post publication
  date. The time group is the only visible time context; exact timestamps and
  collection search or filters remain deferred. Excerpts and Read More are also
  omitted.
- Results use 12-item cursor pagination; deleted and unpublished posts are
  skipped. Each page has a private header and inherits dashboard
  `noindex, nofollow` metadata. Save labels and feedback use Saved terminology
  across shared controls.

### Notifications

- Notifications cover follows, post likes, comments on a post, and comment
  likes. Each notifies the followed user, post author, or comment author as
  appropriate. Self-actions are excluded. The engagement action, notification,
  and unread-counter increment commit in the same transaction through
  `recordEngagementNotification`; publishing updates the reader feed without
  sending publication notifications.
- Post likes, comments, and comment likes keep one live notification per
  recipient, actor, and event key. Repeating an action leaves existing read
  history intact. Undoing a like or follow does not remove its history row.
- `users.unreadNotificationCount` denormalized counter; `getUnreadCount` is a single O(1) read for the bell badge and workspace sidebar count
- At 767px and below, the navbar keeps the notification bell and unread badge
  visible immediately before the hamburger menu.
- Auth-only `NotificationBell` in the Navbar opens a right-side drawer on
  desktop and mobile, preserving the current page and reading position. New
  notifications update its badge without opening the drawer. Closing resumes
  reading; selecting a destination link closes the drawer and navigates there.
  The drawer reuses the full page’s rows, read state, and saved expansion state;
  opening it alone does not mark notifications read. The desktop workspace sidebar
  links to the full `/dashboard/notifications` page;
  `/notifications` redirects there.
- Comment and comment-like notification links open the shareable
  `/blog/[postId]/comments/[commentId]` conversation view. The selected comment
  appears below a compact post title and author, with the shared reply form,
  up to eight nearby comments, and links to the full article and all comments.
  A direct bounded query supplies the initial server render; live updates follow
  after authentication resolves. The selected comment receives focus without
  scrolling after the notification drawer disappears; missing targets focus a
  heading. User interaction or a one-second timeout cancels a pending handoff.
  Old article comment anchors remain supported.
- Notification row links prefetch on mouse hover or keyboard-visible focus,
  once per destination per mounted link. They do not prefetch on viewport entry
  or touch; explicit prefetch opt-out is respected. Links keep the source
  visible until the server response is ready. Slow requests show a small status
  indicator after 150ms; no full-screen overlay or comment-anchor scrolling runs.
  Missing comments keep the published post context; unavailable posts show a
  Discover link, and conversation request failures offer retry. Actor names and
  avatars open the profile at the top; post titles/covers and post-like events
  open the full article at the top. Comment actions and excerpts open the focused
  conversation on desktop and mobile. Opening the already-visible destination
  also resets to the top.
- `/dashboard/notifications` page inside the authenticated workspace,
  client-gated, paginated twelve at a time, renders one
  compact row per notification with direct links to the post and the actor and
  a small unread dot beside the timestamp with an accessible “Unread” label.
  The dot has a permanent 16px slot and becomes invisible when read, keeping
  text widths and action positions stable in both mobile and desktop layouts.
  Desktop actor names truncate individually, leaving the event text, timestamp,
  and unread dot visible. The timestamp follows the event text directly
- Below 640px, rows show details directly in four stacked areas: a 42px linked
  avatar beside the actor and event text, a linked 88 × 49.5px cover and post
  title, a linked comment excerpt when available, and a compact time/actions
  line. Actor/event text, titles, and excerpts each occupy at most two lines;
  long actor names truncate individually. Mobile rows use flat, full-width
  unread backgrounds and dividers. Unread backgrounds match My Posts' hover
  surface in both layouts. Times use short forms such as `5m` and `2h`, with
  fuller wording available to assistive technology and on hover.
- At 640px and above, rows have a small corner radius and expand independently
  by clicking or keyboard-activating the header's empty area. Actor and event
  links remain usable while collapsed. Expansion is saved per recipient and
  notification in browser storage across reloads and navigation; when storage
  cannot be read or written, an in-memory fallback lasts until reload. A failed
  write takes precedence over stale stored state for that row. Follow rows have no
  expandable details.
- Follow rows offer Follow back using the shared live follow control, changing
  to Following when active. Using it marks the notification read.
- The toolbar aligns with the row width: one button toggles between Expand all
  and Collapse all based on whether all loaded expandable rows are open. It is
  hidden below 640px and affects only loaded expandable rows, preserving their
  saved state. Both bulk expansion actions change presentation without marking
  notifications read.
  Mark all as read lives in the three-dot menu on all screen sizes, with a
  double-check icon. Delete all shares that menu and retains its confirmation
  dialog, offering All, Read only, and Unread only when those groups have rows.
  Its displayed counts cover at most 1,000 rows, with one extra row read to
  detect truncation and show a `+`. When truncated, all scopes remain available:
  a sampled zero does not prove the group is empty. This is a display bound, not
  a notification retention cap. Confirmed deletion processes
  the selected scope in bounded batches through a captured creation watermark,
  preserving newer arrivals.
- Individual deletion uses a trash icon on desktop, visible on row hover or
  keyboard focus and always available on devices without hover. Mobile rows
  use an overflow menu with Delete notification and, while unread, Mark as read.
  Deleting a row hides it immediately and offers Undo for five seconds before
  the server deletion is committed. The drawer replaces the hidden row with a
  focused Undo control inside the modal, sharing the toast's five-second window.
  That control remains available if the drawer is reopened before expiry and
  disappears once server deletion starts. Undo restores the row, but does not
  undo the read action caused by deletion. Bulk deletion has confirmation and no Undo.
- Follow notifications are limited to one per follower–recipient pair every
  seven elapsed days, measured from the last delivered notification. Repeated
  attempts do not extend the wait, and deleting the notification does not reset
  the rate limiter. A later eligible follow creates a new unread history row;
  existing rows retain their read state. Following itself is not rate-limited.
- Any click or keyboard activation within a notification marks it read,
  including row space, profile/event links, follow actions, and selecting a
  menu action. Opening a row menu leaves it unread and offers Mark as read
  explicitly. Hovering, scrolling, and opening the drawer alone do not.
- Read state is per row and persistent: explicitly expanding a row, opening
  any of its links, or clicking a desktop follow row's unread dot calls the
  idempotent, owner-scoped `markRead`, which clears the marker and decrements
  the unread count once; visiting the page changes nothing
- `Mark all as read` stays in the toolbar's overflow menu, disabled when there
  are no unread rows or while pending, and reuses `markAllRead`. It marks rows
  through the request's creation watermark in batches, preserving newer arrivals.
  Rows stay as visual history within the retention policy below, and focus
  returns to the named list region after the request succeeds.
- The empty state names the missing list and recovers to Discover
- Deleting a post removes its notifications in the bounded post-deletion
  cascade, decrementing each unread row's counter exactly once.
- Missing or unpublished posts are filtered out of the list. A missing comment
  removes its excerpt while retaining the history row and its missing-target
  conversation state; comment deletion semantics are unchanged.

#### Notification retention

- Read notifications expire 90 elapsed days after their first `readAt`;
  unread notifications expire 730 elapsed days (two years) after `createdAt`.
  Reading an old notification starts its full read-retention period. Repeated
  read actions do not restart that clock.
- Daily cleanup processes at most 100 rows per transaction and continues until
  its fixed cutoff is exhausted. Removal normally happens within roughly a day
  of expiry; scheduler delays or failed batches can take longer.
- Expiring unread notifications decrements each recipient's badge in the same
  transaction. Posts, comments, likes, and follows are preserved. No count limit
  or user-facing retention notice is added.
- Existing rows follow the policy on the next cleanup sweep; extending retention
  cannot restore notifications already removed. Verification is recorded in
  [notification retention evidence](docs/NOTIFICATIONS_EVIDENCE.md#notification-retention).

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

- `/dashboard/feed` is a private, client-gated route inside the authenticated
  workspace, showing posts from the reader's current follows; `/feed` redirects there
- A 30-day materialized `feed` table provides one globally ordered stream across authors
- Pages contain at most 20 posts and use a fixed `asOf` cutoff for stable cursor pagination
- Post fan-out, follow backfill, unfollow deletion, and daily expiration cleanup run in bounded scheduled batches

### Profiles & Settings

- Public author page at `/u/<username>`: a hero band with static harmonic-wave
  artwork carrying the country and join date above the display name, an
  introduction, the fixed secure social links, follower/following counts as
  display values, and the owner's Edit Profile, another viewer's Follow, or a
  signed-out Follow that returns to the page after login. The canonical
  lowercase spelling is the only form that renders; every other spelling of an
  owned name (styled, uppercase, previous) redirects to it, and unknown,
  reserved, and deleted-account names return a shared 404.
- The author page shows up to nine posts selected by the author in their saved
  order, three at a time with three more per More of my work and a polite
  `Showing N of M posts.` announcement. When work exists, the gallery opens with
  a large featured tile for the first visible work at desktop widths, with a 3:2
  cover and the title below, followed by smaller tiles; the first card spans two
  columns and two rows at large desktop widths. Below `lg` every card uses the
  same small tile layout. The selected-work section is headed "Selected
  articles" and keeps that heading on one line at narrow widths. Both cards show
  the published date without a "Published" label; the featured card also shows
  the post's tags. Longer titles step down a text size and clamp to two lines
  with an ellipsis.
  An author with no selection instead shows their three newest published posts.
  An author with no published work renders no work section at all: no heading,
  cards, catalogue link, or reserved space.
- The public catalogue at `/u/<username>/posts` opens from the author page's
  same-tab View all posts link. A compact header (avatar, display name, optional
  `@username`, and a Back to profile link) sits over the author's published
  posts newest first, twelve at a time with Load more. An author with no
  published posts sees an explanation and the return link with no placeholder
  grid; unknown names use the shared 404 recovery. The catalogue keeps the
  uniform tile grid.
- The author page stays live without a reload: identity edits, deleted posts,
  and follower/following counts update in place, and deleting the author's final
  selection falls back to their latest posts. The catalogue keeps only its card
  list live: published-post changes appear in place, while the compact identity
  header renders on page load and does not live-update.
- Comment author names and every other generated author link resolve to the
  author's current lowercase username; authors without a username render a
  plain label with no account-ID fallback.
- `/profile/edit` owns the public identity (display name, bio, optional
  country, and five social links) plus up to nine ordered featured posts;
  `/settings` owns Appearance and Account configuration.
  Provider avatar and email remain contextual/read-only where shown.
- Usernames are claimed from a dedicated editor with its own Save username
  action, separate from the page-header Save. A claimed lowercase name is owned
  permanently, including after a rename, and a deliberate claim of a previously
  unowned name starts a 90-day wait before another new name can be claimed.
  Switching to an owned previous name and changing capitalization are not
  affected by that wait.
- Country choices use common English names; search also recognizes familiar
  alternatives and abbreviations such as UK, USA, and Czech Republic. Only the
  existing two-letter country code is saved. The field spans its row, long
  selected names wrap, and the dropdown is capped at 400px. No country is the
  first browsing option for clearing the selection; it is hidden during search.
  The closed control's accessible name includes the current country or the
  empty-selection state. Composing IME keystrokes do not trigger country
  selection. Search queries, English names/aliases, and flag identifiers use
  locale-independent casing.
- OAuth avatars mapped from provider profiles (Google `picture` / GitHub `avatar_url`), DiceBear fallback
- Public identity model carries optional country (approved list), five optional
  social profile links, and a calendar or relative join date derived from the
  immutable account creation time. Author-edited names allow up to 30 Unicode
  code points; existing longer names remain unchanged until the author edits
  them, and identity saving requires a name within the new limit. Introduction
  validation also uses code points,
  and identity and selected-work writes are revision-checked in
  `convex/profiles.ts`. Own-post title search refuses an explicit end cursor
  range before reading the search index, because the index ignores read budgets
  and cannot split, and still rejects an oversized result page before
  per-result hydration. YouTube profile URLs safely normalize Unicode handles.
- Profile details span the editor's centered 760px container, with Featured posts
  below. The post picker opens through Choose posts, Add posts, or Manage posts
  depending on the selection. A fixed modal keeps search, the selection count,
  and a full-width Done button visible while only the results scroll. Outside
  clicks leave it open; Done or Escape dismiss it without scrolling focus.
  Tab or Down moves from search to the first available post, skipping the results
  container. Up/Down navigate available posts without wrapping; Up from the
  first post returns to search, and Enter/Space toggle selection. Post titles
  wrap and have no tooltips. Browsing
  requests 12 rows at a time with title search and Load more. Only published
  posts with stored covers are offered; filtering can yield fewer options or
  an empty page while Load more remains available. A stored cover whose URL is
  unavailable still uses the image fallback and remains selectable. Exhausted
  browse/search messages name cover eligibility rather than implying that no
  published posts exist. The section uses a
  selection count and an ordered list with reorder/removal controls. Unused
  social platforms open through Add social link. There is no separate Location
  field. One header Save button
  becomes actionable when persisted profile details or selected work change and saves each
  changed section independently; loading a saved version explains the loss of
  local edits.
- The picker caches only the at-most-nine selected card summaries across
  searches, evicting removed cards rather than retaining browsing history. It
  subscribes only while its dialog is open, so a closed picker performs no
  browse reads; reopening starts from the first page of the retained search
  term. Chosen posts are checked for existence only, so a published post without
  a stored cover is never treated as deleted.
- The editor keeps identity and selected-work saves independent, preserves
  unsaved input across live updates, and requires an explicit reload on a
  revision conflict. Save and pending pagination remain keyboard-focusable with
  guarded activation; exhausted pagination focuses an available appended post.
  Query echoes cannot roll back newer saved revisions or overwrite a newer
  revert during an in-flight save.

### Analytics

- Private author analytics at `/dashboard/analytics`, scoped to signed-in
  unique readers and labeled honestly as such
- Four summary cards: Unique Readers, Likes Received, Current Followers, and
  New Followers over 30 days
- A 30-day follower-growth chart rendered from the same summary query

### UI/UX

- Landing page sections in `app/(marketing)/_components/`: Hero, Features,
  Recent Posts (Suspense + content-shaped skeleton), Stats
- Shared `PostCard` for the feed, landing, and dashboard preview;
  `DiscoverPostSummary` for Discover; `AuthorPostCard` for the author gallery
  and catalogue
- All post cards share the same small `rounded-md` corner radius across sizes
  and layouts
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
pnpm lint → pnpm exec tsc --noEmit → pnpm test:ci → pnpm test:component → pnpm build
```

### Sessions

- Better Auth uses its installed 1.5.3 defaults: a finite seven-day session
  expiry with a one-day sliding refresh. Resonance has no custom `session`
  configuration or client inactivity logout timer.
