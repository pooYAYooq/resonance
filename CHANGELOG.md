# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Not released yet. The v1.0 release boundary is Phase 3A complete; remaining
work is tracked in `ROADMAP.md`.

### Added

- Collapsible desktop workspace navigation with an icon rail, accessible
  tooltip labels, and a browser-local preference that survives refreshes.

- Separate Saved and Liked dashboard pages with collapsible relationship-time
  groups, flat mobile rows, cards with 3:2 covers and tags under the cover at
  tablet/desktop widths, page-specific bookmark/heart actions, and no per-card
  saved/liked timestamp. Collapse state is session-scoped per signed-in user and
  collection. Collection search, filters, and exact timestamps remain deferred.

- Focused comment destinations from notifications show the selected comment
  directly, with nearby context, shared reply controls, and a full-article link.
- Engagement notifications for follows, post likes, comments, and comment likes,
  with direct actor/content links, follow-back actions, per-row Undo deletion,
  and confirmed bulk deletion by read state.
- The navbar bell opens a notification drawer without leaving the current page.
  Mobile rows show details directly; larger screens retain independently saved
  expansion and one Expand all/Collapse all toggle.
- Username ownership at `/profile/edit`: a dedicated editor claims a username
  through its own Save username action, separate from the page-header Save.
  Claimed lowercase names are owned permanently, including after a rename, and a
  deliberate claim of a previously unowned name starts a 90-day wait before
  another new name can be claimed. Switching to an owned previous name and
  changing capitalization bypass the wait.
- Every new account (email/password, Google, or GitHub) receives an app profile
  and one generated `Reso_` username in the same transaction as the auth
  account creation, without consuming the 90-day new-name allowance. A one-time
  dashboard welcome remembers its dismissal on the account across sessions and
  browser contexts.
- Human-readable public profile addresses at `/u/<username>`. The canonical
  lowercase spelling renders the profile; every other spelling of an owned name
  (styled, uppercase, or a previous name) redirects to it, and unknown,
  reserved, and deleted-account names return a shared 404. Comment author names
  and every other generated author link resolve to the current lowercase
  username; authors without a username render a plain label.
- Profile editor at `/profile/edit`: edit display name, bio, optional
  country and five social links, and choose up to nine
  ordered published posts. One header Save button applies changed sections
  independently. The forms preserve unsaved input across live updates and
  require an explicit reload on a revision conflict. A centered 760px layout and
  concise Featured posts section keep editing focused; optional social links
  are added from one menu.
- Public author page at `/u/<username>`: a hero band carrying the country and
  join date over the display name, the introduction, fixed secure social links,
  display-only follower/following counts, and the owner's Edit Profile, another
  viewer's Follow, or a signed-out Follow that returns to the page after login.
  A bounded work section shows up to nine author-selected posts three at a time,
  or the three newest published posts when nothing is selected, and a public
  catalogue at `/u/<username>/posts` pages the author's published posts twelve
  at a time. Identity edits, deletions, and counts update live on the author
  page; the catalogue's card list follows published-post changes, while its
  compact header renders on load.
- Limit author-edited display names to 30 Unicode code points with inline
  validation; preserve existing longer names without automatic truncation.
- Public author identity foundation: an optional country from a reviewed local
  list, five validated social profile links, and a calendar or relative join
  date sourced from the immutable account creation time. Identity and
  selected-work edits are revision-checked, and selected work is bounded to nine
  ordered published posts.
- Responsive draft management rows matching My Posts: linked titles, 16:9
  covers with the blank fallback, tags, Last saved dates, and grouped Resume
  and Delete actions. Draft deletion has named-draft confirmation, pending
  protection, retryable errors, and keyboard focus restoration.
- Responsive published-post management rows with linked titles, 16:9 covers,
  dates, tags, read-only engagement, and grouped Edit and Delete actions.
  Published deletion now has named-post confirmation, pending protection,
  retryable errors, and keyboard focus restoration.
- Published post author attribution with an avatar, profile link, stacked
  publication/update dates, and a compact viewer-aware Follow action with equal
  width for Follow and Following labels. Topic links have roomier reader padding
  and labeled navigation, with explicit keyboard
  focus styling for author and topic links.
- Standard Shadcn BlockNote authoring environment with native menus, remote
  embeds, code-language selection, Shiki highlighting, tables, and persistent
  visible Undo/Redo controls.
- Explicit Review step before publish/update: a frozen snapshot of the reviewed
  title, body, tags, cover intent, cover preview, and resolved inline media,
  with Post details hidden and Back plus Publish/Update in the studio header.
  Publication is blocked while inline media or a recovered saved cover is
  unresolved; a newly selected cover uploads on submit and does not block.
