# Project Status

This is the resume point for returning to Resonance after time away.

## Current phase

Phase 3A.3 — Writing & Management — current

## Next focus

Phase 3A.0 — UX Correctness, Phase 3A.1 — Product Structure, and Phase 3A.2 —
Discover Foundations are shipped. Phase 3A.3 — Writing & Management is the sole
next focus. The Phase 3A target direction and delivery map are canonicalized.
Track 3 Tasks 1 and 2 are reviewed and committed as `72f382b`; Task 3 Atomic
Lifecycle Wiring is committed as `a169b2e`; Task 4 capacity and native Search
evidence is committed as `60cf933` and reviewed with zero CodeRabbit findings.
The approved slim Search projection removes the duplicate complete-body field,
and the 150,000-code-point Japanese fixture fits within the measured Search
budget. Track 3 is shipped. Slice 1 Task 1, the private
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
- Discover Foundations Task 1 — `pnpm test:ci -- convex/discover.test.ts`
  passed: 18 files, 208 tests; `npx tsc --noEmit`, targeted ESLint, Prettier,
  and `git diff --check` passed. Specification and Convex quality reviews
  approved the projection schema and helper implementation. Committed as
  `714dd8d`.
- Discover Foundations Task 2 — `pnpm test:ci -- convex/discover.test.ts
convex/posts.test.ts convex/users.test.ts` passed: 18 files, 227 tests;
  `npx tsc --noEmit`, `pnpm lint`, targeted Prettier, and `git diff --check`
  passed. Specification and Convex quality reviews approved transactional
  lifecycle synchronization, bounded idempotent maintenance, and author rename
  repair. Committed as `7910ad3`. Task 3, public Discover queries, is complete.
  Task 4 URL-state normalization is committed as `219be85`.
- Discover Foundations Task 4 — `pnpm test:ci -- lib/discover.test.ts` passed:
  19 files, 241 tests; focused component tests passed: 61 files, 307 tests;
  `pnpm lint`, `npx tsc --noEmit`, `pnpm build`, targeted Prettier, and
  `git diff --check` passed. Specification and code-quality reviews approved
  the implementation, and CodeRabbit reported zero findings. No Discover UI or
  Convex query behavior was added. Committed as `219be85`.
- Discover Foundations Task 5 — focused component tests passed: 65 files, 320
  tests; route tests passed: 19 files, 241 tests; full `pnpm test:ci` passed:
  19 files, 241 tests; `pnpm lint`, `npx tsc --noEmit`, targeted Prettier,
  `git diff --check`, and `pnpm build` passed. Specification and code-quality
  reviews approved the UI; CodeRabbit reported zero findings. Committed as
  `9479de9`. Legacy development content was intentionally not backfilled.
- Discover Foundations Task 6 — focused `pnpm test:component --
"app/(site)/feed/_components/FeedContent.test.tsx"` passed: 65 files, 320
  tests; targeted ESLint, Prettier, and `git diff --check` passed. Specification
  and code-quality reviews approved the Feed recovery link. Committed as
  `1c67c4c`.
- Discover Foundations Task 7 verification is complete. Documentation now
  describes the shipped Discover projections, public queries, URL-state route
  composition, editorial summaries, Feed recovery, and the bounded
  published-deletion lifecycle, including upload reclamation, analytics
  reconciliation, strict topic-stat validation, draft cleanup jobs, and stale
  job recovery. Hot remains deferred because its ranking formula and time window
  are not defined.
- Development-only corrections — profile published-post counts are required
  from user creation onward with no backfill state, and rejected inline image
  finalization reclaims its session and unclaimed storage object. Existing
  deletion analytics and public return-validator corrections remain intact.
- Track 2 final verification — `pnpm lint` passed; focused `pnpm test:ci --
convex/writeAttempts.test.ts convex/posts.test.ts
convex/sessionMediaClaims.test.ts convex/pendingUploads.test.ts
lib/write-contract.test.ts lib/post-content.test.ts` passed: 24 files, 371
  tests; `pnpm build` and `git diff --check` passed. The passing test run still
  emits the known Convex-test scheduled-function rollback warning.
