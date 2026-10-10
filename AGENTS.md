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
- Copy `.env.local.example` → `.env.local`. Set `NEXT_PUBLIC_CONVEX_URL` and
  `NEXT_PUBLIC_CONVEX_SITE_URL`. Set `SITE_URL` and `BETTER_AUTH_SECRET` (32+
  chars, match production entropy) in the **Convex dashboard** env vars (not
  `.env.local`) — `convex/auth.ts` and Better Auth read them there.
- `opencode.json` sets `permission.edit: "ask"` and `permission.bash.*: "ask"` —
  expect approval prompts for write/file-system commands.

## Commands

| Intent               | Command                                                                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dev server           | `pnpm dev`                                                                                                                                                 |
| Lint                 | `pnpm lint` (ESLint via `eslint.config.mjs`)                                                                                                               |
| Format               | `pnpm format` (Prettier), `pnpm format:check`                                                                                                              |
| Typecheck            | `pnpm build` runs `next build` (includes TS type-checking via Next plugin)                                                                                 |
| Tests (edge-runtime) | `pnpm test:ci` — vitest, edge-runtime, `app/**/*.test.ts`, `lib/**/*.test.ts`, `convex/**/*.test.ts`                                                       |
| Component tests      | `pnpm test:component` — vitest with jsdom, `app/**/*.test.tsx`, `components/**/*.test.tsx`, and `lib/**/*.test.tsx`; auto-cleanup via `vitest.ui.setup.ts` |
| Single test file     | `pnpm test -- <path>` (vitest in watch mode)                                                                                                               |
| Build                | `pnpm build`                                                                                                                                               |

## Routing

- `app/(marketing)/` owns Home, `app/(site)/` owns public and authenticated
  reader routes including `/blog`, `/profile/edit`, and `/settings`, and
  `app/(workspace)/` owns authenticated author routes for `/create` and
  `/dashboard` (with workspace-only navigation). Parens are not part of the
  URL.
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

Code and its documentation ship in the same PR. Documents describe the
checked-out revision: proposed behavior on a working branch, integrated
behavior on `main`. GitHub owns PR review, approval, and merge state; deployment
and release are separate events. No routine follow-up PR is needed just to
record a merge.

**Progressive loading:** start with `docs/status.md` to identify the current
focus and resume point. Read only the relevant group or row in `ROADMAP.md` when
choosing, scoping, or updating delivery work; an already-scoped implementation
task does not need a full roadmap read. Open `docs/PHASE_3A.md` only for product
direction relevant to the task, `docs/PHASE_3A_DECISIONS.md` only for a linked
decision or a cross-cutting product choice, `FEATURES.md` when shipped
capability changes, and `docs/ARCHITECTURE.md` plus the README project tree when
the change affects architecture, directories, schema, or auth. Read only the
active local spec or plan for the current implementation unit.

- `ROADMAP.md`: scope, remaining work, estimates, dependencies, and completion.
  Done means the agreed scope is implemented and verified in this revision,
  with accepted limitations recorded. It does not assert merge or deployment.
  Keep scope notes short and link to evidence rather than copying it.
- `FEATURES.md`: capabilities of this revision, updated when behavior changes.
- `docs/status.md`: current focus, next substantive action, and blockers.
  Replace superseded information; do not append a task diary, authorization
  history, test-count history, or duplicate roadmap table.
- `docs/KNOWN_LIMITATIONS.md`: current constraints and verification gaps. Add
  evidence or an owning roadmap item where known; remove entries when resolved.
- `docs/ARCHITECTURE.md` and README's Project Structure: update affected
  descriptions when structure, schema, or auth changes.
- Evidence documents retain actual tested revisions, outcomes, and retest
  triggers. Historical failures must be clearly distinguished from current
  results. Link to PRs for review history; merge SHAs are not required for
  documentation completion. Existing evidence hashes remain valid references.
- `CHANGELOG.md`: notable release-facing changes under Unreleased until a
  release, not a log of every commit or merge.