- Silent local draft recovery for unsaved new posts and drafts: work is
  snapshotted to `localStorage` and reloaded on return, with no restore prompt.
  Published edits stay page-local in memory until Update Post succeeds.
- Unsaved-exit guards across authoring: app-link departures for new posts and
  drafts store the latest recovery snapshot first (light reminder when storage
  fails, for published edits, or a selected cover File); Back/Forward confirms
  and replays the exact destination through the Navigation API, with a
  synchronous recovery flush on older browsers and for traversals the browser
  cannot cancel; document switches validate the
  destination before clearing the current session's recovery; sign-out offers
  save or discard; and a native browser warning attaches only while unsaved
  work or an unresolved operation exists.
- Start fresh (new posts and drafts) and Cancel update (published edits)
  confirmations that clear only the current session's recovery after verified
  deletion and leave saved drafts, posts, and media untouched.
- Published editing can save one pending update as a draft linked to the live
  post, with a Pending update label in Drafts; promotion updates the same post
  without changing identity, URL, publication date, or engagement.
- Canonical `blocknote@1` document contract validated at both the browser form
  and the Convex write boundary, covered by an all-block round-trip conformance
  test.
- Shared blank cover fallback across cards, Discover summaries, and the reader.
- Authoring media panel: rows name their kind and type, show image thumbnails
  or audio and video glyphs, use plain lifecycle wording, and offer Replace and
  Remove for failed media while resolved inline editing stays in BlockNote.
- Styled cover controls with Add, Replace, and Remove, same-file reselection,
  and an explanation when no cover is selected.
- The authoring title field keeps a persistent underline and receives one-time
  focus when a writing view opens; its placeholder remains readable at 4.92:1
  dark and 4.59:1 light.
- Tag checkboxes show a stronger unchecked border, with a contrasting border on
  keyboard focus when checked.

### Changed

- Keep read notifications for 90 days after reading and unread notifications
  for two years, with daily cleanup that keeps unread badges accurate.
- Follow notifications allow one delivery per follower and recipient every
  seven days. A later follow can create a fresh unread notification while
  preserving earlier history; repeated attempts do not delay eligibility.
- Notifications now represent engagement rather than new-post publication
  fan-out; publishing still updates followers' reader feeds.
- Unread notifications use a subtle row background and a dot beside the time.
  Row interaction marks that notification read; visiting the list or opening
  its drawer, row menu, or bulk expansion controls leaves read state unchanged.
  Mark all as read lives in the toolbar overflow menu. The empty state recovers
  to Discover, and post deletion keeps unread counters consistent through the
  existing bounded cascade.
- Upgraded the pinned Convex dependency from 1.34.0 to 1.46.0 so the installed
  CLI and runtime match the generated AI guidance, which targets 1.44.0 or
  newer. Refreshing the managed AI files restores the upstream
  `convex env list --names-only` confirmation step and retires the local
  correction the older CLI required. Generated types are unchanged, and the
  title-search end-cursor guard stays because read budgets still do not apply to
  search queries.
- Auth sync no longer overwrites an author-owned display name, and it
  initializes the immutable `joinedAt` from the Better Auth creation time once.
- Publishing and published updates now require a usable cover: a JPEG, PNG,
  or WebP image, nonempty and at most 5 MiB, whose stored bytes match the
  declared image signature and are still available. Uploads are verified
  server-side at finalization. Covers can be added before writing or after
  reviewing; preview remains available without one, showing a neutral
  placeholder and a reminder with Add cover at the publication action. A saved
  cover that no longer resolves shows replacement guidance before review
  instead of failing at publication. A selected replacement is checked against
  the same policy before it can satisfy the requirement. Drafts and pending
  edits remain saveable without a cover.
- Adopted the installed standard BlockNote editor; the curated interaction
  contract was retired in favour of the full default authoring experience.
- The authoring studio header condenses the mode, a short intent line, and the
  primary Review action into one block.
- Create is a UX surface: the editor keeps a compact title field and an editing
  heading scale, while the published modular type scale belongs to Review and
  the reader.
- The create studio is one open writing page: the cover sits above the title
  with a dropzone and a published-ratio 16:9 preview, the canvas frames an 808px
  document column, and Post details move into a disclosure with an end-of-page
  marker.
- The published reader aligns its cover, title, metadata, tags, and title
  divider to the site header container around a 700px prose column that
  left-aligns from `xl` up to reserve the wide-screen rail, with a 16:9
  viewport-capped cover and an 18px published body and heading scale.
