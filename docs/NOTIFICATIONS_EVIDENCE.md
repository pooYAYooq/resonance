# Notifications verification

Curated results for engagement notifications: the `/notifications` list,
the Navbar drawer on desktop and mobile, and focused comment destinations.
Scope and completion live in [ROADMAP.md](../ROADMAP.md);
current constraints are in [known limitations](KNOWN_LIMITATIONS.md). The
requirement source is 3A.4 in [PHASE_3A.md](PHASE_3A.md).

## Current revision summary

This revision includes the [review repairs](#review-regression-checks) following
verification of `aadb9c1` on `feat/engagement-notifications`.
The authoritative behavior is in [Features](../FEATURES.md#notifications), with
the scope amendment in [the decision log](PHASE_3A_DECISIONS.md#engagement-notification-amendment-2026-10-26).
The latest affected verification is recorded in the review section below;
the retention section and earlier runs retain their tested revisions and outcomes.
Manual acceptance is recorded separately in [maintainer phone acceptance](#maintainer-phone-acceptance).

Current behavior supersedes the early iterations recorded below: publication
fan-out has been replaced by direct engagement events; both layouts use unread
dots; mobile rows include covers and two-line excerpts; the toolbar uses one
expansion toggle that leaves read state unchanged; and Mark all as read is in
the overflow menu at every width. Notification destinations use ordinary
routing and server-loaded focused conversations. Frozen source copies,
full-screen loading layers, animated anchor scrolling, and repeated landing
highlights are no longer part of notification-link navigation.

A source/documentation comparison on 2026-10-26 identified that the empty list
still shows the toolbar. The maintainer confirmed this is acceptable, so it is
closed as a product concern. The initial browser check below found no
notification rows on the preview account. The later maintainer phone acceptance
closes the populated-row, physical-device, and phone-publishing checks without
changing the scope or results of the earlier automated and browser runs.
The later review repairs have their own verification and affected retest scope.

### Maintainer phone acceptance

On 2026-10-26, the maintainer reported that all three outstanding acceptance
checks passed on a physical phone for the implementation at `aadb9c1`:

- Populated notification rows and actions, including covers and excerpts.
- Normal drawer exit animation and focus handoff.
- Publishing from the phone's HTTP LAN preview after the request-ID repair.

These are maintainer-reported results, not a new agent-driven browser run.
The phone model and browser were not specified, so this evidence does not
establish a named browser/device matrix or screen-reader acceptance. Retest
affected checks after changes to notification rows/actions, drawer lifecycle
or focus handling, and HTTP preview authentication or publishing request IDs.

### Review regression checks

The working revision based on `aadb9c1` addresses the four findings in
[PR #120's Codex review](https://github.com/pooYAYooq/resonance/pull/120#pullrequestreview-5644536780).
All four were confirmed against the implementation before fixes:

- Truncated counts could hide a nonempty read/unread deletion scope. Both
  zero-sample cases failed before keeping all scopes available when truncated.
- Readable storage with failed writes returned stale expansion state. Expansion
  and collapse regressions failed before failed writes used the per-key memory
  fallback; successful persistence resumes reading storage normally.
- The global toast's Undo was outside the modal drawer. A real-Sheet component
  regression failed before an in-drawer recovery row offered the same Undo
  callback. Coverage also checks remounting, one commit on expiry, cancellation
  after Undo, and removal of Undo while server deletion is still pending.
- Focus restoration selected controls in hidden responsive layouts. Four cases
  failed before visibility filtering: deleting the first/last item, appending
  pagination, and settling pagination without another visible item.

An independent review found that remount autofocus preceded the hook's focus
listener. Two additional regressions reproduced lost focus after keyboard Undo
and after expiry on reopening. The hook now seeds tracking from the control
already focused inside its root. Both component and browser retests passed.
The subsequent independent recheck could not run because its provider hit a
usage limit; no clean follow-up review verdict is claimed.

The completed Codex-repair snapshot fingerprint is
`b966a1ddb18c1750e6672a2a73fd8ee31826622c3fbb1506e254f9b4868b969b`
(SHA-256 over sorted path/content pairs, each NUL-delimited, for the four
changed source files and their four regression-test files).
The initial repair snapshot used the same paths and hashing method:
`f6bc8ba954a13c841cefdb81888bf9f3669f1cf3b4b47ffbc6ab10ce0617c57f`.

- The full component run passed 104 files and 1,049 tests on the initial
  repairs. After the final remount-focus change, all 125 affected tests across
  seven files passed, including every shared-hook list consumer. Unchanged
  results were reused under the PR checklist rather than claiming another full
  run of the final revision.
- Final `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build` passed. The
  unchanged backend retains its earlier 54-file, 897-test result. No backend,
  schema, dependency, or deployment changes were needed.
- Changed-file Prettier, 75 local file/heading links, diff whitespace, and the
  artifact index check passed.

On 2026-10-26, a temporary browser fixture mounted the actual NotificationBell,
NotificationsList, rows, shared focus/expansion modules, Radix Sheet, Sonner,
and application CSS. Only auth/query/mutation and Next routing boundaries were
controlled; it did not create or change Convex data. The fixture and raw output
lived outside Git, and existing Next/Convex dev servers were preserved.

- At 1280px, keyboard deletion on the full list restored focus to the next
  visible desktop control. Inside the open drawer, deletion focused its own
  Undo button; Enter restored the row without closing the drawer or issuing a
  server deletion. Letting a second deletion expire issued exactly one deletion,
  removed Undo, and returned focus to a surviving row.
- At 375px, keyboard activation through the mobile row menu focused Undo inside
  the drawer. Enter restored both rows without a deletion; document width and
  scroll width remained 375px.
- Reopening during the Undo window preserved keyboard Undo focus. Enter then
  restored focus to the restored row at 1280px. Expiry after reopening focused
  a surviving row at 1280px and the Discover recovery link for an emptied list
  at 375px. Each expired row issued one deletion, and the drawer stayed open.
- With storage reads succeeding and writes throwing QuotaExceededError,
  Expand all opened both rows and Collapse all closed both rows.
- With a truncated sample of 1,000 unread and zero read rows, the dialog offered
  All, Read only (`0+`), and Unread only without invoking deletion.

These browser results validate real UI behavior with controlled data, not a
new authenticated app or physical-phone pass. The original phone publishing
and drawer-exit acceptance remains recorded above. The new in-drawer deletion
and Undo row still needs the targeted physical-phone retest recorded in
[known limitations](KNOWN_LIMITATIONS.md#notifications).

A read-only inspection of deployment `woozy-spaniel-283` on 2026-10-26 found
32 notification rows. All carry `type` and `dedupeKey`; 9 omit the optional
`postId`. No pre-engagement rows remain, so the required legacy fields do not
block the current deployment. A reused deployment that still holds those rows
must clear or migrate them first, as recorded in
[known limitations](KNOWN_LIMITATIONS.md#engineering-and-verification).

### CodeRabbit review follow-up

CodeRabbit's review at `3f9ad79` raised one bulk-deletion feedback gap, one
roadmap status mismatch, one stale architecture ownership description, and one
conditional legacy-row schema risk. The bulk action now shows an error toast
with a regression; the roadmap marks V1-18 In progress; the architecture
inventory, Pattern C diagram, and rationale assign the reply form to
CommentComposer; and the schema stays strict with the legacy-row rollout
requirement documented. The counts-query nitpick was deferred because moving
the query into the dialog changes the trigger and loading design. The docstring
coverage threshold and ESLint timeout were CodeRabbit tooling results, not code
findings.

Final verification at `6dac7c7` passed `pnpm lint`,
`pnpm exec tsc --noEmit`, `pnpm test:ci` (54 files, 897 tests),
`pnpm test:component --maxWorkers=1` (104 files, 1,051 tests), `pnpm build`,
`pnpm format:check`, and `pnpm check:artifacts`. The full component suite was
rerun after the code fix; the docs commits changed no runtime behavior.

### Drawer visual check

Checked on 2026-10-26 in the T3 preview, signed in as Phone Preview. At 1280px
and 375 × 812, the notifications page and drawer both displayed the agreed
empty state. The mobile navbar showed the bell beside the navigation menu. On
the 375px Discover page, a pointer click on the visible bell opened the drawer
without changing the URL, 1,400px reading position, or page width. Closing it
restored focus to the bell and returned to the same URL and scroll position;
`scrollWidth` and `clientWidth` both remained 375px. No console errors appeared
in the mobile checks.

This account had no notification rows during this pass, so it could not inspect
cover/excerpt layout, row actions, or a notification destination. It also does
not establish visual acceptance of the drawer exit animation or a physical
phone. The subsequent [maintainer phone acceptance](#maintainer-phone-acceptance)
closes those gaps separately.

Documentation validation passed repository-wide `pnpm format:check`, local
file/heading-link checks, `git diff --check`, and `pnpm check:artifacts`. The old
repository-formatting limitation is resolved for this working revision; earlier
failure records remain historical. The current runtime and build results follow
in the retention section. The dev servers remained running and dashboard
deployment settings were left unchanged.

## Notification retention

Verified on 2026-10-26 in the uncommitted `feat/engagement-notifications`
worktree based on `f4e48fb`, targeting personal development deployment
`woozy-spaniel-283`. The authoritative policy is in
[Features](../FEATURES.md#notification-retention); decision 3A-034 supersedes
only the retention deferral in 3A-033.

- The new fixed-time suite first failed against the previous implementation:
  read history within the approved window was removed, unread expiry was
  absent, and continuation boundaries were not stable. These are historical
  failures; the implementation now passes all 10 retention cases and all 29
  existing notification tests (39 focused tests total).
- Coverage includes strict cutoff boundaries, first-read clock preservation,
  independent recipient counters, bounded scheduled continuations, and a
  clock advance between batches. A candidate read or manually deleted between
  batches is not decremented twice; a new arrival retains its badge count.
  Invalid counters roll back the complete batch, zero counters stay nonnegative,
  and missing profiles do not prevent orphan cleanup. All four notification
  types expire without deleting source content or relationships.
- Final verification after the review adjustments passed: `pnpm lint`,
  `pnpm exec tsc --noEmit`, `pnpm test:ci` (54 files, 897 tests),
  `pnpm test:component --maxWorkers=1` (102 files, 1,037 tests), and `pnpm build`.
  `pnpm exec convex codegen --typecheck enable` also completed successfully.
  The default parallel component run first hit two authoring-test failures
  (one timeout and one extra typed character); the documented single-worker
  rerun passed, consistent with the existing worker-contention limitation.
  Expected diagnostics from intentionally failed authoring paths and jsdom
  navigation did not fail the successful suites.
- Read-only deployment queries confirmed both indexes are queryable. The first
  probe caught `by_readAt_and_createdAt` still backfilling; a subsequent probe
  succeeded, resolving that temporary deployment state. Function metadata
  confirms both cleanup functions are internal, including their optional
  `cutoffAt` continuation argument.
- A bounded, read-only system-query subscription confirmed both daily cron
  registrations, each with an 86,400-second interval and a pending next run.
  The new unread job's first execution succeeded with zero deletions. The
  existing read job also has a successful prior run; that older execution is
  not evidence for the newly extended read window, which is covered by tests.
- No UI changes, document-field backfill, manual cleanup sweep, Git actions,
  or server restarts were performed. Scheduler execution at future daily
  intervals was verified through registration metadata, not by waiting a day.

## Notification toolbar and follow-back iteration

Historical initial iteration; the current toolbar and icon treatments are
described in [Features](../FEATURES.md#notifications).

Executed 2026-10-22 on the uncommitted `feat/engagement-notifications` working
revision based on `f4e48fb`. Typecheck and focused ESLint passed. In the T3
preview, Expand all changed all three loaded expandable rows to expanded;
Collapse all changed them back to collapsed. The overflow menu exposed Delete
all without invoking deletion. The preview account had no follow notifications,
so the new Follow back action still needs a browser check on a follow row.
No full test suite was run for this UI iteration.

## Follow notification rate limit

Executed 2026-10-21 on the uncommitted `feat/engagement-notifications` working
revision based on `f4e48fb`, targeting personal dev `woozy-spaniel-283`.
The delivery rule is recorded in [Features](../FEATURES.md#notifications).

- `pnpm exec vitest run convex/notificationEvents.test.ts convex/follows.test.ts --maxWorkers=1`:
  passed both files, 21 tests. Coverage includes the exact seven-day boundary,
  suppressed attempts not extending the window, preservation of earlier read
  history, unread counter updates, per-pair isolation, notification deletion,
  and initialization from a previously delivered follow notification.
- `pnpm exec tsc --noEmit` and focused ESLint passed. The dev backend compiled
  and synchronized successfully after the change.
- Created disposable Better Auth account **Follower Two** through the app's
  lifecycle adapter. Added its first follow toward `pooyayooq`, including
  follow counts, growth analytics, feed backfill, and the normal notification
  writer. Confirmed one new unread follow notification for that pair.
  The temporary internal fixture helper was removed afterward; the account
  and its follow remain intentionally for the maintainer's UI check.
- The new notification was not marked read during fixture verification.
  Testing its New badge is left to the maintainer. This focused pass does not
  establish that the complete engagement-notification feature passes CI.

Retest when notification delivery, rate-limiter configuration, follow
transaction behavior, or notification deletion changes.

## Earlier compact-notification verification

The following results describe the earlier tested revision, not the current
engagement-notification working tree.

### Tested revision and environment

- Code revision: `feat/compact-actionable-notifications`, uncommitted working
  tree on base `26e30a6`, after the three review rounds and the bell badge
  anchoring fix.
- Backend functions on the personal dev deployment `woozy-spaniel-283`.
- Windows Chrome driven through the attached Playwright session against a
  local `pnpm dev` server at `http://localhost:3000`.
- Viewports 1280x720 and 375x900; light and dark themes.
- Executed 2026-10-19.

### Fixtures and cleanup

- Two disposable accounts created through the real sign-up:
  `notification.author@example.com` (Notification Author, `/u/reso_z2sss43gck`)
  and `notification.viewer@example.com` (Notification Viewer,
  `/u/reso_nfgngix5xn`). The viewer follows the author.
- Posts were published through the real authoring flow (cover upload, Review,
  Publish) and deleted through the published list's named confirmation; after
  cleanup the author has no published posts and the viewer's list is empty with
  a zero badge.
- The previously recorded `acceptanceauthor`/`acceptanceviewer` fixtures no
  longer exist on this deployment; `/u/acceptanceauthor` renders the shared 404.
- Account deletion is not reachable, so the two new fixture accounts remain on
  the dev deployment, recorded in [known limitations](KNOWN_LIMITATIONS.md).

### Results

| Journey           | Surface                              | Result | Observation                                                                                                       |
| ----------------- | ------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------- |
| Empty recovery    | `/notifications`, no notifications   | Pass   | "No notifications yet" with a Discover action that opens `/blog`; no Mark all read action; badge 0                |
| Unread state      | bell and list after two publications | Pass   | Bell `Notifications, 2 unread`; both rows show the New marker                                                     |
| Per-row read      | post link open, then Back            | Pass   | Post loaded; bell dropped to 1 unread; the opened row lost its marker while the other kept New                    |
| Mark all read     | list action                          | Pass   | Badge dropped to 0, both markers cleared, the action disappeared                                                  |
| Dark and compact  | 1280x720 dark; 375x900 dark          | Pass   | New marker visible in dark; no horizontal overflow at 375 (scrollWidth 375)                                       |
| Deletion cascade  | author deletes all posts             | Pass   | Viewer list returned to the empty state with a zero badge                                                         |
| Bell badge anchor | desktop navbar                       | Pass   | Fixed during this pass; badge sits within the bell button with computed `position: relative`                      |
| Mobile navigation | 375 drawer                           | Pass   | Account section shows the Notifications link; the positive count render is component-tested, not browser-captured |

**Journey detail**

- Unread and per-row read: with the viewer following the author, publishing
  fixture post two and post three produced two notifications. The list rendered
  two rows with New markers and the bell read `Notifications, 2 unread`.
  Activating post two's title opened `/blog/j978nzdpwvxdzx90e72yd9746h8gj8z0`;
  returning showed the bell at 1 unread, post two read and post three still
  New. Mark all read then cleared the badge, both markers, and the action.
- All five verification posts were deleted through the published list's named
  confirmation; the viewer's list returned to the empty state each time, and
  the notification rows were removed by the bounded deletion cascade.
- Bell badge anchoring: before the fix the unread chip rendered at the page's
  top-right corner because the bell button was not a positioned ancestor. With
  `relative` on the button, measured at 1280x720 light: button x 1128..1164,
  y 20..56; badge x 1147..1167, y 17..37; computed position `relative`.
- Compact width: at 375x900 the populated list had one New marker and no
  horizontal overflow (`document.documentElement.scrollWidth === 375`); the
  empty state at 375 likewise had no overflow.
- Theme: populated and empty states were checked in light and dark; the
  pre-existing theme preference was cleared after the pass.

### Automated coverage

On this revision: `pnpm lint` and `pnpm exec tsc --noEmit` are clean; the
edge-runtime suite passes 51 files / 856 tests (the backend is unchanged since
that run); the component suite passes 95 files / 974 tests with
`--maxWorkers=1`; `pnpm build` succeeds. The notifications Convex tests cover
`applyMarkRead` and `applyReadBatch` (transition accounting, watermark
reconciliation, the bulk-read/new-arrival race, idempotence, ownership) plus
the existing fan-out and mark-read batch paths. The component tests cover the
auth gate, the unread marker, primary and middle-click marking, non-opening and
actor-link non-marking, Mark all read visibility/pending/focus return,
pagination focus restoration, the Discover recovery focus, and the mobile
positive unread count.

### Notes and limitations

- The populated-list screenshots were captured before the bell badge anchoring
  fix; the navbar chip in those images shows the pre-fix corner position. The
  list behavior itself is unchanged by that fix.
- The mobile drawer's numeric unread text was not captured with a positive
  count in this browser pass; a `MobileNavMenu` component test covers the
  positive count render (`3 unread`).
- Raw screenshots and command output are local artifacts, not repository
  content.

### Retest triggers

- Re-run the browser journeys after changes to the read mutations, the
  notifications list or row, the empty state, the bell, or the mobile unread
  count.
- Re-measure the 375px overflow after layout or spacing changes.
- Recreate disposable fixtures for destructive checks and record their cleanup.

## Notification drawer initial version

Historical initial iteration. Its hash destinations and desktop toolbar
placement have been superseded; see the current revision summary above.

Verified on 2026-10-22 in the uncommitted `feat/engagement-notifications`
worktree based on `f4e48fb`:

- Nine focused NotificationBell component tests passed, including auth gating,
  opening without navigation, Escape dismissal/focus return, destination-link
  dismissal, and unread count updates without opening the drawer.
- TypeScript and focused ESLint passed; `git diff --check` passed.
- T3 browser on Author One’s post: opening and Escape-closing preserved the URL
  and scroll position at 450px, restored focus to the bell, and left the unread
  count unchanged. Used a coordinate click on the visible sticky bell because
  the preview locator-click operation scrolled the page before pointerdown.
- Clicking the comment action closed the drawer, navigated to the exact comment
  hash, and focused that comment with its top approximately 96px below the
  viewport top. Body scrolling was unlocked afterward.
- Mobile viewport checks at 375 × 667 and 412 × 915 verified drawer sizing,
  independent content scrolling, reading-position preservation, and exact
  comment navigation. These desktop-browser checks do not cover touch input
  or mobile Safari.
- The initial mobile pass missed the toolbar wrapping onto two lines. After
  the maintainer reported it, Mark all as read moved into the overflow menu
  below 640px. Rechecked at 375px: all toolbar controls share one 32px line,
  the menu contains Mark all as read and Delete all, and there is no horizontal
  overflow. At desktop width Mark all as read remains directly visible.
- Full regression suites remain deferred during this UI iteration.

## Mobile notification rows initial version

Historical initial iteration. The current rows restore covers and use the
stacked layout described in [Features](../FEATURES.md#notifications).

Checked on 2026-10-22 in the uncommitted notification worktree:

- Below 640px rows show details directly, omit cover images and expansion
  controls, and provide one actor-name link plus one event link for post and
  comment events. Follow actions stay visible; deletion is in a row menu.
- T3 browser at 320px and 375px reported no horizontal overflow. At 375px,
  post/comment rows had two visible links and no visible expansion trigger.
  The unread follow menu exposed Mark as read and Delete notification.
- At 412px, opening a comment event link closed the drawer and navigated to
  the exact comment hash. No follow or delete mutation was exercised.
- TypeScript and focused lint passed during implementation. Full regression
  suites remain deferred while the maintainer evaluates this mobile design.
  Touch input and mobile Safari remain unverified.

## Phone Preview fixture account

The development-only `phone@resonance.test` account owns three published posts
with covers, including a long title. Normal authenticated APIs generated 20
incoming comments, 12 post likes, four follows, three owner comments, and 12
likes on those owner comments. The final notification-count query returned
48 unread notifications, zero read, and `truncated: false`. Test actors include
both short and long display names. Later manual testing may change read state.

The Wi-Fi HTTP preview exposed an authoring issue: `crypto.randomUUID` is
undefined in that non-secure browser context, while `crypto.getRandomValues`
is available. Publishing request IDs now use 128 random bits encoded as hex;
the existing server contract requires a nonempty unique string, not UUID
syntax. The subsequent [maintainer phone acceptance](#maintainer-phone-acceptance)
records the successful phone UI publishing retest.

## Notification destinations from the editor

Checked on 2026-10-23 in the uncommitted notification worktree. The earlier
review overstated the guard bypass: generic document click capture already
protected ordinary drawer clicks, but its plain router continuation discarded
notification destination handling. NotificationLink now explicitly requests
the existing exit policy with a continuation that starts only after approval.

- 55 focused tests across AuthoringExitProvider, NotificationBell, and navigation
  passed. The provider coverage opens the real drawer with fixture links and
  verifies published-edit Cancel/Leave, recovery before navigation, failed
  recovery cancellation, uncertain-save blocking, successful Save & leave,
  and navigation without an editor registration. Existing jsdom warnings about
  navigation to another Document remain in older ordinary-link tests.
- TypeScript, focused ESLint, formatting, and diff whitespace checks passed.
- In T3 at 375 × 812, edited only the title of a Phone Preview fixture's
  published post without saving. Opening the drawer left the editor intact;
  selecting Sam's comment-like destination opened the exit confirmation with
  no loading layer. Cancel preserved the temporary title and editor URL.
  Retrying and choosing Leave landed at the exact comment's like button with
  the drawer, loading layer, and scroll lock removed. No post update was saved.
- Loading-screen design and the remaining notification review items are separate
  follow-up work; this check does not establish full-suite completion.

## Direct notification destinations

### Mobile unread indicator

Checked on 2026-10-24 in the uncommitted notification worktree. Mobile rows
replace the New pill with a 6px dot beside the timestamp. Its 16px slot stays
mounted; read state hides the dot and removes its accessible “Unread” label.
At that check, desktop retained the badge; the desktop follow-up below supersedes
that behavior.

At 320px, 360px, and 390px, Chromium geometry checks compared the row, links,
timestamp, action buttons, and indicator slot before and after toggling the
dot's visibility. Every rectangle was unchanged and no horizontal overflow
occurred. This isolates the CSS transition without changing fixture read state.
Component tests separately exercise the actual unread-to-read prop transition,
including accessible state and retention of the indicator element. The focused
row/list run passed all 50 tests; the complete component suite passed all
1032 tests across 102 files. Lint, standalone TypeScript, changed-file formatting,
and `git diff --check` also passed.

### Desktop unread indicator

Checked on 2026-10-25 in the uncommitted notification worktree. Desktop rows
now use the same 6px unread dot beside the timestamp, with a permanent 16px
slot that stays mounted when read. The desktop follow row retains its keyboard
and pointer Mark as read action on the dot; after reading, that button is
disabled, visually hidden, and removed from the accessibility tree. Other
notification types retain their row expansion behavior.

Regression tests cover unread-to-read accessibility and element retention for
follow, comment, comment-like, and post-like rows, plus keyboard activation of
the follow row's dot. The complete component suite passed all 1037 tests
across 102 files before the final CSS alignment adjustment; the focused row/list
run passed all 55 tests again after it.

Both layouts use a 1.5px downward optical offset for the dot after maintainer
feedback that the earlier 0.5px position still looked high. The reserved slot
is unchanged. Desktop actor names now truncate individually (up to 15rem,
shrinking further when space is limited), while the event text remains intact.
The timestamp follows the event directly instead of being pushed to the row's
right edge. The dot retains its non-shrinking slot. The full actor name remains
in the link's accessible name.

Browser checks at 640px, 768px, and 1280px reproduce the earlier clipped-dot
failure with an extra-long name and pass with individual name truncation.
A short-name check confirms the timestamp follows the event with only the
separator and its spacing between them. The latest focused row/list run
passed all 55 tests; lint passed. Before this CSS-only refinement, the complete
component suite passed all 1037 tests across 102 files and TypeScript passed.

Chromium geometry checks passed at 640px, 768px, and 1280px, for both collapsed
and expanded rows. Hiding the indicator did not change row, link, timestamp,
action-button, or slot rectangles. Saved expansion was reset before checking
each width; an initial harness attempt stalled on an already-expanded list.
These checks isolate CSS visibility without asserting live read-mutation timing.
Lint, standalone TypeScript, changed-file formatting, and `git diff --check`
passed.

### Focused comment destinations

Checked on 2026-10-23 in the uncommitted `feat/engagement-notifications`
worktree, based on `f4e48fb2cc16c6f1e4bafbf172e812e0c294dd08`.
Implementation fingerprint (SHA-256 over the sorted path and content pairs for
comments query, notification navigation/row/bell, conversation page/error, and
shared comment components): `dc8e8a00009e601cad046321b6970803f13240562ca8fc0ac983a19299d51336`.

[Features](../FEATURES.md#notifications) owns destination behavior. This change
replaces both loading experiments below. Comment destinations include the
selected comment in their initial server render, using a direct ID lookup with
bounded nearby reads. All notification row links use normal Next
navigation with a delayed, small status indicator. No row generates an article
hash destination or a full-screen loading surface.

Browser results against localhost:3000 and dev `woozy-spaniel-283`:

| Layout                 | Entry points                              | Link kinds                                                           | Result                                                                                |
| ---------------------- | ----------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1280px                 | Navbar drawer and full notifications page | Actor, avatar, comment action, excerpt, article title, cover         | Pass                                                                                  |
| 390px                  | Navbar drawer and full notifications page | Actor, avatar, comment action, excerpt, combined article title/cover | Pass                                                                                  |
| Expanded inbox         | Full notifications page                   | Additional article-event link                                        | Pass                                                                                  |
| Delayed request, 390px | Navbar drawer                             | Profile navigation held until explicitly released                    | Source retained; only small status displayed; final scroll 0; Back returned to source |

DOM samples after destination commit stayed at scroll 0; the selected comment
started at y=230px desktop and y=270px mobile. Checks also required the drawer,
Radix scroll lock, and status indicator to be removed, no old loading overlay,
and no hash. The main 20-case run and six affected mobile retests had zero page
errors. Tests used an existing disposable fixture account; row expansion and
activation can change that account's read state. No fixture content was created.

The browser pass caught and fixed same-post links retaining source scroll, an
auth-resolution hydration mismatch in the reply form, and different article
cover destinations between mobile and desktop. Regression tests cover those
cases, every row type's link destinations, authoring guard continuations, native
modifier behavior, reply submission, server-to-live deletion, malformed IDs,
post visibility, wrong-post targets, old targets, and viewer-specific likes.
The development Convex sync succeeded with no schema change.

Final repository verification passed: lint, standalone TypeScript, 887
backend/unit tests across 53 files, 1019 component tests across 102 files, and
the production build including the new dynamic conversation route. Artifact
index validation and `git diff --check` passed. The package-script binaries were
invoked through `node` because the local pnpm shim attempted a package-manager
bootstrap in a read-only cache. No dependency changes were needed.

Follow-up on 2026-10-24: selected comments receive focus with
`preventScroll` after the notification drawer disappears. Missing comments
focus the selected-comment heading; unavailable posts focus their heading.
Pointer or keyboard interaction cancels the pending handoff; a one-second
timeout abandons it if the drawer remains mounted. Unrelated scroll locks do
not determine readiness. The bell's navigation autofocus guard remains intact.

Notification links disable viewport prefetch. Mouse pointer entry and
keyboard-visible focus prefetch once per href per mounted link; touch entry,
pointer-induced focus, and clicks do not trigger prefetch. Explicit
`prefetch={false}` disables intent prefetch too. Caller handlers, native
modifier clicks, and authoring departure guards are retained.

Anonymous query coverage is named “returns the public conversation and bounded
nearby comments without an identity” in `convex/commentDestination.test.ts`.
“renders a public conversation for a logged-out reader” in
`CommentDestination.test.tsx` covers client rendering. A fresh anonymous
Chromium visit at 1280px and 390px also passed: selected-comment focus, scroll
zero, no page errors. This browser check exercises the server authentication
wrapper that the query/component tests do not cover. Keyboard activation from
the drawer passed with animations disabled in the harness: selected-comment
focus, scroll zero, drawer removed, and scroll lock released. The normal-animation
attempt retained the drawer and lock and correctly abandoned focus; it does not
pass normal-browser acceptance.

Follow-up automated verification: lint, standalone TypeScript, all 887
backend/unit tests, and all 1031 component tests passed. The component run used
four workers; an earlier resource-contended run timed out in editor tests and
exposed two router mocks missing `prefetch`. Those mocks were updated and the
complete suite rerun successfully. Independent review found no actionable
issues in the focus or prefetch changes. The production build, repository-wide
format check, artifact index check, and `git diff --check` also passed.

Visual acceptance was left open by this pass: the installed headless Chromium rendering clock
stalled at zero even for a standalone CSS animation. Pointer actions bypassed
stability waits and drawer CSS animations were disabled only in the harness.
These are DOM/navigation checks, not proof of painted animation frames. The
subsequent [maintainer phone acceptance](#maintainer-phone-acceptance) closes
normal drawer motion and focus acceptance on a real device. Firefox, Safari,
and a real screen-reader session remain outside this earlier pass. Retest after
changes to row links, routing, auth hydration, drawer lifecycle, or comment data.

### Earlier loading-state trial (superseded)

Checked on 2026-10-23 in the uncommitted notification worktree. The frozen
DOM copy, root overflow override, and manual body compensation are removed.
This superseded iteration used a loading surface to cover drawer teardown and target loading. Navigation
waits for the drawer element and Radix scroll-lock attribute to disappear;
reveal waits for the URL to commit and the target to exist. Same-post targets
notify CommentSection explicitly so pagination does not depend on a native
hashchange event. The reveal remains 100ms, with reduced-motion support.

- 23 focused tests across navigation, CommentSection, and NotificationBell
  passed. Navigation coverage includes delayed target insertion, independent
  drawer/lock removal, same-post URL commit, Back cancellation, focus, and
  reduced motion. Focused ESLint passed.
- T3 pointer-click check at 1280 × 800 from the classic-cars fixture to Sam's
  comment-like destination recorded no drawer or lock at reveal, one body DOM,
  exact target positioning, one 100ms fade, and cleanup of the loading surface.
- Visual acceptance, a live comment beyond the first pagination batch,
  Firefox/native scrollbar checks, and device retests remain pending.

### Earlier frozen-source iteration (superseded)

The evidence below describes the earlier frozen-source implementation.
Both earlier iterations are superseded by focused comment
destinations and direct navigation for every row link.

Checked on 2026-10-23 in the uncommitted notification worktree. This replaces
previous iterations that animated scrolling and repeated landing highlights.
Notification links now retain a noninteractive visual copy of the source until
the destination exists and is positioned, then remove it with one 100ms fade.
No scroll animation or comment/like flash sequence runs. Reduced motion skips
the fade; Back cancels an in-flight transition. An abandoned request releases
the source copy after a 10-second recovery timeout, not a deliberate delay.

- Eleven focused tests across navigation and CommentSection passed. Coverage
  includes waiting for a delayed exact comment, instant positioning, a single
  100ms reveal, post/comment-like focus, plain post/actor targets, and reduced
  motion. TypeScript and focused ESLint passed.
- In the T3 browser, native DOM activation of notification links at desktop
  and 375px landed on the exact comment. Instrumentation recorded one instant
  scroll while covered and one 100ms overlay animation; the comment received
  focus and no landing-highlight animations ran. The mobile full notifications
  page produced the same one-fade result; an actor link landed at profile top
  with one 100ms fade.
- Follow-up Playwright pointer-click testing reproduced a full document load:
  the drawer's capture-phase close removed its link before client navigation.
  Closing in the bubble phase fixes that event ordering. Retests at desktop and
  375px retained the same document, positioned the comment while covered, and
  ran one 100ms reveal. Both comment and comment-like destinations were checked.
  The earlier DOM-activation checks alone did not expose this regression.
- On desktop at 1280 × 900, expanding and scrolling the drawer before opening
  Sam's post title reproduced two simultaneous scroll areas during the fade:
  the frozen drawer copy retained its own scroll position while the destination
  page became scrollable. That iteration kept the destination root `overflow: hidden`
  until the copy is removed, then its previous inline overflow is restored. A
  browser retest with the drawer scrolled to 600px showed the root locked during
  the fade and restored after cleanup, with the destination at the exact comment.
- Device testing and broader regression suites remain pending. Route/data
  loading time remains real; the transition duration does not promise that
  network responses arrive within 100ms.

## Mobile navbar notification placement

Checked on 2026-10-23 in the uncommitted notification worktree. At 767px,
the visible notification bell precedes the hamburger (measured left edges
663px and 707px). Clicking the bell opens the notification drawer without
changing the Discover URL. At 768px, the bell remains visible and the hamburger
is hidden. The bell retains its existing unread badge. Focused ESLint passed.
