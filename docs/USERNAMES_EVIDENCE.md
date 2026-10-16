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

## Tested revisions

Current automated verification: `2b56de8` on `feat/usernames-ownership` plus the
uncommitted confirmation-classification fix in `UsernameEditor.tsx` and its
regression tests, plus deterministic deletion/edit interleave tests in
`convex/usernames.test.ts`, tested on 2026-10-16. Non-styling saves now wait for a resolved
current-target classification; the dialog captures that classification with the
target. Format validation remains immediate, and case-only edits do not wait for
lookup. No backend implementation, generated file, dependency, timeout, or vitest configuration
changed. A local browser/accessibility pass of the amended editor was performed
(see the browser section); no deployment or real-runtime backend retest was
performed for this fix.

Historical verification at `9fae573` is retained below. It does not verify the
amended editor source. The real-runtime evidence later in this document belongs
to that earlier collection, not a fresh run of the amended source.

## Required verification

### Deletion/edit interleave coverage

After adding the three coverage cases, the following commands passed in the
requested order on `2b56de8` plus both uncommitted fix rounds:

| Command                                                                 | Result                             | Exit |
| ----------------------------------------------------------------------- | ---------------------------------- | ---- |
| `pnpm exec vitest run convex/usernames.test.ts convex/profiles.test.ts` | 2 files, 73 tests passed (2.61s)   | 0    |
| `pnpm test:ci`                                                          | 48 files, 813 tests passed (8.27s) | 0    |
| `pnpm lint`                                                             | No ESLint diagnostics              | 0    |

These tests passed on the first run against the existing implementation. There
was no RED and no backend behavior fix. Component/build results below precede the
test-only addition; they were not rerun in this second round. Changed-file
Prettier and `git diff --check` also passed after documentation reconciliation.

### Editor fix verification

Run in the repository's CI order after the final source/test changes. All four
passed on `2b56de8` plus the uncommitted editor fix, before the deletion/edit
coverage tests were added; documentation was then reconciled with these results.

| Command                              | Result                                                           | Exit |
| ------------------------------------ | ---------------------------------------------------------------- | ---- |
| `pnpm lint`                          | No ESLint diagnostics                                            | 0    |
| `pnpm test:ci`                       | 48 files, 810 tests passed (8.03s)                               | 0    |
| `pnpm test:component --maxWorkers=1` | 88 files, 870 tests passed (258.48s)                             | 0    |
| `pnpm build`                         | Compiled successfully; TypeScript step clean; 18/18 static pages | 0    |

The focused command
`pnpm exec vitest run --config vitest.ui.config.ts 'app/(site)/profile/edit'`
passed 6 files and 132 tests (14.06s). Before implementation, the editor suite
failed four assertions: Save enabled during debounce, Save enabled after debounce
with an unresolved query, and confirmation copy drifting in each classification
direction. After implementation the editor suite passed 24/24; the final focused
and full component runs also include all 24 editor tests.

### Historical verification at `9fae573`

All four commands passed in the earlier collection, with no source/test/config
changes during that collection:

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

The passing edge runs still print known diagnostics that were not
resolved:

- The edge suite logged `Error when running scheduled function` followed by
  `Transaction already committed or rolled back` ten times and
  `TimeoutNegativeWarning` twice. These are inherited, unresolved, and not
  claimed as warning-free.
- Both fix-round edge runs also logged the malformed Search-row repair diagnostic;
  the editor-fix component run logged intentional save/cleanup failure paths and
  jsdom's `Not implemented: navigation to another Document`. None caused a test
  failure; the focused editor/profile run had no diagnostics.
- The earlier collection recorded three pre-existing test typing errors from
  `pnpm exec tsc --noEmit`, which is not a repository gate; it was not rerun for
  this fix. See [known limitations](KNOWN_LIMITATIONS.md). `pnpm build` remains
  the typecheck gate and passed on the amended source.

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
- **Deterministic deletion/edit interleaves.** Three cases exercise the same
  account through the configured deletion callback: a completed new-name edit
  followed by deletion; deletion followed by edits using the deleted identity;
  and deletion followed by edits carrying revision 1 captured before the rename
  to revision 2. Each fixture first claims `first_name`, waits one real component
  claim period using the fake clock, and claims `second_name`. Assertions are
  keyed by canonical name, not row ordering: the raw app profile is gone, both
  claims remain ownerless, no claim references the deleted owner, and another
  account cannot claim either name. The limiter read returns the cleared default
  (`value: 1`, `ts: 0`) rather than the consumed bucket. Post-deletion previous-name,
  case-only, and new-name writes all reject as `Unauthorized`, leave no new claim
  or profile, and do not recreate limiter state. These satisfy the targeted
  deletion/edit ordering check, not a true real-runtime concurrent race; no
  transaction was suspended mid-flight or run concurrently with deletion.