- Review mirrors the published cover ratio, measure, and title weight, and the
  authoring cover chip previews the published 16:9 crop before Review.
- Tag selection uses the shadcn Checkbox in selectable rows with non-selectable
  labels, capped at five tags.
- Published edits stay page-local and clear stale local recovery snapshots
  instead of writing new ones.
- Keyboard focus is one solid 1px line across controls and links; the soft focus
  halo and double outlines are gone, and the BlockNote editor canvas shows an
  outline where its bundled stylesheet suppressed one.
- The mobile navigation drawer no longer shows a visible Navigation heading:
  the title stays available to screen readers as the dialog's name, and the
  drawer opens straight into its content with the close control clear of the
  first row.

### Fixed

- Anchor the desktop notification bell's unread badge to the bell button. The
  absolutely positioned badge previously anchored to the page corner because
  the button was not a positioned ancestor.
- Preserve keyboard focus through profile saves, picker pagination, and country
  clearing; keep the keyboard-active country visible in its scrolling list.
- Preserve newer profile edits when save responses and live query updates arrive
  in different orders, and ignore late save callbacks after switching accounts.
- Deleting a published post whose cover was also a consumed upload claim could
  wedge the deletion job and leave its dependent rows behind; cleanup now treats
  an already-removed storage object as reclaimed, so the job completes.
- Notification-bell navigation now goes through the authoring exit guard, so
  mobile authors receive the same unsaved-work protection as app-link exits.
- Cancel update releases the session's media claims and cleans temporary
  inline uploads in one transaction before returning to My Posts. Saved
  pending-update media is preserved; a failed request keeps the editor open
  with a retryable error while the claims keep protecting the media.

- Pasted web pages no longer make a post unsaveable: copied CSS colors and
  alignments are normalized to supported values when they enter the editor,
  while text and links are preserved.
- Pasted images, audio, and video whose source cannot be stored (`data:`,
  `blob:`, `cid:`) are removed at paste time with a notice naming how many
  items were dropped.
- An over-capacity paste now reports the exact limit it crossed, such as too
  many blocks, instead of the generic document validity message.
- Media, table, and divider blocks were rejected on save because editor-only
  block identity bypassed the canonical contract.
- Remote safe HTTP(S) embed URLs resolved to an empty string; they now pass
  through unchanged.
- Session-media cleanup helpers called `.paginate()` inside already-paginated
  mutations; they now use bounded `.take()` reads.
- A removed replacement cover stayed in the form and would still upload on
  publish; removal now clears the field.
- A removed-cover intent survived switching targets and could delete the newly
  loaded cover.
- A successful save could re-hydrate the submitted body over edits made while
  the save was in flight.
- A transient failure resolving a recovered cover was treated as a missing
  asset; it now retries with backoff and on focus or reconnect.
- Media availability no longer reads from failed claim bookkeeping, so a
  background protection retry cannot mark a usable image broken.
- Loading saved content no longer adds an undo entry, and a successful save
  resets history only when the live body still matches the submission.
- The overlapping BlockNote tooltip arrow is hidden in both themes.
- Review cover images use the reviewed title as alt text.
- Post titles in the authoring editor wrap instead of scrolling, cap at 100
  characters, show a clear input affordance with hover and focus states, and
  move focus to the body editor on Enter.
- Editor headings no longer inherit BlockNote's 3em default H2; H2-H6 render at
  an editing scale that keeps the post title the largest text in the editor.
- Pasting a line break into the post title could produce a visually blank
  published heading; line breaks now collapse to spaces and whitespace-only
  titles are rejected.
- A malformed editor target id in the `/create` URL (`editPostId` or `draftId`)
  no longer crashes the page: the lookup queries normalize the id and render
  the existing unavailable state, and a rejected pending transition preserves
  the in-editor document.

> Earlier phases between 0.1.0 and this entry are recorded in the git history;
> this changelog resumes at the standard-BlockNote authoring and Review
> baseline.

## [0.1.0] - 2026-04-15

### Added

- Full-stack blogging platform scaffold with Next.js 16 App Router.
- Convex real-time backend with a `posts` table (`title`, `body`, `authorId`).
- Better Auth integration via `@convex-dev/better-auth` with email/password
  authentication and no email verification requirement.
- Login and sign-up auth pages under `/auth`.
- Blog listing route (`/blog`) and post creation route (`/create`).
- shadcn/ui component library with Tailwind CSS v4 as the UI foundation.
- Dark/light theme support powered by `next-themes`.
- Form validation using React Hook Form and Zod.

[Unreleased]: https://github.com/pooYAYooq/resonance/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/pooYAYooq/resonance/releases/tag/v0.1.0