Give each fact one authoritative home and link to it elsewhere. When shortening
docs, preserve unique requirements, decisions, limitations, and evidence in an
appropriate tracked document or an explicit historical Git/PR reference.

### Local artifacts

`docs/superpowers/` specs/plans, scratch notes, execution ledgers, browser dumps,
screenshots, logs, and draft commit/PR messages are local task artifacts. Never
stage, commit, or include them in a PR. Use an external temporary directory for
raw output; active specs/plans may live under `docs/superpowers/` when allowed
by the harness. Tracked evidence is curated Markdown, not raw output.

Inspect explicit paths before staging and inspect the staged diff afterward;
run `pnpm check:artifacts` before committing. Known local-only paths are ignored
and checked against the full Git index locally and in CI. This is not an
installed Git hook, and arbitrary artifact names still require manual review.
Once durable docs record completion, archive local task artifacts under
`/home/studio/projects/resonance-docs-archive/` on the maintainer's workstation
and remove them from the worktree. A clone must remain understandable without
that local archive.

## Status and PR workflow

- Update completed local plan steps and reconcile the affected permanent docs
  before the final commit for the task.
- Do not assume implementation must follow roadmap phase numbering. Use the currently approved product/system slice or task as the delivery unit.
- Never mark work complete without fresh verification evidence. Record known limitations rather than marking incomplete work as complete.
- Follow `docs/PR_CHECKLIST.md` when preparing a new PR, updating an existing
  PR after review, and handing it back for merge. Finalize docs inside that PR
  after the last relevant fix. If review changes scope or behavior again,
  reopen the affected verification and documentation steps.
- Keep incomplete acceptance visible. A deferral requires the maintainer's
  decision and a durable scope/limitation record; it is not a passing check.
- Write clear, human-sounding commit and PR messages. PR descriptions include
  what changed, why, verification with actual results, relevant links, and any
  limitations or approved deferrals. Omit empty boilerplate sections.
- PR titles must describe the actual product, system, documentation, or engineering outcome.
- Do not include roadmap or planning identifiers such as phase, step, task, or slice numbers in PR titles.
- Completion of the PR checklist does not authorize staging, committing, pushing, or opening a PR. Follow the repository's human approval gates for each Git action.

## Commits

Use Conventional Commits with a valid prefix type and optional scope.

Write commit subjects in imperative, active voice. Keep the subject at 72 characters or fewer, with no trailing period. After a blank line, include a meaningful body wrapped at 72 characters that explains **why** the change was made, not merely what changed.

Format: `<type>[optional scope]: <description>`, a blank line, a meaningful
what/why body, and optional reference or breaking-change footers. Use neither
en dashes nor em dashes anywhere in commit or PR messages.

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

Staging, committing, pushing, and creating or editing PR metadata each require
explicit human approval. Approval for one action does not authorize the next;
an explicit request naming multiple actions can authorize those named actions.
Pushing an approved branch updates the existing PR's commits automatically.
Replies, review requests, thread resolution, and merge require their own
explicit authorization. Recognize a clear request such as "push these changes"
as approval; do not require ritual wording or ask for the same permission again.

Do not run `git push origin main`, `git push <remote> main`, or any equivalent command that updates the remote `main` branch.

Before PR creation or a completion handoff, check whether the branch already
has an open PR. Update an existing PR; never offer to create its duplicate.
For a new PR, ask only for missing push/creation approvals. If "finish it" is
ambiguous, state the next concrete action and ask once. The maintainer normally
resolves threads and merges on GitHub; completion alone does not authorize either.

After a confirmed merge, approved cleanup consists of fetching, fast-forwarding
local `main`, checking that the work is integrated, and deleting only approved
merged branches. For squash/rebase merges, verify the PR result and content;
do not force-delete because `git branch -d` rejects ancestry. Never overwrite
local work. Cleanup requires no tracked-doc edit or merge-record PR.

Never merge a working branch directly into local `main`, push `main`, or update
remote `main` unless the user explicitly authorizes bypassing the PR workflow
for that specific action. Fast-forwarding local `main` to the verified remote
merge during approved cleanup is permitted.