### Editor (`app/(site)/profile/edit/_components/`)

`UsernameEditor.test.tsx` (24 tests) and `useDebouncedValue.test.tsx` (2 tests)
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
previous-name copy. Deterministic fake-timer regressions additionally verify that
Save cannot open confirmation during a lagging debounce or an unresolved query
after debounce, with and without a new-name allowance; resolved owned names can
be confirmed and saved during cooldown; case-only edits save without lookup even
during cooldown; and an open dialog keeps its captured target and classification
when the advisory query changes in either direction. Existing new-claim tests now
wait for actual availability before opening confirmation, rather than relying on
the former unclassified Save behavior. The server-authoritative unavailable and
conflict outcomes still preserve the draft. The focused `/profile/edit`
component suite ran 132/132.

## Browser and accessibility evidence

Collected on 2026-10-16 against the amended editor (the uncommitted
classification fix) served by `next dev` at `http://localhost:3000` and pointed at
the personal dev deployment `dev:woozy-spaniel-283`, through an attached Chrome
session. The signed-in account was the maintainer's own and has no username. No
account data was changed: no claim was confirmed, no field was saved, and the
editor draft was reloaded afterwards.

| Check                        | Method                              | Result                                                                                                                                                                                                 |
| ---------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Format-error association     | type `pooya-k`                      | `Use only English letters, numbers, and underscores.`; input `aria-invalid="true"`; `aria-describedby` lists both the help and error element ids; the error element exists; Save disabled; no mutation |
| Reserved/unavailable name    | type `resonance`                    | `Username unavailable.` with an `aria-hidden` `circle-x` icon; Save disabled                                                                                                                           |
| Free new name                | type `zzbrowsercheck7`              | `Available.` with an `aria-hidden` `circle-check` icon; Save enabled                                                                                                                                   |
| New-claim confirmation       | open Save                           | title `Change your username?`; new-claim copy naming the 90-day wait plus the old-to-new line; focus moved into the dialog (Cancel focused); Cancel and Escape closed it with no save                  |
| Keyboard path                | focus input, Tab, Enter, Escape     | Tab reached `Save username`; Enter opened the dialog; Escape closed it                                                                                                                                 |
| 30-character and narrow name | 30-char value at 2554 px and 375 px | no page-level horizontal overflow at either width; at 375 px the field scrolls its text internally and stays inside the viewport                                                                       |
| Console                      | during the pass                     | 0 errors, 0 warnings                                                                                                                                                                                   |

Not exercised in the browser, and covered by component tests only:

- the `already current` and `owned previous name` availability states and the
  owned-name confirmation copy, because the signed-in account has no username and
  claiming one would consume its real 90-day allowance and permanently claim a
  name;
- the cross-tab reload/conflict flow, which needs a second session to change the
  saved username (same account constraint);
- the transient "Save disabled while the lookup resolves" timing, covered by the
  deterministic fake-timer tests.

Also observed: with an empty field the editor marks the input invalid and shows
`Choose a username.` on load. The plan's Review Focus requires empty input to
produce a specific message, so this is intended, not a defect.

## Limitations

- **Real provider deletion is exercised manually, not by an automated test.** The
  committed deletion test proves the configured app-adapter callback inside
  `convex-test`. Separately, the real-runtime run below deleted both fixture
  accounts through the deployed Better Auth `delete-user` HTTP endpoint and the
  configured `onDelete` trigger. No committed automated test drives that real HTTP
  path.
