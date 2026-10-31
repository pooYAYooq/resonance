# Project status

The resume point for this revision. [ROADMAP.md](../ROADMAP.md) owns scope and
completion; GitHub owns PR state. Replace outdated notes rather than appending
a session history.

## Current focus

V1-21 visual system. V1-20 is complete: the author gallery, feed, Blog, and
Saved/Liked cards share the post-card primitives, and the collection matrix from
320 to 1920 is recorded in
[accessibility evidence](ACCESSIBILITY.md#saved-and-liked-card-primitives-2026-10-31).
Landing is V1-29; Dashboard Overview is V1-28. Both are final v1.0 surfaces,
after V1-21/V1-23 and before release readiness.
[Features](../FEATURES.md#blog) owns the reader capabilities.

## Next action

Start V1-21, including Follow/Following colors and the light-theme contrast
observations from V1-11. V1-28 and V1-29 each need a design session before
implementation. V1-28 must settle the dashboard's purpose, composition, and data
needs, and may change the architecture. V1-29 uses authored mock visuals, not
live posts. The public Blog and signed-in feed matrices, plus search and
responsive filter regressions, are recorded in
[accessibility evidence](ACCESSIBILITY.md#feed-and-blog-cards-2026-10-30).
The remaining physical-mobile verification for auth is recorded in
[known limitations](KNOWN_LIMITATIONS.md#authentication-and-sessions).

Saved and Liked behavior remains documented in
[Features](../FEATURES.md#private-collections), with its grouping acceptance in
[accessibility evidence](ACCESSIBILITY.md#saved-and-liked-time-group-presentation-2026-10-27)
and the current card matrix in
[the same document](ACCESSIBILITY.md#saved-and-liked-card-primitives-2026-10-31).
Collection deferrals remain in [the roadmap](../ROADMAP.md). Existing username,
profile, accessibility, and author-page gaps remain with their
[limitation records](KNOWN_LIMITATIONS.md). Changes affecting notifications
reopen the relevant checks under the evidence document's retest triggers.

## Blockers and constraints

- V1-28's purpose, composition, and data needs are unresolved and may change
  the architecture. No estimate or implementation starts before its design
  session.
- V1-29 uses authored mock visuals, not live posts. The current landing still
  renders uncurated latest posts until that slice; the gap is recorded in
  [known limitations](KNOWN_LIMITATIONS.md).
- Public-content moderation and reporting are post-v1.0. Resonance v1.0 is a
  portfolio milestone, not a public launch.
- Feed and Blog pagination status regions are component-tested, not verified
  with a real screen reader; see [known limitations](KNOWN_LIMITATIONS.md).
- The dev deployment carries disposable fixture data; existing accounts and
  retained test posts are described in [notifications evidence](NOTIFICATIONS_EVIDENCE.md).
  Browser checks delete only what they create unless the maintainer explicitly
  asks to retain fixtures.
- The app is not deployed; v1.0 is a portfolio milestone, so development data
  is disposable. A production migration would need its own rollout plan.

## Read when relevant

- [Roadmap](../ROADMAP.md): scope, estimates, dependencies, and deferrals.
- [Known limitations](KNOWN_LIMITATIONS.md): runtime and verification constraints.
- [Product direction](PHASE_3A.md) and [decisions](PHASE_3A_DECISIONS.md).
- [Capabilities](../FEATURES.md), [architecture](ARCHITECTURE.md), and
  [release notes](../CHANGELOG.md).

Local specs, plans, and raw evidence are not part of the repository's durable
record. Their lifecycle is defined in [AGENTS.md](../AGENTS.md#local-artifacts).
