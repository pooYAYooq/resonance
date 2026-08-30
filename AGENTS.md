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
  resolving and skip private queries unless authentication is resolved.
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
- Designs and implementation plans → `docs/superpowers/specs|plans/`
  (local, gitignored).

### Status and PR workflow

- Use `docs/status.md` as the first place to resume work after an absence.
- When a task or plan step is genuinely complete, update its checkbox in the
  relevant plan and update `docs/status.md` in the same change.
- When a phase is complete, mark it complete in `FEATURES.md` and
  `docs/status.md`, then mark exactly one next phase or task as `🔵 up next`.
- Never mark work complete without fresh verification evidence. Record known
  limitations rather than checking an incomplete step.
- Before opening a PR, follow the local procedure in `docs/PR_CHECKLIST.md`.
  This is an agent workflow document, not a GitHub PR template.

## Commits

Conventional Commits (type + optional scope). Imperative, active voice.
Subject ≤72 chars, no trailing period. Blank line, then body at 72 chars
explaining _why_ (not _what_). Breaking changes: `!` or `BREAKING CHANGE:`
footer. Ref issues in body (`Closes #123`). No WIP or vague subjects.

## Git Workflow

**ALWAYS use Pull Requests. NEVER merge directly to main.**

When a branch is complete and the user says "finish it," "merge it,"
"ship it," or similar, present exactly this choice:

> Ready to create a PR for this branch?

- If YES → push branch, create PR, STOP. Do not merge.
- If NO → ask what they'd like to change before PRing.

Never run `git merge` or push to main without explicit user instruction
to bypass PR workflow.
