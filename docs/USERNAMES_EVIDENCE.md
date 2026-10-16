# Username ownership evidence

Curated results for the username ownership and profile-editing delivery: the
spelling rules, permanent per-name claims, the transactional claim mutation, the
90-day new-name allowance, the account-deletion retirement callback, and the
dedicated `/profile/edit` username editor. This is the first of three planned
username deliveries; username-based public addresses and automatic signup
assignment are not part of it.

Scope and completion live in [ROADMAP.md](../ROADMAP.md); current constraints are
in [known limitations](KNOWN_LIMITATIONS.md). Raw command output and the
concurrency harness were local and uncommitted.

## Tested revision

`9fae573` on `feat/usernames-ownership`. Tree was clean before and after the
documentation changes; no source, test, timeout, or vitest configuration changed
while collecting this evidence.

## Required verification

Run in the repository's CI order. All four passed on this revision.

| Command                              | Result                                                           | Exit |
| ------------------------------------ | ---------------------------------------------------------------- | ---- |
| `pnpm lint`                          | No ESLint diagnostics                                            | 0    |
| `pnpm test:ci`                       | 48 files, 810 tests passed (9.70s)                               | 0    |
| `pnpm test:component --maxWorkers=1` | 88 files, 862 tests passed (285.90s)                             | 0    |
| `pnpm build`                         | Compiled successfully; TypeScript step clean; 18/18 static pages | 0    |

The component suite was run with `--maxWorkers=1`, the documented reproducible
single-worker form. The edge suite was run once, unmodified, and was green; the
intermittent timeouts seen in an earlier implementation run did not recur (see
limitations).

Passing runs still print known diagnostics that were not resolved:

- The edge suite logged `Error when running scheduled function` followed by
  `Transaction already committed or rolled back` ten times and
  `TimeoutNegativeWarning` twice. These are inherited, unresolved, and not
  claimed as warning-free.
- `pnpm exec tsc --noEmit` is not a repository gate and still fails on the three
  pre-existing test typing errors recorded in
  [known limitations](KNOWN_LIMITATIONS.md); `pnpm build` remains the typecheck
  gate.

## What the tests cover

### Shared spelling rules (`lib/username.test.ts`)

Validation boundaries are exercised directly: empty and whitespace-only input,
lengths 2/3/30/31, unsupported characters including non-ASCII (`pooyaé`) and
`-`, `.`, space, and `@`, the at-least-one-letter rule (`12345`, `___`,
`1_2_3`), leading/trailing and consecutive underscores, digit-leading names,
surrounding-whitespace trim, exact and case-insensitive reserved-name matching
(`admina` is not reserved), and the lowercase canonical path builder. Backend
tests also reject invalid spelling even when the supplied revision is stale.

### Transactional claiming (`convex/usernames.test.ts`)

- **Simultaneous in-memory claims.** `Promise.all` races two accounts claiming
  one canonical name with different capitalization: exactly one is `saved`, the
  other is `unavailable`, exactly one claim row exists, and the loser's
  allowance is untouched (it can still claim a different name). Two different
  new targets from one account race to `saved`/`conflict` with one claim row.
  Competing new, previous-name, and capitalization-only selections at the same
  revision serialize without producing a second claim.
- **Same-account allowance.** A fresh account reads `allowed: true`; after one
  claim it reads `allowed: false` with `retryAfterMs > 0`. Separate accounts do
  not share an allowance.
- **Ownership.** Old names stay owned across repeated renames; another account
  cannot claim them; no release path is exposed.
- **Previous-name switching.** `a -> b -> a` during a cooldown keeps both
  claims and the eligibility date; availability reads `owned` for a previous
  name and `current` for the active one. A distinct new claim is then rejected
  with the remaining duration.
- **Cooldown boundaries.** A new claim at `USERNAME_CLAIM_PERIOD_MS - 1` is
  rejected as `cooldown` with `retryAfterMs` approximately 1 ms; the same claim
  at expiry is `saved`. After ten idle periods only one new claim is permitted,
  so idle time cannot bank claims.
- **Rollback after real token consumption.** A fault is injected on the claim
  insert and separately on the profile patch, after the real rate-limiter token
  is consumed. The token, claim row, and selection all roll back, and a later
  claim succeeds. Fault injection is confined to test code; ordinary
  enforcement runs use the real component.
- **Retry and limiter errors.** An exact already-saved target retried with its
  original stale revision reconciles without another write or token, while a
  stale different target (including case changes) is a `conflict`. A limiter
  error aborts the claim instead of bypassing enforcement.
- **Negative authorization.** Anonymous callers, authenticated callers without a
  synced profile, and attempts to pass a caller-selected owner are rejected;
  retirement is registered only as an internal mutation.
- **Deletion callback path.** Deletion is driven through the app adapter
  (`authComponent.adapter(ctx)({}).delete(...)`, configured with `authFunctions`
  and the `onDelete` trigger), so the component mints the deletion handle and
  runs `internal.auth.onDelete -> internal.usernames.retireAccount` in the same
  transaction. A surviving account then sees both the current and previous names
  as `unavailable`; the claim rows survive with no owner; the live profile is
  gone. A separate test retires 102 claims across bounded batches, schedules the
  continuation, and resets only that account's allowance. Before the trigger was
  wired, both claims retained `ownerUserId`, which is the recorded RED signal.

