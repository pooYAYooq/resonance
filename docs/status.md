# Project Status

This is the resume point for returning to Resonance after time away. It replaces
the previous append-only verification log; detailed history now lives in a
bounded section at the end and in the tracked plan/commit record.

## Current phase

Phase 3A.3 — Writing & Management — current.

Track 2 (persistence, retry, session, and media safety), Track 3 (long-form
content and discovery), and Phase 3A.0–3A.2 are shipped. Track 1 (authoring
workspace and BlockNote experience) shipped its standard-editor and Review
baseline to `main` in PR #72; the track remains open on the UI/UX follow-up
backlog below.

## Current focus

Track 1 — Authoring Workspace and BlockNote Experience (post-merge follow-ups).

The authoring surface is the installed standard Shadcn BlockNote editor with a
safe canonical `blocknote@1` document contract and a React-only public reader.
Headings reserve H1 for the post title: body headings are H2–H6, default H2, and
toggle headings are disabled.

The serialization seam is repaired and shipped. Editor-only block identity (`id`)
no longer bypasses the canonical contract, native unset table column widths are
accepted and normalized to `null`, and a round-trip conformance test drives one
of every enabled default block through editor serialization → `parsePostBody` →
`PostBody`. Before the repair, media, table, and divider blocks were rejected on
save.

Manual browser acceptance passed the heading, paste, table/list/code, and
publish/reader journeys, and surfaced two gaps that are now fixed and shipped:
`resolveFileUrl` returned an empty string for remote Embed URLs (so native
remote image/video embeds broke), and the reset had removed the visible
Undo/Redo controls. Remote safe HTTP(S) URLs now pass through unchanged, and a
persistent icon-based history control renders above the editor.

Authoring resilience now works silently: while a new-post or draft session is dirty the canonical
proposal is snapshotted to `localStorage` (debounced, flushed on `pagehide`),
and a stored snapshot is loaded back into the form and editor during hydration
with no prompt. The snapshot is cleared when the session turns clean, and
effectively-empty snapshots are ignored, so removed content does not resurrect.
There is no `beforeunload` warning. Browser-confirmed by the author. An
always-available in-page Discard/Cancel button remains deferred.

Browser follow-up fixes are implemented: published edits now stay in page
memory and clear stale local recovery snapshots; media availability no longer
feeds failed claim state back into the display; upload protection retries remain
internal. Saved-content hydration is excluded from undo history, and successful
saves reset history when no later body edits are present. Later in-flight edits
keep their history. The overlapping BlockNote tooltip arrow is hidden in both
themes. Browser acceptance passed for tooltips, existing published images,
abandoning edits, and Undo/Redo after saving; the fixes are merged in PR #76. A
final cross-PR browser pass over the three follow-up batches on the merged
revision also passed.
Automated verification: lint, TypeScript, targeted Prettier, and diff checks
pass; edge tests pass (36 files / 484 tests), and component tests pass (76 files /
458 tests). The production build passes with network access for Google Fonts;
the initial restricted-network attempt could not fetch the fonts.

The Review slice is implemented, browser-tested, and shipped in PR #72. The
browser run confirmed the frozen preview, the media gate, and Publish/Update,
and surfaced authoring issues tracked as the follow-up backlog below: editor
title sizing, media-state wording and affordances, layout consistency, reader
typography, and the reader page's author identity and engagement controls.

The follow-ups execute as small batched changes. Batch 1 delivers the shared
blank cover fallback across cards, Discover summaries, and the reader; a missing
cover renders a blank transparent surface with a subtle bottom border. Adopting
the same cover component in Review is deferred to the frozen-Review batch, so
card/Review/reader parity is not claimed yet.

Batch 2 delivers the authoring media panel: inline rows carry their media type,
so images show thumbnails while audio and video show recognizable glyphs
instead of broken images; lifecycle labels are plain (Selected, Uploading...,
Finishing upload..., Ready to publish, or the specific error); failed inline
rows expose Replace and Remove while resolved inline media stays editable in
BlockNote; and the cover controls are styled Add, Replace, and Remove buttons
with same-file reselection. A selected cover states that it uploads on save or
publish, and an empty cover states that the post will show without a cover
image.

Batch 3 freezes Review and submits what the author reviewed. Entering Review
validates the publication schema and captures an immutable snapshot of the
title, body, tags, cover intent, cover preview, and resolved inline media;
Review renders only that snapshot, Post details are hidden, and Back plus
Publish/Update move into the header under a Review label. Submission validates
and publishes the snapshot rather than the live form, guarded against an
in-flight write, a pending target switch, and a media blocker. A recovered
saved cover keeps its stored intent: it holds Review and publish/update while it
resolves or is unavailable, shows a loading or failure message with Replace and
Remove in the cover area, and never drops the cover silently. A media failure
while Review is open surfaces the blocker alert and disables publishing, and
cards, Review, and the reader now share the blank cover fallback.

