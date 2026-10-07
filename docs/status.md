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

Next: fix the malformed editor-target crash recorded with V1-22 in
[`ROADMAP.md`](../ROADMAP.md), so a malformed `editPostId` or `draftId` shows
the unavailable state instead of crashing, on direct navigation and history
transitions alike. The malformed fix is out of scope of the tracked tasks and
remains recorded for a separate bounded fix. No Git actions are approved for
it yet.

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

The dedicated spec for V1-15 unsaved-exit guards remains required before
implementation; see Blockers. Wide-screen reader rail contents remain queued,
and Dashboard Overview purpose and composition remain deferred to a separate
comprehensive design session.

## Blockers

- V1-15 unsaved-exit guards are in v1.0 but need a dedicated spec before
  implementation.

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
- A malformed editor target id in the `/create` URL (`editPostId` or `draftId`)
  crashes the page with a client-side exception: the raw id fails Convex
  argument validation instead of producing the unavailable state. Found during
  the reader/Review parity browser verification by confirming a pending
  transition to a malformed target; direct navigation shares the same path.
  Recorded with V1-22 in ROADMAP.md for a separate bounded fix.
- `pnpm format:check` has a pre-existing baseline of unrelated files. A targeted
  check also flagged implementation files on `fix/reader-review-parity`:
  WorkspaceSidebar, ReviewSurface, the create page, MobileNavMenu, and Navbar.
  They keep the pre-existing formatting baseline; DocumentStudio was formatted
  with its review fix, and the remaining files received targeted edits without a
  full reformat.
- The title's Enter-to-body focus move depends on the dynamic import forwarding
  the body editor handle; the jsdom component tests cannot exercise it, so it is
  browser-verified only.

## Local design and plan artifacts

Active, local, and untracked: none at present. The wide-screen reader rail
design session will add its spec and plan here.

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
