# Username signup evidence

Curated results for the automatic-username delivery: every new account is
provisioned an app profile and one generated `Reso_` username in the same
transaction as the auth account creation, without consuming the 90-day new-name
allowance, and the one-time dashboard welcome remembers its dismissal on the
account. This is the third and final planned username delivery. The first
(ownership and the editor) is recorded in [username evidence](USERNAMES_EVIDENCE.md);
the second (public addresses and links) is recorded in
[username address evidence](USERNAMES_ADDRESSES_EVIDENCE.md).

Scope and completion live in [ROADMAP.md](../ROADMAP.md); current constraints
are in [known limitations](KNOWN_LIMITATIONS.md). Raw command output, browser
pass notes, and screenshots were local and uncommitted.

## Tested revision and environment

- Code revision: `c3ca0ee` on `feat/username-signup-welcome` (base `29d08f1`).
- Backend functions deployed to the personal dev deployment
  `dev:woozy-spaniel-283` (functions deployed 2026-10-17).
- The email/password live checks ran through the real Next route handler against
  that deployment; the UI pass ran against a local server pointed at the same
  deployment.
- The app is undeployed; there is no production environment to measure.

## Required verification

Run in the repository's CI order at `c3ca0ee`. All four passed:

| Command                              | Result                                          |
| ------------------------------------ | ----------------------------------------------- |
| `pnpm lint`                          | No ESLint diagnostics                           |
| `pnpm test:ci`                       | 49 files, 835 tests passed                      |
| `pnpm test:component --maxWorkers=1` | 90 files, 902 tests passed                      |
| `pnpm build`                         | Compiled successfully; no `/auth/welcome` route |

The build route table lists `/u/[username]` as the only dynamic profile route
and no longer contains the replaced `/auth/welcome` page. The known scheduler
and timeout diagnostics still appear in the passing edge output (unchanged from
the earlier deliveries); see the [address evidence](USERNAMES_ADDRESSES_EVIDENCE.md)
and [known limitations](KNOWN_LIMITATIONS.md).

Standalone `pnpm exec tsc --noEmit` is not part of the CI order and still fails
on a pre-existing four-file test typing baseline:
`app/(site)/profile/edit/_components/CountryPicker.test.tsx`,
`app/(workspace)/create/page.test.tsx`,
`components/web/AuthoringExitProvider.test.tsx`, and
`components/web/FollowButton.test.tsx`. `pnpm build` is the repository's
typecheck path and passes. See [known limitations](KNOWN_LIMITATIONS.md).

## Delivered behavior

### Provisioning at signup

`convex/auth.ts` configures Better Auth user `onCreate`/`onDelete` triggers that
run in the same transaction as the account write. `onCreate` calls
`internal.usernames.provisionAccount`, which converges the account through
`ensureAppProfile` (`convex/accountProvisioning.ts`) and `ensureUsername`
(`convex/usernameModel.ts`). Every signup, whether email/password, Google, or
GitHub, therefore has an app profile and exactly one generated `Reso_` +
10-character username as soon as account creation survives. Generation never
consumes the 90-day new-name allowance, and it is idempotent: an account that
already has a name is returned unchanged.

Generated-name collision retries are bounded to eight inside the transaction;
exhaustion fails account creation rather than retrying forever (covered by
test). `users.syncUser` converges pre-existing accounts through the same
idempotent helper, so an account created before this delivery gains a username
on its next authenticated sync. `components/web/AuthSync.tsx` replaces blanket
error suppression with a recoverable retry banner.

### One-time welcome

The one-time welcome is a dashboard-scoped popup (`components/web/WelcomeDialog.tsx`,
mounted by `DashboardOverview`). It contains only `Welcome to RESONANCE.` and
`We're glad you're here.`; it carries no username, links, or next-step task.
Dismissal is account-persisted (`convex/welcome.ts`, `users.welcomeDismissedAt`),
so it holds across sessions and browser contexts. The popup closes via the x,
Escape, or an outside click, and has no timer. It is built on the app's dialog
primitive, so focus is trapped inside the card, the dashboard behind it is
inert, and focus is restored on close.