### Editor (`app/(site)/profile/edit/_components/`)

`UsernameEditor.test.tsx` (16 tests) and `useDebouncedValue.test.tsx` (2 tests)
cover: an immediate format error with the save disabled and no mutation;
the eligibility date and time shown once the allowance is spent; a free new name
reported as available but not claimable; a capitalization-only save with no
confirmation dialog; confirmation before a new claim; adopting the saved spelling
after a confirmed claim; the neutral `taken` message; preserving the draft when
a save loses the race; a conflict without losing typed input; a disabled save for
an unchanged draft; a lagging availability result not applied to the current
draft; a clean draft adopting a newer saved revision silently while a dirty
draft offers an explicit reload; the reload action adopting the saved value; and
the dialog showing the exact old and new names with distinct new-claim and
previous-name copy. The focused `/profile/edit` component suite ran 124/124.

## Limitations

- **Real provider deletion is exercised manually, not by an automated test.** The
  committed deletion test proves the configured app-adapter callback inside
  `convex-test`. Separately, the real-runtime run below deleted both fixture
  accounts through the deployed Better Auth `delete-user` HTTP endpoint and the
  configured `onDelete` trigger. No committed automated test drives that real HTTP
  path.
- **The deletion-versus-edit race is not exercised.** Both paths are
  transactional, but no concurrent deletion/edit test was run.
- **Real-runtime concurrency is a single deterministic race.** The run below
  confirms exactly one winner on a deployed non-production backend, but it is not
  a repeated or high-load stress matrix.
- **Intermittent full-suite timeouts.** During the earlier implementation of
  this work one full edge run failed with six `Test timed out in 5000ms`
  failures across six files; subsequent full runs, including the green run
  recorded here, passed without recurrence and the cause was never proven. No
  timeout or vitest configuration was changed.
- **Unresolved test-output warnings.** The scheduler
  `Transaction already committed or rolled back` stderr and
  `TimeoutNegativeWarning` remain in passing output.
- **Editor browser and accessibility evidence is outstanding.** The
  availability icons, the reload/conflict flow, and the `ProfileIdentityForm`
  change that let Display name span its row have component-test coverage only.
- **Public addressing and signup assignment are absent.** The public profile
  still serves `/u/[userId]`, and new accounts have no username until one is
  claimed through `/profile/edit`.

## Real-runtime concurrency evidence

Run on 2026-10-16 against the personal dev deployment `dev:woozy-spaniel-283`
(`https://woozy-spaniel-283.convex.cloud`), a non-production target. The current
backend was deployed to that dev deployment with `pnpm exec convex dev --once`
(which deploys functions, not the Git branch). A local, uncommitted harness
signed up two disposable accounts through the deployed Better Auth HTTP endpoint,
obtained each account's Convex token, synced each app profile, then called
`usernames:claimUsername` for one canonical name from both accounts concurrently
(`Promise.all`; styled differently as `Zzrace<stamp>` and `zzrace<stamp>`).

Exactly one claim succeeded; the other returned the neutral unavailable outcome.

| Account | Call                                 | Result                                                       |
| ------- | ------------------------------------ | ------------------------------------------------------------ |
| a       | `claimUsername("Zzracemvah34l3", 0)` | `{ kind: "saved", revision: 1, username: "Zzracemvah34l3" }` |
| b       | `claimUsername("zzracemvah34l3", 0)` | `{ kind: "unavailable" }`                                    |

The race itself produced exactly one `saved` claim; the other account received
the neutral `unavailable` outcome and acquired no claim or selection, so the
losing account's new-name allowance was not consumed. The ownerless blocked claim
row and the removed fixture profiles are the result of the later account-deletion
cleanup below, not of the race itself.

Cleanup: both disposable accounts were removed through the deployed Better Auth
self-service deletion endpoint (`POST /api/auth/delete-user`), which runs the
configured `onDelete` trigger and retired their profiles. To permit that cleanup,
`user.deleteUser.enabled` was enabled temporarily in `convex/auth.ts`, deployed,
then reverted and re-deployed; `convex/auth.ts` matches its committed revision
again. That path also exercised the real deletion callback end to end.

Residue: the one raced name `zzracemvah34l3` remains a permanently blocked claim
row, the designed outcome for a deleted account's name. No other fixture rows
remain. The temporary accounts used
`uname-fixture-a-mvah34l3@example.com` and `uname-fixture-b-mvah34l3@example.com`.

## Retest triggers

Re-run the four required commands on any source, dependency, vitest
configuration, or base-integration change. Re-run the real-runtime concurrency
check when the backend or its transaction path changes; the recorded run is a
single deterministic race, not a load test. Re-record the browser/accessibility
evidence for the username editor after any change to its availability, conflict,
or layout behavior, and re-check the known test-output warnings if the
intermittent timeouts return.
