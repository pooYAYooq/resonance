# Project Status

The resume note for returning to Resonance after time away. It holds the
current focus, the next action, blockers, and links. Scope and remaining work
live in [`../ROADMAP.md`](../ROADMAP.md); shipped history lives in
[`../CHANGELOG.md`](../CHANGELOG.md).

## Current focus

v1.0 is Phase 3A complete (decision 3A-024). Phase 3A.3 is the active slice:
Track 1 authoring polish and Track 4 management, navigation, and accessibility,
followed by 3A.4, 3A.5, and release readiness. The single remaining-work list is
in [`../ROADMAP.md`](../ROADMAP.md).

## Next action

Start with V1-01, V1-02, V1-04, and V1-05. V1-03 and V1-07 await the content
width design session. After V1-01 to V1-05 and V1-07 to V1-12 are done and the
author has accepted the authoring journey in the browser, close Track 1 with
V1-06.

## Blockers

- V1-03 and V1-07 await the content width design session.
- V1-15 unsaved-exit guards are in v1.0 but need a dedicated spec before
  implementation.

## Known limitations

- No stored-data migration or backfill exists. The project is not deployed and
  development data is disposable.
- Authenticated owner-scoped post mutation tests remain limited by the Better
  Auth component fixture in `convex-test`; one passing test emits a known
  scheduled-cleanup transaction warning from the fixture.
- Pasted Table-of-Contents anchor links (`#heading`) render as plain text
  because the safe-link allowlist permits only http, https, and mailto, and
  reader headings have no `id`.
- The installed native side-handle menu has no separate "Turn into" surface. The
  side menu is replaced by a custom drag-safe adapter because the Shadcn/Base UI
  handle opened its menu on mousedown.
- An untouched new post can briefly count as dirty because the editor's default
  empty paragraph differs from the `{ blocks: [] }` baseline. Empty snapshots
  are suppressed, so there is no false recovery, but a target switch on a blank
  post may show the in-app transition notice.
- An always-available in-page Discard or Cancel action is not implemented; the
  silent recovery clears the local snapshot on save, revert, or empty.
- `pnpm format:check` reports a pre-existing baseline of unrelated files; no
  changed file is flagged.

## Local design and plan artifacts

Active, local, and untracked:

- `docs/superpowers/plans/2026-09-23-roadmap-scope-sync.md`

Historical artifacts, preserved in place and excluded from active reading.
Each carries its own status notice:

- `docs/superpowers/specs/2026-09-18-full-blocknote-authoring-design.md`
  (completed and implemented)
- `docs/superpowers/specs/2026-09-19-review-surface-design.md` (completed and
  implemented)
- `docs/superpowers/plans/2026-09-20-media-review-correctness.md` (completed)
- The curated BlockNote contract plans are superseded by decision 3A-019. Other
  artifacts in the same folders carry their own status notices.

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
