# Project status

The resume point for this revision. [ROADMAP.md](../ROADMAP.md) owns scope and
completion; GitHub owns PR state. Replace outdated notes rather than appending
a session history.

## Current focus

Public author identity is the approved product scope. The profile foundation
adds identity constraints (name and introduction code-point limits, a reviewed
country list, five validated social platforms, and join-date formatting),
optional `users` identity fields with an authoritative immutable `joinedAt`,
and revision-checked identity and selected-work APIs with bounded reads. The
identity editor, public author page, catalogue, and selected-work presentation
remain. Ordered lint, 717 unit/backend tests, 742 component tests, and build
pass; three pre-existing direct-TypeScript test errors remain listed in
[known limitations](KNOWN_LIMITATIONS.md). This foundation adds no browser-facing
surface, so it carries no new accessibility evidence.

The PR/documentation workflow keeps implementation, evidence, and completion
docs in the same change. Use [PR_CHECKLIST.md](PR_CHECKLIST.md) at initial
submission, after review changes, and before merge handoff.

## Next action

Implement the identity editor, the public author page and catalogue, and the
selected-work presentation in their approved boundaries.

## Blockers and constraints

- The identity editor, public author page, catalogue, and selected-work
  presentation are not built; country and social fields exist only in the
  validated API layer.
- The feed loading-announcement advisory is explicitly deferred. It is not a
  reproduced screen-reader failure; see [known limitations](KNOWN_LIMITATIONS.md).
- Preserve the demo post, follow relationship, like, and comment. Browser
  checks use disposable fixtures and delete only those fixtures afterward.
- The app is not deployed; development data is disposable, subject to those
  fixture-preservation instructions. A production migration would need its own
  rollout plan.

## Read when relevant

- [Roadmap](../ROADMAP.md): scope, estimates, dependencies, and deferrals.
- [Known limitations](KNOWN_LIMITATIONS.md): runtime and verification constraints.
- [Product direction](PHASE_3A.md) and [decisions](PHASE_3A_DECISIONS.md).
- [Capabilities](../FEATURES.md), [architecture](ARCHITECTURE.md), and
  [release notes](../CHANGELOG.md).

Local specs, plans, and raw evidence are not part of the repository's durable
record. Their lifecycle is defined in [AGENTS.md](../AGENTS.md#local-artifacts).
