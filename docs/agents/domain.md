# Domain Docs

Before exploring, read the root `CONTEXT.md` if present and relevant ADRs in
`docs/adr/`. If those files do not exist, proceed without flagging their absence.

This repository has no `CONTEXT.md` or `docs/adr/` today. Durable decisions and
the product model live in the Phase 3A docs. Follow the progressive-loading rule
in `AGENTS.md` and open only the document or section relevant to the current
domain question:

- `docs/PHASE_3A_DECISIONS.md` — dated cross-cutting decisions and rationale.
- `docs/PHASE_3A.md` — product model, terminology, scope, and deferrals.
- `FEATURES.md` — shipped features and capability terms.
- `ROADMAP.md` — scope, remaining work, and delivery status.

Use the established terms consistently in plans, tests, and refactor proposals:
Saved, Liked, Profile, Settings, Draft, Publish, and Review. Surface conflicts
with existing decisions instead of silently overriding them.
