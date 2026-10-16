# Username address evidence

Curated results for the username-based public address delivery: resolving a
requested spelling to the owner's current address, serving the public profile
at the canonical lowercase username, redirecting every other owned spelling,
and linking authors by their current username. This is the second of the three
planned username deliveries. The first (ownership and the editor) is recorded
in [username evidence](USERNAMES_EVIDENCE.md); automatic signup assignment is
the remaining delivery.

Scope and completion live in [ROADMAP.md](../ROADMAP.md); current constraints
are in [known limitations](KNOWN_LIMITATIONS.md). Raw command output and the
browser pass notes were local and uncommitted.

## Tested revision and environment

- Code revision: `0713a91` on `feat/username-addresses` (base `f912e26`).
- Backend functions deployed to the personal dev deployment
  `dev:woozy-spaniel-283`.
- Served by a local production-mode server (`next start`, `http://localhost:3000`).
- The app is undeployed; there is no production or CDN cache to measure.

## Required verification

Run in the repository's CI order at `0713a91`. All four passed:

| Command                              | Result                                         |
| ------------------------------------ | ---------------------------------------------- |
| `pnpm lint`                          | No ESLint diagnostics                          |
| `pnpm test:ci`                       | 48 files, 819 tests passed                     |
| `pnpm test:component --maxWorkers=1` | 88 files, 882 tests passed                     |
| `pnpm build`                         | Compiled successfully; `/u/[username]` dynamic |

The build route table lists `/u/[username]` as the sole dynamic profile route.
The known scheduler and timeout diagnostics still appear in the passing edge
output (unchanged from the ownership delivery); see the ownership
[evidence](USERNAMES_EVIDENCE.md) and [known limitations](KNOWN_LIMITATIONS.md).

## Address behavior

Measured as fresh HTTP requests at `0713a91` against the dev deployment, served
by the local production-mode server. Every response, including redirects and
404s, carried `Cache-Control: private, no-cache, no-store, max-age=0,
must-revalidate`. No 301 or 308 appeared anywhere.

| Requested address    | Classification           | Result                      |
| -------------------- | ------------------------ | --------------------------- |
| `/u/zzaddrcheck7k2m` | current, lowercase       | 200                         |
| `/u/ZzAddrCheck7k2m` | current, styled spelling | 307 to `/u/zzaddrcheck7k2m` |
| `/u/ZZADDRCHECK7K2M` | current, uppercase       | 307 to `/u/zzaddrcheck7k2m` |
| `/u/zzprev7k2m`      | previously owned name    | 307 to `/u/zzaddrcheck7k2m` |
| `/u/unknownname`     | unknown                  | 404                         |
| `/u/admin`           | reserved                 | 404                         |
| `/u/zzracemvah34l3`  | deleted account's name   | 404                         |

The lowercase canonical spelling is the only form that renders a profile; every
other spelling of an owned name redirects to it, and unknown, reserved, and
deleted-account names return the shared `User not found` 404.

### Client-side navigation and switch-back

A real browser pass (incognito, signed in as the disposable fixture, current
name `ZzAddrCheck7k2m` with seeded previous claim `zzprev7k2m`) exercised real
pointer clicks on Next `Link` elements. A JavaScript marker set before each
click survived across navigation, proving client-side routing rather than a
full reload, and `PerformanceNavigationTiming.redirectCount` was exactly 1 on
every redirecting visit:

- Before any switch: the `/dashboard` sidebar author card linked to
  `/u/zzaddrcheck7k2m` and navigated there with the marker intact.
- After switching the current name to `zzprev7k2m`: the sidebar author card and
  the `Profile` nav item both pointed at `/u/zzprev7k2m`; a mixed-case visit to
  `/u/ZzAddrCheck7k2m` redirected one hop to `/u/zzprev7k2m`.
- After switching back to `ZzAddrCheck7k2m`: both sidebar links pointed at
  `/u/zzaddrcheck7k2m` again, and `/u/zzprev7k2m` redirected one hop back to it.

Link `href`s therefore follow the current name after each switch, and no loop
or stale destination was observed. Two probe evaluations raced client
hydration before the link locator settled; after waiting, the `href`s were
present and correct. No functional failure was observed.

## Delivery rulings and deviations

Behavior-first record of where the delivered code differs from the original
plan's sample logic or commit commands. Phrased to stand without the local plan
artifact.

- **Owned previous names redirect, not 404.** `resolveUsername` returns a
  redirect for an owned previous name instead of classifying it not-found. The
  plan's sample guard treated every owned non-current name as missing; the
  delivered guard returns not-found only for invalid input, an absent claim, an
  ownerless claim, or a missing owner profile.
- **Only the exact canonical lowercase spelling renders.** A profile renders
  only when the requested spelling equals the owner's canonical lowercase form.
  Every other spelling of an owned name (styled, uppercase, previous) redirects
  to that form. The plan's sample condition would have rendered duplicate
  mixed-case profiles and self-redirected the canonical address in a loop.
- **Unavailable state is a real HTTP 404.** Unknown, reserved, and
  deleted-account names return a real 404 through `next/navigation`
  `notFound()`, with a route-scoped `not-found.tsx` that shares one
  presentation with the missing-profile path. The spec proposed 404; the plan's
  default was an optional inline presentation. Tests mock `notFound` as
  throwing, matching the runtime.
- **`ProfileHeader` takes `username` optionally.** Delivered as
  `username?: string | null` rather than a required prop, matching the
  component's other optional props and avoiding churn in unrelated tests. Its
  sole production caller passes the resolved value explicitly.
- **Resolve-username sample-test corrections.** The sample called a helper
  non-destructively (`own.mutation(...)`) where the helper returns an object
  (`{ own, subject }`), and it omitted the simulated 90-day allowance advance
  between two distinct new-name claims, which would have made the second claim
  a cooldown. Both were corrected in the tests.
- **Commit commands corrected at the gate.** The plan's commit command for the
  username-on-profile change omitted its test files, and the author-links
  commit command omitted its `app/(marketing)` and `app/(workspace)` changes.
  Both were corrected before commit so every changed file ships with the code
  it verifies.
- **No codegen was required.** New functions were added to already-mapped
  Convex modules, so generated files did not change. Both the production build
  and the functions deploy produced no `_generated` diffs.
- **Author-links brief-versus-code discrepancies resolved.** The brief's
  "author-profile post list in `convex/profiles.ts`" reference was stale; the
  rendered surface is `getPostsByAuthorId` in `convex/posts.ts`, which was
  updated. `convex/users.ts` already carried `username`, so no edit was needed.
  `convex/notifications.ts` reuses its existing deduplicated actor map instead
  of a second lookup pass, producing identical values with fewer reads.

The worktree and isolation setup decision is process-only and is not recorded
here.

## Limitations and retest triggers

- **Undeployed, so production and CDN caching is unverified.** The redirect
  status and `Cache-Control` header were measured only through the local
  production-mode server against the dev deployment. A deployed run is needed
  to confirm CDN and production-cache behavior before relying on the 307s.
- **Browser console logs were not captured.** The preview harness exposed no
  console surface; no error state or dialog appeared during the pass.
- **Fixture residue is left in place deliberately.** The disposable account,
  its current name `ZzAddrCheck7k2m`, and the seeded previous claim
  `zzprev7k2m` remain on the dev deployment as the address fixture.

Re-run the four required commands on any source, dependency, or base-integration
change. Re-measure the address matrix after any change to `resolveUsername`, the
route rewrite, or the redirect/not-found presentation. Re-check the client-side
redirect hop count after any change to the profile link producers.
