# Project Status

This is the resume point for returning to Resonance after time away.

## Current phase

Phase 2.8 — Analytics Dashboard UI (up next)

## Next focus

Phase 2.7 — Analytics Foundation is shipped. Phase 2.8 is the next focus.

## Current verification

- `pnpm lint` — passed.
- `pnpm test:ci` — passed: 16 files, 162 tests.
- `pnpm test:component` — passed: 44 files, 244 tests.
- `pnpm build` — passed, including TypeScript validation.
- `git diff --check` — passed.
- Task 6 targeted Convex and component tests — passed.
- Task 6 targeted Prettier checks — passed.
- Follow-counter contract cleanup — `npx tsc --noEmit` passed; required
  counters replace the removed compatibility paths.
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
- Phase 2.6 — Post Editing
- Phase 2.7 — Analytics Foundation

## Where to continue

- Detailed roadmap: [`FEATURES.md`](../FEATURES.md)
- Architecture reference: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)
- Next focus: Phase 2.8 — Analytics Dashboard UI

## Status maintenance

Keep this file concise. Update the current phase, next task, and completed
phase list when work ships. Do not duplicate task-level implementation details
from `FEATURES.md` or individual plans here.