- **Deletion/edit runtime concurrency has two observed orderings, not a matrix.**
  The real-runtime race above exercised deletion-first (edit rejected) and
  edit-first (edit saved, then retired), on a single-fixture, single-shot basis,
  not a repeated or high-load stress matrix. The deterministic interleave tests
  remain the regression coverage.
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
- **Editor browser/AT evidence is partial.** A real-browser pass covers the
  format-error association, the available/unavailable states and their icons, the
  new-claim confirmation, keyboard open/close, and 30-character and narrow-layout
  behavior (see the browser section above). The `already current` and
  `owned previous name` states and their confirmation copy, the cross-tab
  reload/conflict flow, and the `ProfileIdentityForm` full-width Display name row
  remain component-test-only, because the signed-in account has no username and
  exercising them would consume its real 90-day allowance. No real screen-reader
  session was run; the pass inspected keyboard behavior and ARIA wiring directly.
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
the neutral `unavailable` outcome and acquired no claim or selection. An untouched
loser's new-name allowance is a code-path inference, not a directly observed
quota read in this real-runtime run (the separate in-memory test exercises that
behavior). The ownerless blocked claim row and the removed fixture profiles are
the result of the later account-deletion cleanup below, not of the race itself.

Cleanup: both disposable accounts were removed through the deployed Better Auth
self-service deletion endpoint (`POST /api/auth/delete-user`), which runs the
configured `onDelete` trigger and retired their profiles. To permit that cleanup,
`user.deleteUser.enabled` was enabled temporarily in `convex/auth.ts`, deployed,
then reverted and re-deployed; `convex/auth.ts` matches its committed revision
again. That path also exercised the real deletion callback end to end.

Residue: the one raced name `zzracemvah34l3` remains a permanently blocked claim
row, the designed outcome for a deleted account's name. Residue checks used
read-only queries; no other fixture rows remained. The temporary accounts used
`uname-fixture-a-mvah34l3@example.com` and `uname-fixture-b-mvah34l3@example.com`.

### Real-runtime deletion/edit race

Run on 2026-10-16 against the same non-production dev deployment. A disposable
account synced, claimed `first_name` (consuming its allowance), then made a
capitalization-only rename concurrently with its own deletion through the
deployed `delete-user` endpoint (which runs the configured `onDelete` trigger).
A capitalization-only edit was used because a new name is rejected by the 90-day
allowance regardless of the race.

Both backend orderings were observed:

| Backend ordering                                         | Edit call                                        | Delete call    | Post-state                                             |
| -------------------------------------------------------- | ------------------------------------------------ | -------------- | ------------------------------------------------------ |
| Deletion serialized first (both requests fired together) | rejected `Unauthorized` at `convex/usernames.ts` | `User deleted` | profile gone; the claimed name stays ownerless/blocked |
| Edit serialized first (delete request sent 150 ms later) | `saved`, revision 2, uppercase styling           | `User deleted` | profile gone; the renamed name stays ownerless/blocked |

Independent read-only checks after each run: each canonical name has exactly one
claim row with no owner, no fixture app `users` row remains, and the Better Auth
`user` table holds no fixture. As with the concurrency run above,
`user.deleteUser.enabled` was enabled temporarily for cleanup, deployed, then
reverted and re-deployed so `convex/auth.ts` matches its committed revision.

Residue: three disposable names (`zzdelracemvajt6a5`, `zzdelracemvajtmqn`,
`zzdelracemvaju404`) remain permanently blocked claim rows, the designed outcome
for deleted accounts. No fixture profile or auth user remains. The accounts used
`uname-fixture-r-mvajt6a5@example.com`, `uname-fixture-r-mvajtmqn@example.com`,
and `uname-fixture-r-mvaju404@example.com`.

## Retest triggers

Re-run the four required commands on any source, dependency, vitest
configuration, or base-integration change. Re-run the real-runtime concurrency
check when the backend or its transaction path changes; the recorded run is a
single deterministic race, not a load test. Re-record the browser/accessibility
evidence for the username editor after any change to its availability, conflict,
confirmation, Save gating, or layout behavior. The partial browser pass above
should be extended to the owned/current states, the cross-tab flow, and a real
screen reader when they can be exercised without consuming the maintainer's
allowance. Re-run the deletion/edit
interleave tests when claiming, auth deletion, retirement, or limiter cleanup
changes. Re-run the real-runtime deletion/edit race when claiming, auth deletion,
retirement, or limiter cleanup changes; the recorded run is two single-shot
orderings, not a stress matrix.
Re-check the known test-output warnings if the intermittent timeouts return.
