# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Not released yet. The v1.0 release boundary is Phase 3A complete; remaining
work is tracked in `ROADMAP.md`.

### Added

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
  synchronous recovery flush on older browsers; document switches validate the
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

### Fixed

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
