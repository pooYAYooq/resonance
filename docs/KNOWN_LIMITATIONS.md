# Known limitations

Current constraints and verification gaps, not a second backlog. Scope and
priorities belong in [ROADMAP.md](../ROADMAP.md). Remove or revise entries when
evidence resolves them. The previous detailed delivery history remains in
[the PR #103 revision](https://github.com/pooYAYooq/resonance/blob/d2d5fed/docs/status.md).

## Accessibility and responsive behavior

- [Accessibility evidence](ACCESSIBILITY.md) covers the agreed keyboard scope
  in Chrome. It is not WCAG conformance, real screen-reader acceptance, touch
  acceptance, or a final design sign-off. Firefox and Safari were not manually
  exercised. Retest after relevant behavior/layout changes.
- The current `/profile/edit` passed the both-theme Deep browser matrix in
  managed Windows Chrome. Query-echo timing and late account-switch errors have
  automated rather than browser fault-injection coverage; see `J6-ProfileEditor`
  in [Accessibility evidence](ACCESSIBILITY.md). Retest after relevant changes.
- Country-picker IME composition and Turkish-locale search/flag casing repairs have
  synthetic-event/component regressions, not fresh live-browser acceptance.
  Native IME behavior remains unverified; see the country review follow-up in
  [Accessibility evidence](ACCESSIBILITY.md).
- The maintainer deferred the feed loading-announcement advisory to avoid
  expanding PR #103. A status region created with its initial text may not
  announce reliably in some screen readers; this has not been reproduced with
  a real screen reader. No follow-up implementation is currently scheduled.
- Shared navigation corrected earlier narrow-layout overflow. The separate
  signed-out responsive acceptance at 320/375 remains unverified under V1-23;
  keyboard evidence does not close the broader responsive item.
- Management pending/error/retry and empty-state deletion were component-tested
  rather than browser fault-injected. Draft pagination also had only automated
  coverage because there were insufficient drafts during its acceptance pass.
  Later keyboard matrices in `ACCESSIBILITY.md` supplement that original scope.
- Follow colors and the light-theme contrast observations remain under V1-21.

## Authoring and recovery

- Pasted Table-of-Contents anchors (`#heading`) become plain text because the
  safe-link allowlist permits http, https, and mailto, and reader headings have
  no IDs. HTML drag-and-drop can still introduce shapes repaired by paste:
  BlockNote exposes no drop hook, so save-time validation handles that path.
- The installed side-handle menu has no separate "Turn into" surface. A
  custom drag-safe adapter replaces the menu that opened on mousedown.
- An untouched new post can briefly count as dirty because the default empty
  paragraph differs from the empty-block baseline. Empty recovery snapshots
  are suppressed, but a blank target switch may show a transition notice.
- Always-available in-page Discard is deferred by decision 3A-021. Local
  recovery clears on save, revert, or empty content.
- Browsers without the Navigation API and uncancelable history traversals
  flush new/draft recovery synchronously instead of presenting a cancellable
  Back/Forward dialog. Published edits and selected cover Files can still be
  lost there. See [authoring architecture](ARCHITECTURE.md).
- Native beforeunload wording/appearance is browser-controlled. Crashes or
  forced shutdowns can lose work; unload performs no server save/upload. Some
  full-document browser-test navigations raised prompts outside the editor;
  the cause was not diagnosed in the accessibility evidence task.
- Cover removal alone still confirms lightly on app navigation: an
  effectively-empty draft cannot recover it. A validated target switch can
  clear recovery just before a page-level adoption rejection; the in-memory
  document is retained in that narrow race.
- A newly saved draft keeps `/create`; New Post points to the same URL and
  does nothing in that session. Use Start fresh to open another new post.

## Engineering and verification

- No general stored-data migration process exists for this undeployed app.
  A large existing deployment would need a staged rollout before new indexed
  callers. The notification retention index was backfilled by Convex and
  verified queryable on development; it requires no document-field backfill.
  Pre-engagement notification rows from the earlier publication fan-out lack
  `type` and `dedupeKey`; clear or migrate them before pushing this schema to a
  deployment that still holds them. The development deployment was checked and
  has none. See
  [retention evidence](NOTIFICATIONS_EVIDENCE.md#notification-retention).
- Search-index pagination cannot be bounded by read budgets: the installed
  Convex 1.46 API still documents that `maximumRowsRead` and `maximumBytesRead`
  are not enforced for search queries, and the upstream backend reports no split
  cursor for a search query. Own-post title search therefore refuses an explicit
  end cursor instead of scanning the range. The `convex-test` emulator diverges
  (it enforces read budgets on search and can report a split cursor), so an
  emulator pass does not establish deployed behavior. Recheck against a
  deployed backend.
- Authenticated owner-scoped mutation tests are limited by the Better Auth
  fixture in `convex-test`; a passing test emits a known scheduled-cleanup
  warning. Preserve negative authorization coverage when changing these paths.
- Component runs can contend across workers. Use
  `pnpm test:component --maxWorkers=1` for reproducible local suite evidence.
- The title's Enter-to-body behavior depends on a dynamically imported editor
  handle and is browser-verified rather than exercised by jsdom.

## Usernames

- The one-time welcome is dashboard-scoped. An undismissed account that never
  reaches the dashboard does not see it, and a returning undismissed account
  that lands elsewhere sees it on their next dashboard visit.
- Welcome dismissal persistence was verified across independent browser contexts
  and sessions, not two physical devices.
- The welcome popup's visual values are literal, ported from the approved study
  rather than global theme tokens. Retest after global theme changes.
- Username-address caching is unverified in production. The redirect status and
  `Cache-Control` header were measured only through a local production-mode
  server against the personal dev deployment; the app is undeployed, so CDN and
  production-cache behavior is unconfirmed. See
  [username address evidence](USERNAMES_ADDRESSES_EVIDENCE.md).
- The username editor's browser and accessibility evidence is partial. A
  real-browser pass covers the format-error association, the available and
  unavailable states with their icons, the new-claim confirmation (re-recorded
  after the review fixes), keyboard open/close, and 30-character and narrow
  layouts. The `already current` and `owned previous name` states and their copy,
  the cross-tab reload/conflict flow, a real screen-reader session, and the
  `ProfileIdentityForm` full-width Display name row remain component-test-only.
  The cooldown-expiry re-block behavior is component-test only because the
  maintainer's account has no active cooldown.
- Real-runtime simultaneous-claim behavior has a single deterministic check
  against the personal dev deployment (exactly one winner), recorded in
  [username evidence](USERNAMES_EVIDENCE.md). It is not a repeated or high-load
  stress test; the in-memory concurrent-claim tests remain the regression
  coverage.
- Account deletion removes the app profile row and permanently blocks the
  account's names (spec section 8). It does not cascade to relationships or
  content: follow rows, follower/following counts, and published posts that
  reference the deleted `userId` remain, and `follows.toggleFollow` throws
  `User not found.` for a target whose profile row is gone. That cascade is
  explicitly separate scope (spec section 8), and account deletion is not
  reachable yet: Better Auth self-service deletion is disabled and there is no
  deletion UI.

## Author page and catalogue

- The author page's join-date display preference has no editor control: the
  approved editor layout superseded the date-preference UI, so `relative` is
  reachable only for records that still store it while the canvas renders both
  `calendar` and `relative` formats. Component tests cover the formatting
  thresholds, not a browser-edited preference.
- The catalogue's query-error boundary and its Retry are component-tested only.
  A live Convex subscription failure cannot be injected with the browser
  tooling, so the browser pass exercised the card-image recovery instead;
  `J6-ProfileEditor` used the same automated-only pattern for query-echo timing.
  See [accessibility evidence](ACCESSIBILITY.md).
- The dev deployment carries two disposable fixture accounts,
  `notification.author@example.com` (`/u/reso_z2sss43gck`) and
  `notification.viewer@example.com` (`/u/reso_nfgngix5xn`): no published posts,
  no selections, and the viewer follows the author. Account deletion is not
  reachable, so they remain as recorded disposable fixtures; see
  [notifications verification](NOTIFICATIONS_EVIDENCE.md). The earlier
  `acceptanceauthor`/`acceptanceviewer` fixtures no longer exist on this
  deployment.
