# Project Status

This is the resume point for returning to Resonance after time away.

## Current phase

Phase 2.4 — Drafts & Publishing Workflow (in progress)

## Next focus

Phase 2.4 is in progress. The lifecycle schema, legacy backfill, published-only
reader boundary, draft-safe validation, and the `saveDraft` -> `publishPost`
transition are implemented. Draft listing/resume/delete UI and production
rollout gates remain outstanding.

## Phase 2.3 verification

- `pnpm lint` — passed.
- `pnpm test:ci` — passed: 14 files, 144 tests.
- `pnpm test:component` — passed: 30 files, 190 tests.
- `pnpm build` — passed, including TypeScript validation.
- Contract audit confirmed `lib/post-content.ts` as the single canonical
  contract; targeted fixes: new post writes now reject legacy bodies for new
  posts, and link nodes carrying a stray `text` key are rejected.
- Known limitation: authenticated owner-scoped post mutation tests
  remain limited by the Better Auth component fixture in `convex-test`.
  Verbatim body persistence is pinned by a `getPostById` round-trip test plus
  code inspection of the untransformed `ctx.db.insert("posts", ...)` call.
- The Convex test harness prints a scheduled-cleanup transaction warning in one
  passing test; it is a fixture limitation, not a failing assertion.
- Task 3 follow-up verification: 55 focused Convex/schema tests, 9 create-page
  component tests, and `pnpm exec tsc --noEmit` passed.

## Completed phases

- Phase 0 — Foundation Fix
- Phase 1.0 — Backward-compat cleanup
- Phase 1A — Identity & Engagement
- Phase 1B — Curation & Connection, including 1.7 Reader Feed
- Phase 1C — Discovery & Polish, including 1.8 Post Tags
- Phase 2.1 — Rich Text Editor Foundation
- Phase 2.2 — Inline Image Support
- Phase 2.3 — Structured Content Publishing

## Where to continue

- Detailed roadmap: [`FEATURES.md`](../FEATURES.md)
- Architecture reference: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)
- Current task plan: [`docs/superpowers/plans/`](superpowers/plans/)

## Status maintenance

Keep this file concise. Update the current phase, next task, and completed
phase list when work ships. Do not duplicate task-level implementation details
from `FEATURES.md` or individual plans here.
