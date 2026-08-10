# Handoff Prompt: Post Tags Implementation

You are continuing work on Resonance in the `feat/post-tags` branch.

Read these files before changing code:

- `AGENTS.md`
- `docs/status.md`
- `FEATURES.md`
- `docs/superpowers/specs/2026-08-09-post-tags-design.md`
- `docs/superpowers/plans/2026-08-09-post-tags.md`
- `convex/_generated/ai/guidelines.md`

Implement the approved post-tags design by following:

`docs/superpowers/plans/2026-08-09-post-tags.md`

The implementation must use this finalized canonical tag list everywhere:

`Technology`, `Design`, `Culture`, `Science`, `Business`, `Music`, `Tutorial`,
`Theory`, `Architectural`, `Landscape`, `Photography`, `Software`, `Hardware`,
`Camera`, and `Nature`.

Enforce a maximum of five tags on every create path, including Convex-side
validation. Preserve backward compatibility for posts created before tags
existed by normalizing missing tags to `[]` on reads.

The implementation plan is authoritative and already includes the required:

- shared canonical tag list and validation;
- `posts.tags`, `createPost`, and normalized post readers;
- optional `getPosts` tag filtering with source-cursor pagination semantics;
- create-form checkbox UX and client/server validation;
- reusable tag pills and links across all post-card consumers and post detail;
- blog `searchParams.tag`, active-filter UI, and empty-state behavior;
- compatibility for legacy posts and tags removed from the canonical list;
- Convex, component, and route-level tests;
- updates to `FEATURES.md`, `README.md`, and `docs/ARCHITECTURE.md`; and
- verification in repository CI order.

Do not replace the plan's Convex pagination correction with a database filter:
fetch the ordered source page with `.paginate(args.paginationOpts)`, filter the
page in memory, preserve the source cursor metadata, and hydrate only matching
posts. Unknown tag filters must return an empty completed page.

Run the focused tests while implementing, then run the full CI sequence:

`pnpm lint` → `pnpm test:ci` → `pnpm test:component` → `pnpm build`

Keep documentation in sync, update the relevant roadmap/status checkboxes only
when the implementation is genuinely complete, and record any limitations.
Do not push, create a PR, or merge; this session is limited to local
implementation and verification unless separately requested.
