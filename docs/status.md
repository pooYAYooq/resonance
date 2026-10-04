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

Next: V1-06 Track 1 closure documentation and author browser acceptance.
Wide-screen reader rail contents remain a queued follow-up.

## Blockers

- V1-15 unsaved-exit guards are in v1.0 but need a dedicated spec before
  implementation.

## Known limitations

- The signed-out navbar overflows at 320px and 375px because the authentication
  controls do not fit. The post author section fits at those widths; navbar
  correction remains outside the author-identity task and is tracked in
  ROADMAP.md under V1-23 responsive and interaction polish. Signed-in, the
  theme toggle and account controls overflow at 320px for the same density
  reason, unchanged by V1-11.
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
