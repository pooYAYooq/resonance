# Project status

The resume point for this revision. [ROADMAP.md](../ROADMAP.md) owns scope and
completion; GitHub owns PR state. Replace outdated notes rather than appending
a session history.

## Current focus

The notifications slice on `feat/compact-actionable-notifications` is
implemented and verified: per-row persistent read state through
`notifications.markRead`, a visible New marker on unread rows, a Mark all read
action with focus return, and Discover recovery from the empty state. Visiting
the page no longer clears unread state, and
[decision 3A-033](PHASE_3A_DECISIONS.md) records the semantics. The review
rounds closed with no blockers, and the browser pass also fixed the
bell's unread badge, which anchored to the page corner instead of the bell.
Browser results are in
[notifications verification](NOTIFICATIONS_EVIDENCE.md); V1-18 is Done. The
full CI order passes on this revision.

Carry-forward from the earlier username, profile, and author-page deliveries
stays open in [known limitations](KNOWN_LIMITATIONS.md): the username editor's
owned/current and cross-tab browser states, a real screen-reader session, a
real-runtime deletion/edit stress matrix, the deletion-cascade limitation, the
author page's missing join-date control, and the catalogue query boundary's
component-only coverage.

The Convex dependency is pinned to `1.46.0` and the managed AI files are
refreshed, so the earlier CLI and guidance mismatch no longer applies.

The PR/documentation workflow keeps implementation, evidence, and completion
docs in the same change. Use [PR_CHECKLIST.md](PR_CHECKLIST.md) at initial
submission, after review changes, and before merge handoff.

## Next action

The notifications slice is complete and handed to the maintainer for review and
merge. The next notification work is the planned notification-boundary change,
which awaits its own scoped requirements before implementation. The remaining
username-editor and reader-facing gaps stay with their own records rather than
this branch.

## Blockers and constraints

- The feed loading-announcement advisory is explicitly deferred. It is not a
  reproduced screen-reader failure; see [known limitations](KNOWN_LIMITATIONS.md).
- The dev deployment carries disposable fixture accounts with no published
  posts; see [known limitations](KNOWN_LIMITATIONS.md). Browser checks use
  disposable data and delete only what they create.
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
