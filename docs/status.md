# Project status

The resume point for this revision. [ROADMAP.md](../ROADMAP.md) owns scope and
completion; GitHub owns PR state. Replace outdated notes rather than appending
a session history.

## Current focus

V1-20, context-specific post-card variants on
`feat/feed-and-blog-post-cards`. The author gallery is merged; the feed and Blog
rows are implemented with uniform cards, full author metadata, no excerpt,
full-height covers at the horizontal breakpoint, hybrid feed pagination, manual
Blog pagination, the Blog surface name, sticky search/Topics controls, a compact
mobile hero, and a short-landscape layout. Landing and collections remain.
[Features](../FEATURES.md#blog) owns the reader capabilities.

## Next action

Open the Phase 2 PR. The public Blog and signed-in feed matrices are recorded in
[accessibility evidence](ACCESSIBILITY.md#feed-and-blog-cards-2026-10-30). After
merge, start the landing card and close out V1-20. The remaining physical-mobile
verification for auth is recorded in
[known limitations](KNOWN_LIMITATIONS.md#authentication-and-sessions).

Saved and Liked behavior remains documented in
[Features](../FEATURES.md#private-collections), with its acceptance in
[accessibility evidence](ACCESSIBILITY.md#saved-and-liked-time-group-presentation-2026-10-27).
Collection deferrals remain in [the roadmap](../ROADMAP.md). Existing username,
profile, accessibility, and author-page gaps remain with their
[limitation records](KNOWN_LIMITATIONS.md). Changes affecting notifications
reopen the relevant checks under the evidence document's retest triggers.

## Blockers and constraints

- Feed and Blog pagination status regions are component-tested, not verified
  with a real screen reader; see [known limitations](KNOWN_LIMITATIONS.md).
- The dev deployment carries disposable fixture data; existing accounts and
  retained test posts are described in [notifications evidence](NOTIFICATIONS_EVIDENCE.md).
  Browser checks delete only what they create unless the maintainer explicitly
  asks to retain fixtures.
- The app is not deployed; development data is disposable. A production
  migration would need its own rollout plan.

## Read when relevant

- [Roadmap](../ROADMAP.md): scope, estimates, dependencies, and deferrals.
- [Known limitations](KNOWN_LIMITATIONS.md): runtime and verification constraints.
- [Product direction](PHASE_3A.md) and [decisions](PHASE_3A_DECISIONS.md).
- [Capabilities](../FEATURES.md), [architecture](ARCHITECTURE.md), and
  [release notes](../CHANGELOG.md).

Local specs, plans, and raw evidence are not part of the repository's durable
record. Their lifecycle is defined in [AGENTS.md](../AGENTS.md#local-artifacts).
