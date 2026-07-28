# Agent rules — Resonance

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

## Setup

- `pnpm install` (locked to pnpm 10 via `packageManager`).
- Copy `.env.local.example` → `.env.local`. Set `NEXT_PUBLIC_CONVEX_URL`,
  `NEXT_PUBLIC_CONVEX_SITE_URL`, `BETTER_AUTH_SECRET` (32+ chars).
- `SITE_URL` lives in the **Convex dashboard** env vars, not `.env.local`.
- `opencode.json` sets `permission.edit: "ask"` — expect approval prompts.

## Commands

| Intent       | Command                             |
| ------------ | ----------------------------------- |
| Dev          | `pnpm dev`                          |
| Lint         | `pnpm lint`                         |
| Format       | `pnpm format` / `pnpm format:check` |
| Typecheck    | `pnpm build` (Next.js does TS)      |
| Test (edge)  | `pnpm test:ci`                      |
| Test (UI)    | `pnpm test:component`               |
| Single test  | `pnpm test -- <path>`               |

CI order before PR: `lint → test:ci → test:component → build`.

## Conventions

- `app/(app)/` has the Navbar; parens = not part of URL.
- `app/auth/` has no Navbar, full-screen forms.
- Server Components for read-only pages (`fetchQuery`).
- Client Components for interactivity, mutations, auth state.
- `ConvexClientProvider` sets `expectAuth: true` — queries/mutations don't
  fire until authenticated. Don't "fix" missing data by removing this.
- `lib/auth-server.ts` exports `fetchAuthQuery` / `fetchAuthMutation` but
  **no page uses them** — every server `fetchQuery` is unauthenticated.
  See `docs/ARCHITECTURE.md` decision #14 for the impact on bookmark state.
- `components/ui/` is shadcn-managed. Re-generate via `pnpm shadcn add`.
  Don't edit by hand.
- Tailwind v4 with `@tailwindcss/postcss`. CSS vars in `globals.css`.

## Docs

Keep docs in sync as part of every change.

- `FEATURES.md` — living roadmap. Update Status Board / backlog when
  shipping or rescoping.
- `docs/ARCHITECTURE.md` — single deep reference. Update when directory
  structure, schema, or auth wiring changes.
- `docs/superpowers/specs|plans/` — local, gitignored. **Active** specs
  (Follows, Roadmap) hold forward pointers for the next phase — read
  them before starting 1.6 / 1.7. **Older specs/plans for completed
  phases are archival; don't re-read them.**

## Commits

Conventional Commits. Imperative, active voice. Subject ≤72 chars, no
trailing period. Body explains _why_ (not _what_). Ref issues in body.
No WIP or vague subjects.

## Git workflow

**ALWAYS use Pull Requests. NEVER merge directly to main.**

When a branch is complete and the user says "finish it" / "merge it" /
"ship it", present exactly:

> Ready to create a PR for this branch?

- YES → push, open PR, stop. Do not merge.
- NO → ask what to change before PRing.

Never run `git merge` or push to `main` without explicit user instruction
to bypass PR workflow.
