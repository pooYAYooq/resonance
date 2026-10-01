# Project Status

The resume note for returning to Resonance after time away. It holds the
current focus, the next action, blockers, and links. Scope and remaining work
live in [`../ROADMAP.md`](../ROADMAP.md); shipped history lives in
[`../CHANGELOG.md`](../CHANGELOG.md).

## Current focus

v1.0 is Phase 3A complete (decision 3A-024). Phase 3A.3 is the active slice:
Track 1 authoring polish and Track 4 management, navigation, and accessibility,
followed by 3A.4, 3A.5, and release readiness. The single remaining-work list is
in [`../ROADMAP.md`](../ROADMAP.md). The content width design session completed
on 2026-09-30; its reader, published scale, and Review work shipped in PR #82
(merged as `d64cab5`).

## Next action

The content width work shipped in PR #82 (`d64cab5`) with per-task browser
acceptance recorded: the reader frame and published scale, the heading rhythm,
Review parity, and the wide-screen rail reservation. Next: V1-08 author identity
on the post page, then V1-09 to V1-12, then the V1-06 Track 1 closure. The
wide-screen reader rail contents remain the first queued reader follow-up and
pair with the author identity decision. The `feat/post-author-identity` branch
carries the roadmap status correction and this documentation sync; V1-08 starts
from it.

## Blockers

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
- `pnpm format:check` reports a pre-existing baseline of unrelated files; no
  changed file is flagged.
- The title's Enter-to-body focus move depends on the dynamic import forwarding
  the body editor handle; the jsdom component tests cannot exercise it, so it is
  browser-verified only.

## Local design and plan artifacts

Active, local, and untracked: none at present. The wide-screen reader rail
design session will add its spec and plan here.

Historical artifacts, preserved in place and excluded from active reading:

- `docs/superpowers/specs/2026-09-30-reader-width-design.md` (implemented;
  parts superseded during browser acceptance; shipped in PR #82)
- `docs/superpowers/plans/2026-09-30-reader-width.md` (completed; shipped in
  PR #82)
- `docs/superpowers/plans/2026-09-27-typography-font-application.md` (applied;
  shipped in PR #82)
- `docs/superpowers/plans/2026-09-23-roadmap-scope-sync.md` (completed audit)
- `docs/superpowers/specs/2026-09-18-full-blocknote-authoring-design.md`
  (completed and implemented)
- `docs/superpowers/specs/2026-09-19-review-surface-design.md` (completed and
  implemented)
- `docs/superpowers/plans/2026-09-20-media-review-correctness.md` (completed)
- The curated BlockNote contract plans are superseded by decision 3A-019.
  Older artifacts in the same folders are historical; a few predate the
  status-notice convention and carry no notice of their own.

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
