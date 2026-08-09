# Handoff Prompt: Post Tags Implementation Plan

You are continuing work on Resonance in the `feat/post-tags` branch.

Read these files first:

- `AGENTS.md`
- `docs/status.md`
- `FEATURES.md`
- `docs/superpowers/specs/2026-08-09-post-tags-design.md`
- `convex/_generated/ai/guidelines.md`

Your task in this session is **planning only**. Do not implement application
code. Based on the approved design, inspect the current code and write a
detailed implementation plan at:

`docs/superpowers/plans/2026-08-09-post-tags.md`

The plan must identify concrete files and symbols to change, in dependency
order, and include:

- The shared canonical tag-list and validation location.
- The `posts.tags` schema and `createPost` changes.
- The optional `getPosts` tag argument and exact Convex filtering behavior.
- Create-form checkbox UX and validation.
- Reusable tag-pill rendering and links in `PostCard` and post detail.
- Blog `searchParams.tag`, active-filter UI, and empty-state behavior.
- Backward compatibility for posts without tags and removed tags.
- Convex, component, and route-level test coverage.
- Required updates to `FEATURES.md`, `README.md`, and `docs/ARCHITECTURE.md`.
- Verification commands in the repository CI order.

Pay particular attention to whether the proposed Convex array-membership
filter is valid for the installed Convex version and whether filtering before
or during pagination has cursor implications. If the approved design contains
a technically invalid detail, call it out and propose the smallest correction
in the plan rather than silently implementing around it.

After writing the plan, self-review it for missing files, ambiguous behavior,
scope creep, and test gaps. Do not commit unless explicitly asked. End your
session by reporting the plan path and any decisions that need review before
implementation.
