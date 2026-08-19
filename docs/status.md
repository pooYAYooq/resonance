# Project Status

This is the resume point for returning to Resonance after time away.

## Current phase

Phase 2.4 — Drafts & Publishing Workflow (complete)

## Next focus

The canonical development model is active: structured BlockNote bodies,
required lifecycle status, published-only public readers, owner-scoped drafts,
and the `saveDraft` -> `publishPost` transition are implemented. No deployment
migration has been run or is required for this disposable development database.

## Phase 2.3 verification

- `pnpm lint` — passed.
- `pnpm test:ci` — passed: 14 files, 144 tests.
- `pnpm test:component` — passed: 31 files, 197 tests.
- `pnpm build` — passed, including TypeScript validation.
- Contract audit confirmed `lib/post-content.ts` as the single canonical
  content contract; link nodes carrying a stray `text` key are rejected.
- Known limitation: authenticated owner-scoped post mutation tests
  remain limited by the Better Auth component fixture in `convex-test`.
  Verbatim body persistence is pinned by a `getPostById` round-trip test plus
  code inspection of the untransformed `ctx.db.insert("posts", ...)` call.
- The Convex test harness prints a scheduled-cleanup transaction warning in one
  passing test; it is a fixture limitation, not a failing assertion.
- Task 3 follow-up verification: 55 focused Convex/schema tests, 9 create-page
  component tests, and `pnpm exec tsc --noEmit` passed.
- Draft-read follow-up: `pnpm test -- convex/posts.test.ts --run` passed with
  14 files and 141 tests; the anonymous draft read/delete boundary is covered.
- Draft-read type/lint verification: `pnpm exec tsc --noEmit` and `pnpm lint`
  passed. `getDrafts` uses the owner-scoped draft lifecycle index.
- Commits `bb0c323` and `2f8c013` were reconciled against the current plan.
- Resume/drafts verification: the full backend suite passed with 14 files and
  141 tests; the full component suite passed with 31 files and 198 tests.
- Final verification: `pnpm lint`, `pnpm test:ci`, `pnpm test:component`, and
  `pnpm build` all passed. The build includes static `/create` and `/drafts`
  routes.
- Cleanup verification: `pnpm lint`, `pnpm test:ci`, `pnpm test:component`,
  `pnpm build`, and `git diff --check` passed. The backend suite passed with
  14 files and 137 tests. The component suite passed with 31 files and 197
  tests.

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

## Where to continue

- Detailed roadmap: [`FEATURES.md`](../FEATURES.md)
- Architecture reference: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)
- Next focus: Phase 2.5 — Author Dashboard

## Status maintenance

Keep this file concise. Update the current phase, next task, and completed
phase list when work ships. Do not duplicate task-level implementation details
from `FEATURES.md` or individual plans here.
