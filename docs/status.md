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

V1-08 implementation and browser acceptance are complete on
`feat/reader-author-identity`: author avatar and profile link, stacked dates with
stronger labels, roomier topic links, and a compact viewer-aware Follow action.
On 2026-10-02, the user approved the final design and stable button width after
testing Follow with a different account. Colors remain unchanged and are deferred
to V1-21. Next: review and integrate the local fixes, then monitor checks on
[PR #85](https://github.com/pooYAYooq/resonance/pull/85), then await maintainer
review and merge. The local review fixes correct this resume note and hide Follow
when the author profile is missing, while preserving readable post attribution.
These fixes await PR review and maintainer merge. V1-09 to V1-12 follow, then
V1-06 closure; wide-screen reader rail contents remain the queued reader follow-up.

Browser checks cover 320, 375, 768, and 1280px in light/dark themes, including a
long unbroken author-name fixture, visible keyboard focus, and signed-out Follow
redirecting to login with the post return path. The entrance animation was
disabled in the browser probe to isolate layout. Byline controls and topic links
remain within the viewport; the existing signed-out navbar overflow is separate.

Fresh verification of the review fixes on 2026-10-02: lint, 37 files / 503 backend
tests, 78 files / 508 component tests, build with TypeScript, and whitespace checks
passed. Missing-profile and blank-name/no-stored-avatar regression cases passed.
The browser-only label-swap probe measured 105px for both Follow and Following
at all four widths. CodeRabbit's review of the local review fixes reported zero
findings.

## Blockers

- V1-15 unsaved-exit guards are in v1.0 but need a dedicated spec before
  implementation.

## Known limitations

- The signed-out navbar overflows at 320px and 375px because the authentication
  controls do not fit. The author byline and topic links fit at those widths;
  navbar correction remains outside the author-identity task and is tracked in
  ROADMAP.md under V1-23 responsive and interaction polish.
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