## Baseline status (merged to `main`)

- The standard-BlockNote authoring and review flow, the authoring baseline
  recovery, and the documentation reconciliation are merged to `main` in PR #72
  (merge commit `1bc54ef`). `origin/main` is the source of truth.
- PR review is closed: every Codex P1/P2, Qodo High/Medium, and CodeRabbit
  finding was addressed before the merge. Reviewer dispositions that did not
  change code are recorded in the PR thread.
- Automated gate green at merge time: `pnpm lint`, `pnpm build`, targeted
  Prettier, and `git diff --check`.
- `pnpm test:ci` — 33 files, 457 tests. `pnpm test:component` — 75 files, 409
  tests.
- Manual browser acceptance: headings, paste with single undo, table/lists/code,
  publish/reader, remote embeds, visible Undo/Redo, and silent recovery are
  accepted. Review and layout are browser-tested with follow-ups open.
- `feature/media-authoring` was deleted locally and remotely after the merge.
  Work continues on `docs/sync-project-state`. `docs/superpowers/**` stays
  untracked.
- Repository-wide `pnpm format:check` still reports the known pre-existing
  baseline of unrelated files; every file changed by this work passes targeted
  Prettier.

## Open authoring follow-ups (browser audit)

The Review browser pass produced a 29-item audit. Batches 1 to 3 delivered the
cover, media-panel, and frozen-Review slices. A static re-verification pass
confirmed the first-publish cover and code block, reader typography, remove
cover, action hierarchy, undo/redo placement, the editor canvas border, the
sidebar glyph, and the dark-mode tokens were already fixed, so they are no
longer tracked here.

Still open after the three batches:

- Editor title renders at body size: the shared `Input` base ships `md:text-sm`,
  which overrides the title's `sm:text-5xl` at desktop widths.
- Code blocks lose syntax highlighting in the published-edit editor while New
  Post and Review highlight them.
- Editor, Review, and reader use inconsistent widths and spacing; reader
  content is too narrow on wide screens.
- Reader links are not visually distinct; the post page has no author identity;
  reaction, bookmark, and comment controls are small and low-emphasis.
- Design system: unstyled tag checkbox grid, dark-mode contrast and focus, the
  H3/Divider gap (which needs a content check rather than a code fix), and the
  remaining ratio consistency between cards and the reader.

## Next focus

Close the follow-up backlog above in small focused batches; those issues are the
gap between the shipped Review slice and its full acceptance. Re-verify the
likely-already-fixed items in a fresh browser run before opening issues.

Batch 1 (shared blank cover fallback across cards, Discover summaries, and the
reader) is complete; batch 2 delivers the authoring media panel; batch 3
delivers the frozen Review and snapshot submission. The remaining browser-audit
items above stay open.

1. Media authoring, Review readiness, frozen Review, and snapshot submission —
   delivered in the three batched changes, merged to `main` in PRs #74, #75, and
   #76; prior browser acceptance is complete, the follow-up review fixes are
   merged, and the final cross-PR browser pass on the merged revision passed.
2. Remaining editor, reader, and design-system audit items — still open.
3. Authoring browser journey evidence — capture the journeys once the remaining
   fixes land.

After Track 1 and Track 4, the Phase 3A.3 release tasks apply: the `FEATURES.md`
acceptance matrix, `package.json` release checks, human review checklist, PR, and
worktree cleanup. Track 4 (management, deletion, exit guards, accessibility
evidence) is separate. The merged baseline is on `main`; docs-sync and follow-up
work proceed on non-`main` branches under PR review.

## Authoritative direction

- Authoring design:
  `docs/superpowers/specs/2026-09-18-full-blocknote-authoring-design.md`.
- Baseline recovery design and plan:
  `docs/superpowers/specs/2026-09-18-authoring-baseline-recovery-design.md`,
  `docs/superpowers/plans/2026-09-18-authoring-baseline-recovery.md`.
- Drag-handle design and plan:
  `docs/superpowers/specs/2026-09-18-drag-handle-menu-design.md`,
  `docs/superpowers/plans/2026-09-18-drag-handle-menu.md`.
- Authoring resilience design and plan:
  `docs/superpowers/specs/2026-09-18-authoring-resilience-design.md`,
  `docs/superpowers/plans/2026-09-18-authoring-resilience.md`.
- Review surface design and plan:
  `docs/superpowers/specs/2026-09-19-review-surface-design.md`,
  `docs/superpowers/plans/2026-09-19-review-surface.md`.
- Superseded for editor authoring (kept as history): Section 7 of
  `docs/superpowers/specs/2026-09-07-writing-management-design.md`,
  `docs/superpowers/plans/2026-09-07-authoring-blocknote.md`, and
  `docs/superpowers/plans/2026-09-16-track1-task3-completion.md`.
