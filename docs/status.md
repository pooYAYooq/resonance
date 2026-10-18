# Project status

The resume point for this revision. [ROADMAP.md](../ROADMAP.md) owns scope and
completion; GitHub owns PR state. Replace outdated notes rather than appending
a session history.

## Current focus

Automatic username assignment at signup and the one-time dashboard welcome are
implemented on `feat/username-signup-welcome` and verified at `fb67eca`. Every
new account (email/password, Google, or GitHub) is provisioned an app profile
and one generated `Reso_` username in the same transaction as the auth account
creation, without consuming the 90-day new-name allowance, and the
dashboard-scoped popup remembers its dismissal on the account. Verification and
live evidence, including fresh Google and GitHub account creation, are in
[username signup evidence](USERNAMES_SIGNUP_EVIDENCE.md); behavior is cataloged
in [FEATURES.md](../FEATURES.md). This completes the three planned username
deliveries; the ownership delivery merged in PR #112 and the address delivery is
recorded in [username address evidence](USERNAMES_ADDRESSES_EVIDENCE.md).

Carry-forward from the ownership delivery stays open and recorded in
[known limitations](KNOWN_LIMITATIONS.md): the username editor's owned/current
and cross-tab browser states, a real screen-reader session, a real-runtime
deletion/edit stress matrix, and the deletion-cascade limitation.

The Convex dependency is pinned to `1.46.0` and the managed AI files are
refreshed, so the earlier CLI and guidance mismatch no longer applies.

The PR/documentation workflow keeps implementation, evidence, and completion
docs in the same change. Use [PR_CHECKLIST.md](PR_CHECKLIST.md) at initial
submission, after review changes, and before merge handoff.

## Next action

Deliver the remaining V1-17 public author-page presentation and catalogue work;
the approved author-page design study is archived locally at
`resonance-profile-design-2026-10-11`. Extend the username editor browser pass to
the owned/current and cross-tab states and run a real screen-reader session when
they can be exercised without consuming the real 90-day allowance. Keep the
real-runtime deletion/edit stress-matrix gap visible; the deterministic
interleaves and the two single-shot runtime orderings are not a stress matrix.

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
