# Project Status

This is the resume point for returning to Resonance after time away.

## Current phase

Phase 3 — The Platform (up next)

## Next focus

Phase 2.8 — Analytics Dashboard UI is shipped. Phase 3 is the next focus.

## Current verification

- `pnpm lint` — passed.
- `pnpm test:ci` — passed: 16 files, 163 tests.
- `pnpm test:component` — passed: 45 files, 251 tests.
- `pnpm build` — passed, including TypeScript validation.
- `git diff --check` — passed.
- Phase 2.8 targeted Convex and component tests — passed.
- Phase 2.8 chart and summary Prettier checks — passed.
- Phase 2.8 tooltip polish chart tests — passed: 6 tests.
- Tooltip primitive and chart Prettier checks — passed.
- Tooltip polish full verification — passed: lint, 16 files/163 backend tests,
  45 files/249 component tests, production build, and `git diff --check`.
- Chart scale and hover emphasis correction — targeted chart tests passed: 6
  tests; full verification passed: lint, 16 files/163 backend tests, 45
  files/251 component tests, production build, Prettier, and `git diff --check`.
- Manual authenticated dashboard verification — partially completed: four cards
  appear before previews, sparse dates and mobile layout are usable, and the
  zero-state caption is correct. Nonzero bar proportionality and the
  card/series sum remain unverified because no follower-growth data is available.
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
- Phase 2.8 — Analytics Dashboard UI

## Where to continue

- Detailed roadmap: [`FEATURES.md`](../FEATURES.md)
- Architecture reference: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)
- Next focus: Phase 3 — The Platform

## Status maintenance

Keep this file concise. Update the current phase, next task, and completed
phase list when work ships. Do not duplicate task-level implementation details
from `FEATURES.md` or individual plans here.
