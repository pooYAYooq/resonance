# Project Status

This is the resume point for returning to Resonance after time away.

## Current phase

Phase 3A.2 — Discover Foundations (next)

## Next focus

Phase 3A.0 — UX Correctness and Phase 3A.1 — Product Structure are shipped.
Phase 3A.2 — Discover Foundations is the sole next focus. The Phase 3A target
direction and delivery map are canonicalized. Slice 1 Task 1, the private
liked-posts backend contract, is committed. Task 2, separate marketing and
authenticated site shells plus the dependency-required Saved/Liked reader
routes, is verified and committed as `784db9d`. Task 3, the workspace shell and
navigation boundary, is committed as `825ee20`. Task 4, the Profile/Settings
responsibility split and shared account menu, is committed as `744e90a`. Task 5,
the analytics relocation and dashboard cleanup, is committed as `36e32d6`.

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
- Slice 1 Task 1 — `pnpm test:ci -- convex/likes.test.ts
convex/bookmarks.test.ts convex/posts.test.ts` passed: 17 files, 184 tests;
  `npx tsc --noEmit` and `git diff --check` passed. The task's independent
  specification and quality reviews approved the result; committed as
  `80256d8`.
- Slice 1 Task 2 — `pnpm test:ci` passed: 17 files, 184 tests; `pnpm
test:component` passed: 55 files, 294 tests; `pnpm lint`, `pnpm build`, and
  `git diff --check` passed. Specification and quality reviews approved the
  site-shell split and dependency-required Saved/Liked route adjustment.
- Slice 1 Task 3 — `pnpm test:component` passed: 57 files, 293 tests;
  `pnpm lint`, `pnpm build`, and `git diff --check` passed. The workspace shell
  owns the `/dashboard/*` and `/create` auth boundary and navigation.
- Slice 1 Task 4 — `pnpm test:ci` passed: 17 files, 184 tests; `pnpm
test:component` passed: 60 files, 303 tests; `pnpm lint`, `pnpm build`, and
  `git diff --check` passed. `/profile/edit` owns identity editing,
  `/settings` owns Appearance and Account, and shared account actions serve the
  site and workspace shells. Committed as `744e90a`.
- Slice 1 Task 5 — `pnpm test:component` passed: 61 files, 304 tests;
  `pnpm lint`, `pnpm build`, and `git diff --check` passed. Analytics owns
  `/dashboard/analytics`, Saved is no longer a dashboard child route, and the
  workspace overview excludes Analytics and Saved previews. Committed as
  `36e32d6`.
- Slice 1 Task 6 — focused `pnpm test:ci -- convex/likes.test.ts
convex/bookmarks.test.ts` passed: 17 files, 184 tests; full `pnpm test:ci`
  passed: 17 files, 184 tests; and full `pnpm test:component` passed: 61 files,
  304 tests. `pnpm lint`, `pnpm build`, `git diff --check`, and the approved
  legacy-path check passed. `pnpm format:check` still reports the known
  repository-wide 46-file formatting baseline; no unrelated files were changed.

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
- Phase 3A.1 — Product Structure

## Where to continue

- Detailed roadmap: [`FEATURES.md`](../FEATURES.md)
- Architecture reference: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)
- Phase 3A target direction and delivery map:
  [`docs/PHASE_3A.md`](PHASE_3A.md)
- Phase 3A cross-cutting decisions:
  [`docs/PHASE_3A_DECISIONS.md`](PHASE_3A_DECISIONS.md)
- Next focus: Phase 3A.2 — Discover Foundations

## Status maintenance

Keep this file concise. Update the current phase, next task, and completed
phase list when work ships. Do not duplicate task-level implementation details
from `FEATURES.md` or individual plans here. Before staging, committing, or
opening a PR, follow the mandatory human review gates in `docs/PHASE_3A.md`.
