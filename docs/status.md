# Project Status

This is the resume point for returning to Resonance after time away.

## Current phase

Phase 2.5 — Author Dashboard (complete)

## Next focus

The canonical development model is active: structured BlockNote bodies,
required lifecycle status, published-only public readers, owner-scoped drafts,
and the `saveDraft` -> `publishPost` transition are implemented. The private
author workspace now lives at `/dashboard` with canonical Drafts, Published,
and Saved sections. No deployment migration has been run or is required for
this disposable development database.

## Current verification

- `pnpm lint` — passed.
- `pnpm test:ci` — passed: 14 files, 141 tests.
- `pnpm test:component` — passed: 42 files, 219 tests after route cleanup.
- `pnpm build` — passed, including TypeScript validation and canonical dashboard
  routes; removed `/drafts` and `/reading-list` routes are absent.
- `git diff --check` — passed.
- Known limitation: authenticated owner-scoped post mutation tests remain
  limited by the Better Auth component fixture in `convex-test`.
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
- Phase 2.3 — Structured Content Publishing
- Phase 2.4 — Drafts & Publishing Workflow
- Phase 2.5 — Author Dashboard

## Where to continue

- Detailed roadmap: [`FEATURES.md`](../FEATURES.md)
- Architecture reference: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)
- Next focus: Phase 2.6 — Post Editing

## Status maintenance

Keep this file concise. Update the current phase, next task, and completed
phase list when work ships. Do not duplicate task-level implementation details
from `FEATURES.md` or individual plans here.
