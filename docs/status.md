# Project Status

The resume note for returning to Resonance after time away. It holds the
current focus, the next action, blockers, and links. Scope and remaining work
live in [`../ROADMAP.md`](../ROADMAP.md); shipped history lives in
[`../CHANGELOG.md`](../CHANGELOG.md).

## Current focus

v1.0 is Phase 3A complete (decision 3A-024). Phase 3A.3 is the active slice:
Track 4 management, navigation, and accessibility, followed by 3A.4, 3A.5, and
release readiness. The single remaining-work list is
in [`../ROADMAP.md`](../ROADMAP.md). The content width design session completed
on 2026-09-30; its reader, published scale, and Review work shipped in PR #82
(merged as `d64cab5`).

## Next action

Reader/Review parity and shared responsive navigation shipped in
[PR #96](https://github.com/pooYAYooq/resonance/pull/96), merged as `4a306af`.
The late review follow-up shipped in
[PR #97](https://github.com/pooYAYooq/resonance/pull/97), merged as `d2f9b3d`:
the preview identity query is locally gated on resolved authentication, and
published-edit Review previews a monotonic pending-update date. Merged main
passed lint, 504 edge-runtime tests, 564 component tests, and build. Both
feature branches were removed after verifying their commits were merged.
The maintainer approved keeping Dashboard in the shared sidebar and drawer;
the deferred Overview redesign and the drawer's visible Navigation heading
remain with their design entries.

The malformed editor-target fix shipped in
[PR #99](https://github.com/pooYAYooq/resonance/pull/99), merged as `60c992b`,
and its feature branch was removed. `getDraftById` and
`getPublishedPostForEditing` accept the URL-derived id as a string and resolve
it with `ctx.db.normalizeId`, so a malformed value returns null and shows the
existing unavailable state on direct navigation and pending transitions alike,
preserving the in-editor document. Backend and component regression tests cover
both cases; verification passed lint, 506 edge-runtime tests, 567 component
tests, and the production build on 2026-10-07. Browser acceptance covered
malformed `draftId` and `editPostId` direct navigation, a dual-target request,
a history Back transition with unsaved content, and Review preservation, with
no client-side exceptions and no test data persisted. Next: V1-16
accessibility evidence; the V1-22 shared page-state work stays Todo.

V1-08 shipped in [PR #85](https://github.com/pooYAYooq/resonance/pull/85), merged
as `4c94efe`. Follow colors remain deferred to V1-21.

V1-09 shipped in [PR #86](https://github.com/pooYAYooq/resonance/pull/86), merged
as `25705e0`. Its reader-only Like and Save controls sit after the article and
before discussion. Browser verification covered authenticated toggles, keyboard
focus, and responsive layouts; signed-out browser acceptance remains unverified
as recorded in ROADMAP.md. The comments shortcut beside estimated reading time
and commenter profile links remain deferred follow-ups in ROADMAP.md.

V1-10 is complete without a UI change. Browser verification confirmed an
author-created post-body link stays underlined at rest, changes color on hover,
and remains visible without clipping at 320, 375, 768, and 1280px in both themes.

V1-11 dark-mode contrast and focus is complete on
`accessibility/dark-mode-contrast-focus` and ships with its documentation record
in the same change: solid 1px keyboard focus across reader and authoring
surfaces, an underlined title field with one-time initial focus, and stronger
unchecked tag borders. Browser verification covered both themes at 320, 375,
768, and 1280px; the light-theme primary text and focus-border observations are
recorded for V1-21.

V1-12 is complete without a code change. Browser verification on a published post
confirmed every H3 body heading rendered its text at the published scale and the
divider rendered at the prose measure, with no clipping at 320, 375, 768, and
1280px in both themes. The audit's perceived gap was an empty authored paragraph
next to the divider, not a lost block.

V1-06 closed Track 1 on 2026-10-05. Author browser acceptance on the merged
revision passed the authoring and reader journeys at 320, 375, 768, and 1280px in
both themes with no regression, so the closure changed documentation only; the
full record is in ROADMAP.md.

V1-13 and its diagnostics follow-up shipped in merged PRs #92 and #93.

V1-14 shipped in [PR #94](https://github.com/pooYAYooq/resonance/pull/94), merged
as `5426bcd`. Drafts use My Posts-style management rows with 16:9 covers and the
shared blank fallback, Last saved dates, and Resume/Delete actions; deletion has
a named confirmation with pending protection and focus restoration. The user
reported browser acceptance for covers, Resume, deletion, and responsive themes;
pagination is automated-test verified. The merged revision re-passed lint, 504
edge-runtime tests, 552 component tests, and the production build on 2026-10-06.

V1-15 unsaved-exit guards are complete on `design/unsaved-exit-guards` and
ship with their documentation record in the same change: verified silent
recovery before app-link departures, light Back/Forward and document-switch
confirmations, stronger sign-out choices, the native warning only while work
is unsaved, and one pending update for published edits. The history proof
gate closed by agreeing evergreen browser coverage (the Navigation API is
Baseline since January 2026) with a synchronous recovery flush on older
browsers. Next: V1-16 accessibility evidence. Wide-screen reader rail contents
remain queued, and Dashboard Overview purpose and composition remain deferred
to a separate comprehensive design session.

PR #101 review follow-ups fixed notification-bell navigation bypassing the
authoring guard and closed two cleanup-review rounds: Cancel update now
releases the session's media claims and cleans temporary inline uploads in
one transaction, so a failed request leaves the claims protecting the media
and retry stays safe, while saved pending-update media is preserved and the
editor stays open on failure. The claim mutation keeps refusing released
claims by design; the release helper is shared with the standalone release
mutation. Cover-removal-only Start fresh and Cancel update were verified to
already confirm (removing a cover clears the proposal's cover id, which
differs from the baseline) and are pinned by regression tests. The
staged-index finding does not apply to the recorded undeployed, disposable-
data setup; a large existing deployment would require a separate staged-index
backfill before enabling callers. The follow-up passed lint, 622 edge-runtime
tests, 650 component tests across 82 files, and the production build on
2026-10-09; Git approval gates are pending before updating the PR.

## Blockers

- None.

## Known limitations

- Mobile account and theme controls now live in the shared drawer rather than
  the navbar below 768px. Authenticated responsive navigation received browser
  acceptance; signed-out browser acceptance at 320px and 375px remains
  unverified and stays with V1-23 in ROADMAP.md.
- No stored-data migration or backfill exists. The project is not deployed and
  development data is disposable.
- Authenticated owner-scoped post mutation tests remain limited by the Better
  Auth component fixture in `convex-test`; one passing test emits a known
  scheduled-cleanup transaction warning from the fixture.
- Pasted Table-of-Contents anchor links (`#heading`) render as plain text
  because the safe-link allowlist permits only http, https, and mailto, and
  reader headings have no `id`.
- HTML drag-and-drop can still introduce the pasted-content shapes that paste
  now repairs at paste time, because BlockNote exposes no drop hook; such a drop
  falls back to the specific save-time message instead of the paste notice.
- The installed native side-handle menu has no separate "Turn into" surface. The
  side menu is replaced by a custom drag-safe adapter because the Shadcn/Base UI
  handle opened its menu on mousedown.
- An untouched new post can briefly count as dirty because the editor's default
  empty paragraph differs from the `{ blocks: [] }` baseline. Empty snapshots
  are suppressed, so there is no false recovery, but a target switch on a blank
  post may show the in-app transition notice.
- An always-available in-page Discard or Cancel action is not implemented; the
  silent recovery clears the local snapshot on save, revert, or empty.
- `pnpm format:check` has a pre-existing baseline of unrelated files. A targeted
  check also flagged implementation files on `fix/reader-review-parity`:
  WorkspaceSidebar, ReviewSurface, the create page, MobileNavMenu, and Navbar.
  They keep the pre-existing formatting baseline; DocumentStudio was formatted
  with its review fix, and the remaining files received targeted edits without a
  full reformat.
- The title's Enter-to-body focus move depends on the dynamic import forwarding
  the body editor handle; the jsdom component tests cannot exercise it, so it is
  browser-verified only.
- Browsers without the Navigation API (pre-Firefox 147, pre-Safari 26.2) cannot
  cancel Back/Forward; they flush the latest new/draft recovery synchronously
  instead. Published edits and a selected cover File can still be lost on
  Back/Forward there, with no dialog. Firefox and Safari were not manually
  exercised.
- Native beforeunload wording is browser-controlled and may not appear; crashes
  and forced shutdowns can still lose work, and unload performs no server save
  or upload.
- A cover removal alone still confirms lightly on app navigation even though
  the recovery snapshot can represent it, because an effectively-empty draft
  cannot (the removal would be lost silently). A validated target switch can
  clear recovery just before a page-level adoption rejection; the in-memory
  document is retained in that narrow race.
- A draft first saved from a new post keeps the `/create` URL, so the sidebar
  New Post link resolves to the same URL and does nothing in that session
  (Start fresh opens a new post instead). The URL is not rewritten after the
  first save.
- `pnpm test:component` parallel runs are flaky under worker contention; the
  single-worker run is the authoritative component-suite evidence.

## Local design and plan artifacts

None active. The V1-15 spec, plan, and execution ledger were archived to
`/home/studio/projects/resonance-docs-archive/superpowers-2026-10-09/` on the
maintainer's workstation and removed from the worktree.

Completed task artifacts are archived and removed rather than preserved in
place; see the artifact lifecycle in `AGENTS.md` ("Documentation"). The
shipped Track 1 specs and plans were archived on 2026-10-02 to
`/home/studio/projects/resonance-docs-archive/superpowers-2026-10-02/` on the
maintainer's workstation. That archive is local-only and is not part of a
clone; the tracked docs remain the durable record.

## On-demand references

- Scope and remaining work: [`../ROADMAP.md`](../ROADMAP.md)
- Product direction and review gates: [`docs/PHASE_3A.md`](PHASE_3A.md)
- Cross-cutting decisions: [`docs/PHASE_3A_DECISIONS.md`](PHASE_3A_DECISIONS.md)
- Shipped capabilities: [`../FEATURES.md`](../FEATURES.md)
- Architecture: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)

## Status maintenance

Keep this file short. Update the focus, next action, and blockers when work
ships; put scope and progress in `ROADMAP.md`; put shipped history in
`CHANGELOG.md`.
