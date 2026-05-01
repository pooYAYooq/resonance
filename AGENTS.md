<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.

<!-- convex-ai-end -->

## Setup

- `pnpm install` (locked to pnpm 10 via `packageManager`) and please run it in
  the repo root.
- Copy `.env.local.example` → `.env.local` before running anything. Set
  `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, and
  `BETTER_AUTH_SECRET` (32+ chars, match production entropy) there for the
  browser and server layers. Also configure `SITE_URL` in the Convex dashboard's
  environment variables because `convex/auth.ts` and Better Auth use it.

## Dev / Verification

- Start the Next.js App Router app with `pnpm dev`; it wires `app/layout.tsx`
  (Theme + Convex + Toaster providers), `components/web/ConvexClientProvider`,
  and the `(app)` route group that renders the authenticated shell.
- `pnpm build` runs `next build` and `pnpm lint` runs ESLint (`eslint.config.mjs`).
  Run them before releasing, especially when touching routing, components, or
  layout files.
- App routes are under `app/(app)` for the logged-in experience and under
  `app/auth` for login/sign-up; the parentheses mean the folder is not part of
  the URL (e.g., `/blog` ↦ `app/(app)/blog/page.tsx`). Use server components for
  read-only screens (`fetchQuery`) and client components only when you need
  hooks/mutations/providers (like `app/(app)/create`).

## Architecture Reminders

- Convex owns the database and Better Auth stack (`convex/schema.ts`,
  `convex/auth.ts`, `convex/http.ts`, `convex/posts.ts`). Next.js talks to it via
  `lib/auth-server.ts`, `lib/auth-client.ts`, and `components/web/ConvexClientProvider`.
  Trust the diagram in `docs/ARCHITECTURE.md` if you need to refresh how the
  browser ↔ Next ↔ Convex flow works.
- `components/ui` lives inside the shadcn ecosystem, so re-generate those
  primitives with the shadcn CLI (see `components.json`) instead of editing
  them manually.

## Convex / Better Auth Gotchas

- Better Auth runs _inside_ Convex. Endpoint handlers live at
  `app/api/auth/[...all]/route.ts` (Next.js) and Convex HTTP at
  `convex/http.ts`. Do not duplicate the auth logic in other layers; use
  `convexBetterAuthNextJs()` helpers from `lib/auth-server.ts` to keep sessions
  consistent.
- Keep `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` in sync with the
  Convex deployment you set in the dashboard, because the frontend talks to
  Convex over WebSocket at the former and posts auth requests to the latter.

## Commits

- Use Conventional Commits with a subject + body. Aim for active-voice, keep the
  subject under 72 characters, and explain _why_ you changed things in the body.
  Use bullets if the change spans multiple concerns.
