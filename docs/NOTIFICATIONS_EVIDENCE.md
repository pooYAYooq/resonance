# Notifications verification

Curated results for the compact, actionable notifications surface: the
`/notifications` list, the desktop `NotificationBell`, and the mobile
navigation link. Scope and completion live in [ROADMAP.md](../ROADMAP.md);
current constraints are in [known limitations](KNOWN_LIMITATIONS.md). The
requirement source is 3A.4 in [PHASE_3A.md](PHASE_3A.md).

## Tested revision and environment

- Code revision: `feat/compact-actionable-notifications`, uncommitted working
  tree on base `26e30a6`, after the three review rounds and the bell badge
  anchoring fix.
- Backend functions on the personal dev deployment `woozy-spaniel-283`.
- Windows Chrome driven through the attached Playwright session against a
  local `pnpm dev` server at `http://localhost:3000`.
- Viewports 1280x720 and 375x900; light and dark themes.
- Executed 2026-10-19.

## Fixtures and cleanup

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

## Results

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

## Automated coverage

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

## Notes and limitations

- The populated-list screenshots were captured before the bell badge anchoring
  fix; the navbar chip in those images shows the pre-fix corner position. The
  list behavior itself is unchanged by that fix.
- The mobile drawer's numeric unread text was not captured with a positive
  count in this browser pass; a `MobileNavMenu` component test covers the
  positive count render (`3 unread`).
- Raw screenshots and command output are local artifacts, not repository
  content.

## Retest triggers

- Re-run the browser journeys after changes to the read mutations, the
  notifications list or row, the empty state, the bell, or the mobile unread
  count.
- Re-measure the 375px overflow after layout or spacing changes.
- Recreate disposable fixtures for destructive checks and record their cleanup.
