# Project status

The resume point for this revision. [ROADMAP.md](../ROADMAP.md) owns scope and
completion; GitHub owns PR state. Replace outdated notes rather than appending
a session history.

## Current focus

The agreed accessibility evidence scope is complete in
[PR #103](https://github.com/pooYAYooq/resonance/pull/103). The
[evidence record](ACCESSIBILITY.md) contains the executed checks, focus fixes,
accepted limitations, and retest triggers. It does not finalize unfinished
page designs or claim WCAG conformance.

The PR/documentation workflow keeps implementation, evidence, and completion
docs in the same change. Use [PR_CHECKLIST.md](PR_CHECKLIST.md) at initial
submission, after review changes, and before merge handoff.

## Next action

The maintainer will lead the next responsive-layout scope. Do not start a
broader redesign or choose roadmap work from phase numbering alone. The
postponed Playwright connection guide remains in the
[engineering follow-ups](../ROADMAP.md#engineering-follow-ups).

## Blockers and constraints

- No active implementation blocker is recorded. The next product scope needs
  the maintainer's decision.
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
