# Project status

The resume point for this revision. [ROADMAP.md](../ROADMAP.md) owns scope and
completion; GitHub owns PR state. Replace outdated notes rather than appending
a session history.

## Current focus

The `/profile/edit` identity and Featured posts editor is implemented and
verified on this branch: one header Save applies changed sections independently,
unsaved input survives live updates, and a conflict requires an explicit reload.
Country uses common English names with familiar search aliases, spans its row,
and clears through No country inside the picker; the separate Location field is
gone. Username remains local-only. Saved Featured posts appear above the existing
public profile's full post list. Verification results, browser evidence, and
scope limits are in [accessibility evidence](ACCESSIBILITY.md). This delivery is
covered by backend and component regressions for join dates, cover eligibility,
country composition, and flag casing. Native IME behavior and the latest
live-browser refresh remain unverified.

The Convex dependency is pinned to `1.46.0` and the managed AI files are
refreshed, so the earlier CLI and guidance mismatch no longer applies.

The PR/documentation workflow keeps implementation, evidence, and completion
docs in the same change. Use [PR_CHECKLIST.md](PR_CHECKLIST.md) at initial
submission, after review changes, and before merge handoff.

## Next action

Plan username persistence and human-readable profile URLs as the next delivery.
The broader public author page and `/u/[userId]/posts` catalogue follow it. Do
not reopen the verified editor design.

## Blockers and constraints

- The broader public author-page presentation and catalogue are not built.
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
