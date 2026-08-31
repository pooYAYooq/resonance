# Project Status

This is the resume point for returning to Resonance after time away.

## Current phase

Phase 3A.1 — Product Structure (up next)

## Next focus

Phase 3A.0 — UX Correctness is shipped. Phase 3A.1 is the sole next focus.
The Phase 3A target direction and delivery map are canonicalized; Slice 1 has
an approved boundary and local implementation plan, but no Slice 1 application
code has started.

## Current verification

- Phase 3A.0 — `pnpm lint` passed; `pnpm test:ci` passed: 17 files, 179 tests;
  `pnpm test:component` passed: 53 files, 284 tests; `pnpm build` passed; and
  `git diff --check` passed.
- Phase 3A.0 formatting passed for every stageable file changed by this slice.
  The local `docs/superpowers/**` planning artifacts remain intentionally
  unstaged and excluded from the staging slice.
- Repository-wide `pnpm format:check` remains blocked by 46 pre-existing or
  unrelated files outside the Phase 3A.0 diff, including 28 tracked skill
  assets and 18 application/configuration files. No formatter exclusions or
  unrelated formatting changes were added.
- Better Auth 1.5.3 defaults are intentionally used: finite seven-day sessions
  with one-day sliding refresh; no custom session configuration or client
  inactivity logout timer exists.
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
- Phase 3A.0 — UX Correctness

## Where to continue

- Detailed roadmap: [`FEATURES.md`](../FEATURES.md)
- Architecture reference: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)
- Phase 3A target direction and delivery map:
  [`docs/PHASE_3A.md`](PHASE_3A.md)
- Phase 3A cross-cutting decisions:
  [`docs/PHASE_3A_DECISIONS.md`](PHASE_3A_DECISIONS.md)
- Active local Slice 1 plan:
  `docs/superpowers/plans/2026-08-31-slice-1-product-structure.md` (untracked
  and intentionally not gitignored)
- Next focus: Phase 3A.1 — Product Structure

## Status maintenance

Keep this file concise. Update the current phase, next task, and completed
phase list when work ships. Do not duplicate task-level implementation details
from `FEATURES.md` or individual plans here. Before staging, committing, or
opening a PR, follow the mandatory human review gates in `docs/PHASE_3A.md`.
