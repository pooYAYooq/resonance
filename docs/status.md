# Project status

The resume point for this revision. [ROADMAP.md](../ROADMAP.md) owns scope and
completion; GitHub owns PR state. Replace outdated notes rather than appending
a session history.

## Current focus

Username-based public addresses and links are implemented on
`feat/username-addresses` and verified at `0713a91`. Public profiles serve the
canonical lowercase `/u/<username>`; every other spelling of an owned name
(styled, uppercase, or a previous name) redirects to it, and unknown, reserved,
and deleted-account names return a shared 404. Comment author names and every
other generated author link resolve to the current lowercase username; authors
without a username render a plain label. Verification and measured redirect
headers are in [username address evidence](USERNAMES_ADDRESSES_EVIDENCE.md);
behavior is cataloged in [FEATURES.md](../FEATURES.md). The ownership delivery
merged in PR #112.

Remaining username work is the automatic signup assignment with the one-time
welcome. Carry-forward from the ownership delivery stays open and recorded in
[known limitations](KNOWN_LIMITATIONS.md): the username editor's owned/current
and cross-tab browser states, a real screen-reader session, a real-runtime
deletion/edit stress matrix, and the deletion-cascade limitation.

The Convex dependency is pinned to `1.46.0` and the managed AI files are
refreshed, so the earlier CLI and guidance mismatch no longer applies.

The PR/documentation workflow keeps implementation, evidence, and completion
docs in the same change. Use [PR_CHECKLIST.md](PR_CHECKLIST.md) at initial
submission, after review changes, and before merge handoff.

## Next action

Deliver automatic signup assignment and the one-time welcome: a new account
receives a username at signup, with a fallback when assignment is unavailable,
and a one-time welcome page. Extend the username editor browser pass to the
owned/current and cross-tab states and run a real screen-reader session when
they can be exercised without consuming the real 90-day allowance. Keep the
real-runtime deletion/edit stress-matrix gap visible; the deterministic
interleaves and the two single-shot runtime orderings are not a stress matrix.

## Blockers and constraints

- The broader public author-page presentation and catalogue are not built.
- Automatic signup assignment is not shipped; a new account has no username
  until its owner claims one through `/profile/edit`, and the one-time welcome
  page is not built.
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
