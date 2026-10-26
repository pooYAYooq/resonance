# Project status

The resume point for this revision. [ROADMAP.md](../ROADMAP.md) owns scope and
completion; GitHub owns PR state. Replace outdated notes rather than appending
a session history.

## Current focus

The current revision extends the compact notification baseline with engagement
events, a page-preserving drawer, responsive rows, saved desktop expansion,
focused comment destinations, follow-back actions, scoped deletion, and
age-based retention. [Features](../FEATURES.md#notifications) owns behavior;
the approved scope amendment is in [the decision log](PHASE_3A_DECISIONS.md#engagement-notification-amendment-2026-10-26).

The original three acceptance gaps were closed by the maintainer's
physical-phone results at `aadb9c1`. Review follow-up repairs truncated deletion
scopes, failed storage writes, modal Undo, hidden focus targets, bulk-delete
feedback, and the bulk-delete scope refresh. The targeted phone deletion/Undo
retest passed at merged main `96e200e`; verification is recorded in
[notifications evidence](NOTIFICATIONS_EVIDENCE.md#current-revision-summary).
Earlier UI/navigation experiments and the integrated PR #117 baseline retain
their own historical evidence.

## Next action

Start V1-19, Saved and Liked collection presentation, from
[the roadmap](../ROADMAP.md). Existing username, profile, accessibility, and
author-page gaps remain with their [limitation records](KNOWN_LIMITATIONS.md).
Changes affecting notifications reopen the relevant checks under the evidence
document's retest triggers.

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