- Tracked docs reconciled to the standard-editor reality: `FEATURES.md`,
  `docs/ARCHITECTURE.md`, and this file.

## Known limitations

- No stored-data migration or backfill exists. The project is not deployed and
  development data is disposable.
- Authenticated owner-scoped post mutation tests remain limited by the Better
  Auth component fixture in `convex-test`; one passing test emits a known
  scheduled-cleanup transaction warning from the fixture.
- Pasted Table-of-Contents anchor links (`#heading`) render as plain text
  because the safe-link allowlist permits only http/https/mailto and reader
  headings have no `id`.
- The installed native side-handle menu has no separate "Turn into" surface. The
  side menu is replaced by a custom drag-safe adapter because the Shadcn/Base UI
  handle opened its menu on mousedown.
- An untouched new post can briefly count as dirty because the editor's default
  empty paragraph differs from the `{ blocks: [] }` baseline. Empty snapshots
  are suppressed so there is no false recovery, but a target switch on a blank
  post may show the in-app transition notice.
- An always-available in-page Discard/Cancel action is not implemented; the
  silent recovery clears the local snapshot on save, revert, or empty.

## Completed phases

- Phase 0 — Foundation Fix
- Phase 1.0 — Backward-compat cleanup
- Phase 1A — Identity & Engagement
- Phase 1B — Curation & Connection, including 1.7 Reader Feed
- Phase 1C — Discovery & Polish, including 1.8 Post Tags
- Phase 2.1 — Rich Text Editor Foundation
- Phase 2.2 — Inline Image Support
- Phase 2.3 — Structured Content Publishing
- Phase 2.4 — Drafts & Publishing Workflow
- Phase 2.5 — Author Dashboard
- Phase 2.6 — Post Editing
- Phase 2.7 — Analytics Foundation
- Phase 2.8 — Analytics Dashboard UI
- Phase 3A.0 — UX Correctness
- Phase 3A.1 — Product Structure
- Phase 3A.2 — Discover Foundations

## History (bounded summary)

- Track 2 persistence/retry/session/media safety shipped; Track 3 long-form
  content and native Search verification shipped.
- Phase 3A.0–3A.2 shipped: UX correctness, product structure (shells,
  Profile/Settings, analytics relocation), and Discover foundations (Search,
  Latest, Topics, Feed recovery; Hot deferred).
- Track 1 Task 1 (Document Studio shell and mode contract, PR #68) and Task 2
  (session reducer, hydration, dirty baselines, PR #69) shipped.
- Track 1 Task 3 (curated BlockNote interaction contract plus code-block
  highlighting) merged in PR #70 (`906f0d3`), followed by a contrast and
  accessibility correction.
- The authoring surface was then reset to the installed standard Shadcn
  BlockNote UI to adopt the full default authoring experience. The curated
  editor contract and its plans are now superseded, and the standard-editor
  direction was written up as the 2026-09-18 full-BlockNote design and plan.
- The authoring baseline recovery fixed the serialization seam, added the
  all-block round-trip conformance test, and reconciled the conflicting
  documentation direction. It shipped to `main` in PR #72 (`1bc54ef`) together
  with the standard-BlockNote authoring and Review flow.
- The standard-editor adoption also surfaced two runtime defects that are now
  fixed: the Shadcn/Base UI drag handle opened its menu on mousedown (replaced
  with a drag-safe click-opened handle), and the session-media cleanup helpers
  called `.paginate()` inside already-paginated mutations, which Convex rejects
  ("multiple paginated queries"). The helpers now use bounded `.take()` reads,
  guarded by a test, because `convex-test` does not enforce that runtime rule.
- Authoring resilience shipped as silent local autosave and auto-load after an
  explicit restore/discard prompt proved noisy and a `beforeunload` warning was
  intrusive. The remote-embed and Undo/Redo follow-ups are browser-accepted.
- PR #72 ("Adopt the standard BlockNote authoring and review flow") merged the
  authoring baseline, silent recovery, drag-safe handle, remote embeds, visible
  Undo/Redo, and the Review surface to `main`. `feature/media-authoring` was
  deleted locally and remotely afterwards.

## Where to continue

- Delivery map and human review gates: [`docs/PHASE_3A.md`](PHASE_3A.md)
- Cross-cutting decisions: [`docs/PHASE_3A_DECISIONS.md`](PHASE_3A_DECISIONS.md)
- Roadmap: [`FEATURES.md`](../FEATURES.md)
- Architecture: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)

## Status maintenance

Keep this file concise. It is a resume point, not a log. Update the current
phase, focus, and baseline status when work ships; replace stale headline state
instead of appending below it; and keep detailed history in the tracked
plans/commits. Before staging, committing, or opening a PR, follow the mandatory
human review gates in `docs/PHASE_3A.md`.
