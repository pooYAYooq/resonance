<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Setup

- `pnpm install` (locked to pnpm 10 via `packageManager`) in the repo root.
- Copy `.env.local.example` → `.env.local`. Set `NEXT_PUBLIC_CONVEX_URL`,
  `NEXT_PUBLIC_CONVEX_SITE_URL`, and `BETTER_AUTH_SECRET` (32+ chars, match
  production entropy). Also set `SITE_URL` in the **Convex dashboard** env vars
  (not `.env.local`) — `convex/auth.ts` and Better Auth read it from there.
- `opencode.json` sets `permission.edit: "ask"` and `permission.bash.*: "ask"` —
  expect approval prompts for write/file-system commands.

## Commands

| Intent               | Command                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| Dev server           | `pnpm dev`                                                                                            |
| Lint                 | `pnpm lint` (ESLint via `eslint.config.mjs`)                                                          |
| Format               | `pnpm format` (Prettier), `pnpm format:check`                                                         |
| Typecheck            | `pnpm build` runs `next build` (includes TS type-checking via Next plugin)                            |
| Tests (edge-runtime) | `pnpm test:ci` — vitest, edge-runtime, `app/**/*.test.ts`, `lib/**/*.test.ts`, `convex/**/*.test.ts`  |
| Component tests      | `pnpm test:component` — vitest with jsdom, `app/**/*.test.tsx`, auto-cleanup via `vitest.ui.setup.ts` |
| Single test file     | `pnpm test -- <path>` (vitest in watch mode)                                                          |
| Build                | `pnpm build`                                                                                          |

## Routing

- `app/(app)/` — logged-in experience (has Navbar). Parens = not part of URL,
  so `/blog` maps to `app/(app)/blog/page.tsx`.
- `app/auth/` — isolated layout, no Navbar, full-screen centered forms.
- Server Components for read-only pages (`fetchQuery`). Client Components
  (`"use client"`) for hooks, mutations, providers, interactivity.

## Convex + Better Auth

- Better Auth runs **inside Convex**. User/session records live in the same
  Convex DB as app data. Auth flows: browser → Next.js route handler
  (`app/api/auth/[...all]/route.ts`) → Convex HTTP (`convex/http.ts`).
- `ConvexClientProvider` allows public queries without authentication. Client
  components must locally skip viewer-aware public queries while auth is
  resolving and run private queries only after authentication has resolved and
  `isAuthenticated` is true.
- Keep `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` in sync with
  the Convex dashboard deployment. `SITE_URL` goes in Convex dashboard env
  vars only.

## UI

- `components/ui/` are shadcn primitives — re-generate via `pnpm shadcn add`
  instead of editing manually. `components.json` has the config.
- Tailwind CSS v4 with `@tailwindcss/postcss`. CSS vars in `globals.css`.

## CI order

Before PR: `pnpm lint` → `pnpm test:ci` → `pnpm test:component` → `pnpm build`.

## Documentation

Keep the docs in sync as part of every change — stale docs cost more than
no docs.

- `FEATURES.md` — living roadmap. Shipping a feature → update its status in
  the Status Board / backlog.
- `docs/ARCHITECTURE.md` + README's Project Structure — changing directory
  structure, schema, or auth → update both.
- Active designs and implementation plans → `docs/superpowers/specs|plans/`
  (local, untracked, and intentionally not gitignored). The mandatory human
  staging gate prevents these development artifacts from being committed.

## Status and PR workflow

- Use `docs/status.md` as the first place to resume work after an absence.
- When a task or plan step is genuinely complete, update its checkbox in the relevant plan and update `docs/status.md` in the same change when the resume point changes.
- When a tracked delivery item ships, update `FEATURES.md` and `docs/status.md`, then mark exactly one next delivery focus as `🔵 up next`.
- Do not assume implementation must follow roadmap phase numbering. Use the currently approved product/system slice or task as the delivery unit.
- Never mark work complete without fresh verification evidence. Record known limitations rather than marking incomplete work as complete.
- Before preparing a PR, follow the local procedure in `docs/PR_CHECKLIST.md`. This is an agent workflow document, not a GitHub PR template.
- PR titles must describe the actual product, system, documentation, or engineering outcome.
- Do not include roadmap or planning identifiers such as phase, step, task, or slice numbers in PR titles.
- Completion of the PR checklist does not authorize staging, committing, pushing, or opening a PR. Follow the repository's human approval gates for each Git action.

## Commits

Use Conventional Commits with a valid prefix type and optional scope.

Write commit subjects in imperative, active voice. Keep the subject at 72 characters or fewer, with no trailing period. After a blank line, include a meaningful body wrapped at 72 characters that explains **why** the change was made, not merely what changed.

Every commit must have:

- a proper Conventional Commit prefix/type;
- a clear, specific title;
- a meaningful body explaining the rationale.

For breaking changes, use `!` in the prefix or a `BREAKING CHANGE:` footer. Reference issues in the body when applicable, for example `Closes #123`.

Do not use WIP or vague subjects.

Do not include roadmap or planning identifiers such as phase, step, task, or slice numbers in commit subjects or bodies. Describe the actual product, system, documentation, or engineering outcome instead.

## Git Workflow

**ALWAYS use Pull Requests. NEVER push directly to `main`. NEVER merge directly to `main`.**

Branch names must describe the actual product, system, documentation, or engineering outcome. Do not include roadmap or planning identifiers such as phase, step, task, or slice numbers in branch names.

All remote pushes must originate from a non-`main` working branch, such as a feature, fix, docs, refactor, or other task branch. This applies whether the branch is used in the primary working tree or in a Git worktree.

Before any push:

- verify the current branch is not `main`;
- verify the intended commits belong to the current task;
- push only that non-`main` branch.

Staging, committing, pushing, and opening or updating a PR each require explicit human approval. Approval for one Git action does not authorize the next.

Do not run `git push origin main`, `git push <remote> main`, or any equivalent command that updates the remote `main` branch.

When a branch is complete and the user says "finish it," "merge it," "ship it," or similar, present exactly this choice:

> Ready to create a PR for this branch?

- If YES → push the non-`main` branch, create the PR, then STOP. Do not merge.
- If NO → ask what they'd like to change before PRing.

Never run `git merge` into `main`, push `main`, or otherwise update remote `main` unless the user explicitly instructs you to bypass the PR workflow for that specific action.
