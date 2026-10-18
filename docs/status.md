# Project status

The resume point for this revision. [ROADMAP.md](../ROADMAP.md) owns scope and
completion; GitHub owns PR state. Replace outdated notes rather than appending
a session history.

## Current focus

The final V1-17 boundary is implemented on `feat/public-author-showcase`: the
approved public author page (`app/(site)/u/[username]/`) and the public post
catalogue (`app/(site)/u/[username]/posts/`). The page renders the hero band,
introduction, social links, display-only follower/following counts, the
owner/viewer/signed-out action, and the bounded selected or latest work; the
catalogue pages the author's published posts newest first. Behavior is cataloged
in [FEATURES.md](../FEATURES.md); the fixture protocol and browser verification
are in [author page verification](AUTHOR_PROFILE_VERIFICATION.md).

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

Hand off `feat/public-author-showcase` through the PR workflow: complete
[PR_CHECKLIST.md](PR_CHECKLIST.md), open the pull request for review, and merge
it. The remaining username-editor and reader-facing gaps stay with their own
records rather than this branch.

## Blockers and constraints

- The feed loading-announcement advisory is explicitly deferred. It is not a
  reproduced screen-reader failure; see [known limitations](KNOWN_LIMITATIONS.md).
- The dev deployment carries the disposable `acceptanceauthor` and
  `acceptanceviewer` fixtures with no published posts and no selections. Account
  deletion is unreachable, so they remain as recorded fixtures; browser checks
  use disposable data and delete only what they create.
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
