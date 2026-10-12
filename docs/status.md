# Project status

The resume point for this revision. [ROADMAP.md](../ROADMAP.md) owns scope and
completion; GitHub owns PR state. Replace outdated notes rather than appending
a session history.

## Current focus

Public author identity is the approved product scope. The first delivery
boundary adds required publication covers while preserving coverless draft
saving. The corrected authoring model allows coverless preview; only final
publication requires a cover. Cover-first and cover-last browser journeys
passed. Review follow-ups validate selected files and uploads (nonempty, and
stored image bytes matching the declared type), recover an unresolvable saved
cover before Review, and removed unsupported test-query options. Ordered lint,
659 unit/backend tests, 742 component tests, and build pass; three pre-existing
direct-TypeScript test errors remain listed in
[known limitations](KNOWN_LIMITATIONS.md).
[Accessibility evidence](ACCESSIBILITY.md#required-publication-covers-2026-10-12)
records the checks performed and the remaining gaps: the review-fix states have
automated coverage but no browser retest.

The PR/documentation workflow keeps implementation, evidence, and completion
docs in the same change. Use [PR_CHECKLIST.md](PR_CHECKLIST.md) at initial
submission, after review changes, and before merge handoff.

## Next action

Prepare the required-publication-cover change for merge. Then implement the
profile foundation, editor, author page, and catalogue in their approved
boundaries. Country-dependent work requires approval of the concrete
selectable list.

## Blockers and constraints

- The concrete country dataset/subset remains unapproved; it does not block
  finishing required covers.
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
