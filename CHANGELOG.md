# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Not released yet. The v1.0 release boundary is Phase 3A complete; remaining
work is tracked in `ROADMAP.md`.

### Added

- Standard Shadcn BlockNote authoring environment with native menus, remote
  embeds, code-language selection, Shiki highlighting, tables, and persistent
  visible Undo/Redo controls.
- Explicit Review step before publish/update: a frozen snapshot of the reviewed
  title, body, tags, cover intent, cover preview, and resolved inline media,
  with Post details hidden and Back plus Publish/Update in the studio header.
  Publication is blocked while inline media or a recovered saved cover is
  unresolved; a newly selected cover uploads on submit and does not block.
- Silent local draft recovery for unsaved new posts and drafts: work is
  snapshotted to `localStorage` and reloaded on return, with no restore prompt
  and no `beforeunload` warning. Published edits stay page-local in memory until
  Update Post succeeds.
- Canonical `blocknote@1` document contract validated at both the browser form
  and the Convex write boundary, covered by an all-block round-trip conformance
  test.
- Shared blank cover fallback across cards, Discover summaries, and the reader.
- Authoring media panel: rows name their kind and type, show image thumbnails
  or audio and video glyphs, use plain lifecycle wording, and offer Replace and
  Remove for failed media while resolved inline editing stays in BlockNote.
- Styled cover controls with Add, Replace, and Remove, same-file reselection,
  and an explanation when no cover is selected.

### Changed

- Adopted the installed standard BlockNote editor; the curated interaction
  contract was retired in favour of the full default authoring experience.
- The authoring studio header condenses the mode, a short intent line, and the
  primary Review action into one block.
- Create is a UX surface: the editor keeps a compact title field and an editing
  heading scale, while the published modular type scale belongs to Review and
  the reader.
- The create studio places the cover above the title with a dropzone and 3:2
  preview, frames the canvas in a full-height document card on a muted desk, and
  moves Post details into a bordered row with an end-of-page marker.
- Tag selection uses the shadcn Checkbox in selectable rows with non-selectable
  labels, capped at five tags.
- Published edits stay page-local and clear stale local recovery snapshots
  instead of writing new ones.

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
