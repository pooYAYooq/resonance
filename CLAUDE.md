# Claude Code — Resonance

The canonical project rules live in `AGENTS.md`. Read it first.

**Next.js docs:** search `.next-docs/01-app/<topic>/` on demand. Do not
ask me to dump the whole docs index — it changes per Next.js version and
wastes tokens.

**Convex:** `convex/_generated/ai/guidelines.md` is authoritative; it
overrides what you remember from training. Read it before any Convex
edit.

**Known Claude Code traps in this repo:**

- `ConvexClientProvider` sets `expectAuth: true` — Convex queries look
  empty in unauth contexts. Don't "fix" by removing it.
- Server `fetchQuery` is always unauthenticated here; that hydrates
  `isLiked: false` on first paint for signed-in users. This is a
  pre-existing quirk, not a bug to chase in unrelated work.