### Routing and usability

Signup lands on `/dashboard` for email/password and both OAuth callbacks; login
keeps its validated return destination. Generated names are fully usable: the
account links its public address at `/u/<lowercase>`, and the name can be
changed later in Edit profile.

## Live evidence

Measured against `dev:woozy-spaniel-283` at `c3ca0ee`.

- Email/password signup through the real Next route handler:
  `reso-check-a-01@example.com` received `Reso_3ug9w6dwiz` at revision 1 with
  `newUsernameClaim.allowed: true` (the allowance was untouched) and the welcome
  due; its dismissal persisted across a fresh session.
  `reso-check-b-01@example.com` received `Reso_3bbwvhk352` with the welcome due;
  after abandoning the welcome and signing in again it was still due, and the
  dismissal was then recorded.
- UI pass (local server against the dev deployment): `reso-ui-check-01` signed
  up, dismissed the welcome, and passed straight through on a second sign-in;
  `reso-ui-check-02` abandoned the welcome, returned to it, and dismissed it;
  account 01's dismissal held in an independent browser context.
- The maintainer's own account (`pooyayooq@gmail.com`, Google): a
  username-less legacy account converged to `Reso_xki9rtf6ky` at revision 1
  through the authenticated idempotent path, showed the welcome once, and
  dismissed it; a later GitHub sign-in linked to the same account kept both the
  username and the dismissal.
- Generated-name addresses: `/u/reso_3ug9w6dwiz` returned 200;
  `/u/Reso_3ug9w6dwiz` returned 307 to the canonical address; an unknown name
  returned 404.
- Popup (final revision): signup `reso-ui-check-05` landed on `/dashboard` with
  the popup; the x closed it; a reload showed no popup; the database recorded
  `welcomeDismissedAt`; Tab stayed inside the dialog; Escape dismissed it; and
  the light and dark appearance matches the approved study.
- Fresh provider creation (maintainer, 2026-10-18, same dev deployment): the
  maintainer deleted their dev account and re-created it through Google, which
  landed on `/dashboard` with the one-time welcome popup and a generated `Reso_`
  username; a separate fresh account created through GitHub also landed on
  `/dashboard` with the popup and a generated `Reso_` username. The maintainer
  then claimed and restyled a username (`pooYAYooq`, revision 3) and dismissed
  the welcome.
- The development fixtures from these checks were cleaned up afterwards, so the
  observations record what was measured at the time.

## Delivery rulings and deviations

Behavior-first record of where the delivered code differs from the original
plan's sample logic. Phrased to stand without the local plan artifact.

- **The welcome page became a dashboard popup.** The plan's dedicated welcome
  page that named the generated username was replaced by the maintainer's
  decision (2026-10-18) with a dashboard popup containing only a welcome
  message. Dismissal remains account-persisted, signup lands on `/dashboard`,
  and login keeps its return destination. The approved design is archived at
  `/home/studio/projects/resonance-docs-archive/resonance-welcome-popup-2026-10-18/`.
- **`users.getCurrentUser`'s hand-written validator gained `welcomeDismissedAt`.**
  Convex object validators reject unexpected fields, so the field had to be
  added to the returned shape.
- **`AuthSync` gained the recoverable retry banner** required by spec section 8,
  replacing blanket error suppression.

## Limitations and retest triggers

- **The welcome is dashboard-scoped.** An undismissed account that never reaches
  the dashboard does not see it, and a returning undismissed account that lands
  elsewhere sees it on their next dashboard visit.
- **Dismissal was verified across independent browser contexts and sessions, not
  two physical devices.**
- **The popup's visual values are literal**, ported from the approved study
  rather than global theme tokens. Retest after global theme changes.

Re-run the four required commands on any source, dependency, or base-integration
change. Re-check the provisioning path after any change to the auth triggers,
`accountProvisioning.ts`, `usernameModel.ensureUsername`, or `users.syncUser`.
Re-check the welcome after any change to `welcome.ts`, `WelcomeDialog.tsx`, or
the dashboard mount, and re-run a fresh-provider signup when the auth triggers
or provisioning change.
