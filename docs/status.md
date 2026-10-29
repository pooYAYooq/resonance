# Project status

The resume point for this revision. [ROADMAP.md](../ROADMAP.md) owns scope and
completion; GitHub owns PR state. Replace outdated notes rather than appending
a session history.

## Current focus

V1-20, context-specific post-card variants on
`feat/context-post-card-variants`. The author profile and catalogue cards are
implemented, browser-verified, and approved; feed, Discover, and landing cards
remain. [Features](../FEATURES.md#profiles--settings) owns the author-page
capability.

## Next action

Open the Phase 1 PR for review and merge, then start the feed and Discover
phase. The remaining physical-mobile verification for auth is recorded in
[known limitations](KNOWN_LIMITATIONS.md#authentication-and-sessions).

Saved and Liked behavior remains documented in
[Features](../FEATURES.md#private-collections), with its acceptance in
[accessibility evidence](ACCESSIBILITY.md#saved-and-liked-time-group-presentation-2026-10-27).
Collection deferrals remain in [the roadmap](../ROADMAP.md). Existing username,
profile, accessibility, and author-page gaps remain with their
[limitation records](KNOWN_LIMITATIONS.md). Changes affecting notifications
reopen the relevant checks under the evidence document's retest triggers.

## Blockers and constraints

- The feed loading-announcement advisory is explicitly deferred. It is not a
  reproduced screen-reader failure; see [known limitations](KNOWN_LIMITATIONS.md).
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