- Track 3 Tasks 1–2 — focused capacity/Discover tests passed: 82 tests; full
  local Vitest passed: 25 files, 391 tests; component suite passed: 65 files,
  321 tests; typecheck, lint, targeted formatting, build, and diff checks passed.
  Capacity and projection changes were reviewed and committed as `72f382b`.
- Track 3 Task 3 is committed. Post-commit review exposed a rename-reserve
  boundary defect; its test-first correction passed human and CodeRabbit review
  and was amended into the lifecycle commit. The lifecycle test command passes:
  25 files, 397 tests; `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build`,
  targeted formatting, and diff checks pass.
- Track 3 Task 4 local baseline passed: 25 files and 397 unit tests, plus 65
  files and 321 component tests. The representative fixture runner passed 2
  tests. Its initial 900,238-byte Japanese Search record exposed duplicated
  body storage; the approved slim projection measures 450,224 bytes and keeps
  the full body in `searchableText`. Focused slim-projection tests pass 171/171.
  The current local gate passes 25 files and 400 unit tests, 65 files and 321
  component tests, lint, TypeScript, production build, formatting, and diff
  checks.
  Native Search verification passed on the explicitly authorized
  `dev:woozy-spaniel-283` deployment: the 150,000-code-point Japanese row,
  author repair, tail search, near-capacity record, pagination, reactivity, and
  resource checks all passed. The temporary internal-only harness cleaned its
  confined rows and was removed.

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
- Phase 3A.2 — Discover Foundations

## Where to continue

- Detailed roadmap: [`FEATURES.md`](../FEATURES.md)
- Architecture reference: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)
- Phase 3A target direction and delivery map:
  [`docs/PHASE_3A.md`](PHASE_3A.md)
- Phase 3A cross-cutting decisions:
  [`docs/PHASE_3A_DECISIONS.md`](PHASE_3A_DECISIONS.md)
- Track 2 final verification and Track 3 are complete. Track 3 Task 4 passed
  local and explicitly authorized native development Search verification and is
  committed as `60cf933`. Continue with Track 1, then Track 4, in the approved
  order.
- Design-only specification:
  Local-only design specification (`docs/superpowers/specs/2026-09-07-writing-management-design.md`,
  intentionally git-ignored).
  Sections 1-7 and final Q64-Q65 clarifications are approved. Section 7 includes
  the minimal BlockNote interaction contract. The implementation roadmap and
  four focused plans are now written under `superpowers/plans/`. Track 2 is the
  required foundation, followed by Track 3, Track 1, and Track 4. Current
  database content is disposable test data: implementation must not add
  migrations, backfills, dual reads/writes, or compatibility fields. Runtime
  capacity/Search/browser evidence remains explicitly gated. Track 2 Tasks 1
  through 4 are implemented, reviewed, committed, and finally verified.
  Expired attempts now
  reconcile to an explicit indeterminate outcome when evidence is insufficient,
  and reservation, execution, media, and target ownership are isolated by
  account. No migration, backfill, dual read/write, or compatibility field was
  added. Track 1 remains explicitly out of scope for this correction: it owns
  unresolved attempt identity, same-attempt reconciliation after uncertain
  results, blocking a new attempt until the prior result is authoritative or
  acknowledged, and production claim/renew/release wiring. It does not promise
  hard-reload recovery without a separately approved architecture. Task
  boundaries also require human review/commit gates and an explicit
  compaction/handoff resume record before work continues. The development-only
  plans, spec, and visual helpers are ignored by Git and must not be staged or
  tracked.

## Status maintenance

Keep this file concise. Update the current phase, next task, and completed
phase list when work ships. Do not duplicate task-level implementation details
from `FEATURES.md` or individual plans here. Before staging, committing, or
opening a PR, follow the mandatory human review gates in `docs/PHASE_3A.md`.
