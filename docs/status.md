# Project Status

This is the resume point for returning to Resonance after time away.

## Current phase

Phase 2.2 — Inline Image Support (complete)

## Next focus

Phase 2.3 — Structured Content Publishing. Phase 2.2 supports published,
block-level images with required alt text and optional captions. Drafts, editing,
paragraph-inline images, and general storage garbage collection remain out of
scope. Convex owner-scoped mutation tests remain limited by the Better Auth
component fixture in `convex-test`.

## Phase 2.2 verification

- `pnpm lint` — passed.
- `pnpm test:ci` — passed: 14 files, 125 tests.
- `pnpm test:component` — passed: 29 files, 178 tests.
- `pnpm build` — passed, including TypeScript validation.
- Security review confirmed owner-bound claims, canonical storage IDs, exact
  image props, atomic claim consumption, bounded cleanup, and omission of
  unresolved URLs.
- Scope review confirmed cover images, legacy bodies, listing/excerpt paths,
  and existing safety bounds remain compatible. No drafts, editing,
  paragraph-inline images, or general storage garbage collection were added.
- The Convex test harness prints a scheduled-cleanup transaction warning in one
  passing test; it is a fixture limitation, not a failing assertion.

## Completed phases

- Phase 0 — Foundation Fix
- Phase 1.0 — Backward-compat cleanup
- Phase 1A — Identity & Engagement
- Phase 1B — Curation & Connection, including 1.7 Reader Feed
- Phase 1C — Discovery & Polish, including 1.8 Post Tags
- Phase 2.1 — Rich Text Editor Foundation
- Phase 2.2 — Inline Image Support

## Where to continue

- Detailed roadmap: [`FEATURES.md`](../FEATURES.md)
- Architecture reference: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)
- Current task plan: [`docs/superpowers/plans/`](superpowers/plans/)

## Status maintenance

Keep this file concise. Update the current phase, next task, and completed
phase list when work ships. Do not duplicate task-level implementation details
from `FEATURES.md` or individual plans here.
