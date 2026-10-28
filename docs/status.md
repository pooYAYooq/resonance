# Project status

The resume point for this revision. [ROADMAP.md](../ROADMAP.md) owns scope and
completion; GitHub owns PR state. Replace outdated notes rather than appending
a session history.

## Current focus

Mobile authentication and session safety on `fix/auth-login-logout`, through
small iterations outside the roadmap sequence. The slice covers the full-height
auth layout, full-width mobile form with the desktop card, password reveal,
sign-out confirmation, and a hard 30-day session cap.
[Features](../FEATURES.md#authentication) owns the capabilities.

## Next action

Review the working tree, stage the logical commits, and open the PR. Remaining
verification gaps are recorded in
[known limitations](KNOWN_LIMITATIONS.md#authentication-and-sessions). The next
roadmap item remains V1-20, context-specific post-card variants, when roadmap
delivery resumes.

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
