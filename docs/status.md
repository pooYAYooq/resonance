# Project status

The resume point for this revision. [ROADMAP.md](../ROADMAP.md) owns scope and
completion; GitHub owns PR state. Replace outdated notes rather than appending
a session history.

## Current focus

Username ownership and the dedicated `/profile/edit` username editor are
implemented on `feat/usernames-ownership`, committed through `ceb2bc5`; the
confirmation-classification fix and the deletion/edit interleave coverage are
committed, and the four required verification commands passed on `b4f9f73`. The
PR1 review fixes for pending-typing preservation, deadline-based eligibility
refresh, and first-claim confirmation copy are applied on the branch, and the
four required commands pass again. Usernames use the shared spelling rules in
`lib/username.ts`, permanent per-name ownership (`usernameClaims` plus the
`users.username` fields), and a 90-day wait between deliberate new-name claims
enforced by the mounted `@convex-dev/rate-limiter` component. Claims are
transactional, the Better Auth deletion callback retires a deleted account's
names permanently, and the editor saves through its own action rather than the
page-header Save. Non-styling saves wait for current-target availability before
confirmation, whose copy stays tied to its captured target; case-only edits save
immediately without lookup. The backend claim, cooldown, ownership,
deletion/edit orderings, and editor behaviors have automated coverage. A single
deterministic real-runtime concurrent-claim check passed on a non-production
deployment in the historical `9fae573` evidence collection, not a fresh runtime
retest of this branch. The real-runtime deletion/edit race was run on the
current revision in both orderings (deletion-first and edit-first) as
single-shot evidence, not a stress matrix. Results and limitations are in
[username evidence](USERNAMES_EVIDENCE.md). A partial browser pass covers the
editor's format-error association, availability states and icons, the
review-fixed first-claim confirmation copy, keyboard open/close, and 30-character
and narrow layouts. The owned/current states, the cross-tab flow, a real
screen-reader session, and a real-runtime deletion/edit stress matrix remain
open.

Remaining username work is the other two deliveries: username-based public
addresses and links, then automatic signup assignment with the one-time welcome.
The public profile still serves the ID route `/u/[userId]` until the address
delivery, so the existing identity and Featured posts editor behavior is
unchanged.

The Convex dependency is pinned to `1.46.0` and the managed AI files are
refreshed, so the earlier CLI and guidance mismatch no longer applies.

The PR/documentation workflow keeps implementation, evidence, and completion
docs in the same change. Use [PR_CHECKLIST.md](PR_CHECKLIST.md) at initial
submission, after review changes, and before merge handoff.

## Next action

Finish username ownership acceptance before merge: extend the editor browser pass
to the owned/current states, the cross-tab flow, and a real screen-reader session
when they can be exercised without consuming the real 90-day allowance. Keep the
residual real-runtime deletion/edit stress-matrix gap visible; the deterministic
interleaves and the two single-shot runtime orderings are not a stress matrix.
See [username evidence](USERNAMES_EVIDENCE.md) for coverage and retest triggers.

After that acceptance, deliver username-based public profile addresses and links:
canonical
`/u/<usernameLower>` routes, fresh temporary redirects, unavailable states, and
direct current-username links. Automatic signup assignment and the one-time
welcome follow separately. Do not broaden the ownership/editor scope while
closing these checks.

## Blockers and constraints

- The broader public author-page presentation and catalogue are not built.
- The public profile still serves the ID route `/u/[userId]`; username-based
  addresses are not built, and automatic signup assignment is not shipped.
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
