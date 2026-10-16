# Project status

The resume point for this revision. [ROADMAP.md](../ROADMAP.md) owns scope and
completion; GitHub owns PR state. Replace outdated notes rather than appending
a session history.

## Current focus

Username ownership and the dedicated `/profile/edit` username editor are
implemented at `9fae573`. Usernames use the shared spelling rules in
`lib/username.ts`, permanent per-name ownership (`usernameClaims` plus the
`users.username` fields), and a 90-day wait between deliberate new-name claims
enforced by the mounted `@convex-dev/rate-limiter` component. Claims are
transactional, the Better Auth deletion callback retires a deleted account's
names permanently, and the editor saves through its own action rather than the
page-header Save. The required `pnpm lint`, `pnpm test:ci`, `pnpm test:component`,
and `pnpm build` commands pass on this revision; the backend claim, cooldown, and
ownership paths and the editor behaviors have automated coverage; and a single
deterministic real-runtime concurrent-claim check passed on a non-production
deployment. Results and limitations are in
[username evidence](USERNAMES_EVIDENCE.md). Browser and assistive-technology
evidence for the editor and the deletion-versus-edit race are not yet covered.

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

Deliver username-based public profile addresses and links: canonical
`/u/<usernameLower>` routes, fresh temporary redirects, unavailable states, and
direct current-username links. Automatic signup assignment and the one-time
welcome follow separately. Do not reopen the implemented username ownership or
editor design.

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
