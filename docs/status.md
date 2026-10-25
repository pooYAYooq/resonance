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

The latest full automated verification and development retention deployment
checks are recorded in [notifications evidence](NOTIFICATIONS_EVIDENCE.md#current-revision-summary).
Documentation now distinguishes current behavior from superseded UI/navigation
experiments. The implementation extension still has acceptance work; it is not
recorded as complete merely because the automated checks passed. The integrated
PR #117 baseline retains its own historical evidence.

## Next action

Review notification rows and actions with an account that has notification
events, then confirm normal drawer exit and focus handoff on a physical phone.
The empty-state and scroll-preservation check is in
[notifications evidence](NOTIFICATIONS_EVIDENCE.md#drawer-visual-check). The
phone-preview publishing retest remains open in
[known limitations](KNOWN_LIMITATIONS.md#notifications). After relevant fixes,
refresh affected verification and apply [the PR checklist](PR_CHECKLIST.md).
Other username, profile, accessibility, and author-page gaps remain with their
existing limitation records.

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
