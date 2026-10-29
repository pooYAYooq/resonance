# Author page verification

Curated results for the public author page and its post catalogue: the approved
author canvas at `/u/<username>` and the paged catalogue at
`/u/<username>/posts`. This is the final V1-17 delivery. The profile foundation,
editor, username ownership, address, and signup boundaries are recorded
separately in [username evidence](USERNAMES_EVIDENCE.md),
[username address evidence](USERNAMES_ADDRESSES_EVIDENCE.md),
[username signup evidence](USERNAMES_SIGNUP_EVIDENCE.md), and the
`J6-ProfileEditor` rows in [accessibility evidence](ACCESSIBILITY.md).

Scope and completion live in [ROADMAP.md](../ROADMAP.md); current constraints are
in [known limitations](KNOWN_LIMITATIONS.md). Keyboard, focus, status, and
responsive-width checks are recorded as the `J7` rows in
[accessibility evidence](ACCESSIBILITY.md); raw command output and browser notes
were local and uncommitted.

> **Copy note (2026-10-29):** the current profile and catalogue use
> "Selected articles" and "View all posts". The observations below retain the
> copy tested at the recorded revision; current behavior and the renamed copy
> are recorded in
> [accessibility evidence](ACCESSIBILITY.md#author-gallery-cards-2026-10-29).

## Tested revision and environment

- Code revision: `feat/public-author-showcase`, commits `d856b5b` (render the
  approved author page canvas) and `08e0852` (add the public author catalogue),
  on base `dcf5883`.
- Backend functions on the personal dev deployment `dev:woozy-spaniel-283`.
- Windows-side managed Chrome driven through the Playwright CLI against a local
  `pnpm dev` server at `http://localhost:3000`. An attached `resonance` session
  served the maintainer's own read-only views; the fixture accounts ran in
  managed sessions.
- Executed 2026-10-18 and 2026-10-19.
- The app is undeployed; there is no production or CDN surface to measure.

## Fixtures and cleanup

- Two disposable accounts created through the real sign-up: `acceptanceauthor`
  (an introduction of 585 characters with paragraphs, country Denmark, and
  Instagram plus LinkedIn canonical URLs) and `acceptanceviewer`.
- Thirteen covered published posts were written through the real authoring flow:
  a generated image assigned to the real cover input, then Review and Publish. A
  separate disposable cover-failure probe was published through the same flow to
  exercise the card image recovery.
- Cleanup deleted every pass post through the app's own management
  confirmations. A final read-only check recorded 0 posts, 0 `discoverPosts`,
  and 0 follows, likes, and comments; both fixture accounts remain with 0
  published posts and 0 selections. The maintainer's account was untouched.
- Account deletion is not reachable, so the two empty fixture accounts remain on
  the dev deployment as recorded disposable fixtures; see
  [known limitations](KNOWN_LIMITATIONS.md).

## Results

| Journey            | Surface                       | Result | Observation                                                          |
| ------------------ | ----------------------------- | ------ | -------------------------------------------------------------------- |
| Signed-out canvas  | `/u/acceptanceauthor`         | Pass   | Identity, introduction, latest three cards, clean console            |
| Missing and zero   | `/u/<missing>`, maintainer    | Pass   | Shared 404; zero-work page omits the work section                    |
| Viewer actions     | author page                   | Pass   | Edit Profile / Follow / signed-out Follow with login return          |
| Selection, reveal  | author page                   | Pass   | Nine ordered selections; 3 to 6 to 9; status and focus; then gone    |
| Catalogue          | `/u/acceptanceauthor/posts`   | Pass   | Same-tab, newest first, 12 then 13; Back and deep links; empty state |
| Live deletion      | author page, loaded catalogue | Pass   | Showcase and loaded catalogue reconcile live; fallback and omission  |
| Live identity      | author page, `/profile/edit`  | Pass   | Bio edit arrives live without a reload; revert confirmed; restored   |
| Follows and counts | author page                   | Pass   | `0` to `1` and back without a reload                                 |
| Card image failure | author page                   | Pass   | Frame kept; sibling Retry; recovery clears after unblocking          |
| Relative join date | author page                   | Pass   | See the clock sequence below                                         |
| Automated coverage | component tests               | Pass   | Pagination, deletion, focus, boundary plus Retry; suite 955/955      |

**Journey detail**

- Signed-out canvas at `/u/acceptanceauthor`: the kicker reads
  `Denmark · Joined October 2026`, the paragraph breaks in the introduction are
  preserved, three latest cards render, and the console is clean apart from the
  expected missing-author 404 request.
- Missing and zero-work: `/u/<missing>` renders the shared `User not found` 404,
  and an author with no work shows no heading, cards, catalogue link, or
  reserved space.
- Viewer actions: the owner sees Edit Profile, a signed-in non-follower sees
  Follow, and the anonymous Follow link returns to the author page after login.
- Selection and reveal: nine deliberate selections render as
  `A few of my favourites` in that order; reveal is 3 to 6 to 9 with
  `Showing 6 of 9 posts.` and `Showing 9 of 9 posts.`, focus moves to the first
  newly revealed card each time, and the control disappears at exhaustion.
- Catalogue: the same-tab All my posts link opens twelve items, one load-more
  reaches thirteen unique links newest first, Back returns to the author page, a
  direct deep link works, and both the empty catalogue and the missing-author
  recovery render.
- Live deletion, observed in a second window: an unselected delete left the
  showcase unchanged and shrank the loaded catalogue 13 to 12 with no ghost; a
  mid-list selected delete closed the gap and set `Showing 8 of 8 posts.`;
  sequential selected deletes shrank the showcase 9 to 2 to 1; the final
  selected delete fell back to `Latest posts` with three survivors and no
  reveal; deleting the last posts left the omitted work section.
- Live identity, observed in a second window: with the author page already open
  as a signed-in viewer in another managed session and no reload, the fixture
  author appended `Live identity check.` to the bio on `/profile/edit` and
  saved; the open public page showed the marker, and reverting the bio removed
  it the same way. The fixture bio was restored exactly and no residue remained.
  This is one fixture session and a signed-in viewer's view of public data; the
  underlying public identity subscription is viewer-independent.
- Follows and counts: a viewer's follow took `0 Followers · 0 Following` to
  `1 Follower · 0 Following` without a reload, and the unfollow returned it to 0.
- Card image failure: with the image request blocked the card kept its 3:2
  frame, showed `Cover unavailable` and a `Retry` control that is a sibling of
  the card link, and the link stayed usable; after unblocking, Retry remounted
  the image and cleared the recovery.
- Automated coverage: pagination states, live-deletion reconciliation, the
  empty-exhausted state, focus restoration, and the query boundary plus Retry
  are component-tested; the serial full component suite passed 955/955 at the
  code commit content.

## Relative join-date clock

The author's join-date preference was written through the real
`profiles.updateIdentity` mutation as the signed-in fixture (identity revision 1
to 2) and then restored to `calendar` (revision 3). The browser clock was
advanced with an in-page `Date.now` patch rather than Playwright's `page.clock`,
which wedged the CLI daemon settle step, so the observed refreshes ran through
the real mount, visible-tab, and `visibilitychange` paths:

- initial render: `Joined recently`;
- visible refresh: `Joined 1 day ago`;
- hidden tab with the clock advanced from 26h to 50h and a real 62-second wait:
  unchanged at `Joined 1 day ago`, showing the timer stays suppressed while
  hidden;
- visible again: `Joined 2 days ago`, the immediate catch-up.

No hydration warning was recorded during the sequence.

## Retest triggers

- Re-run the browser journeys after changes to the public identity query, the
  showcase selection bound or reveal, the catalogue pagination or query
  boundary, card image recovery, or join-date formatting.
- Re-measure responsive overflow after layout, spacing, or card changes.
- Recreate disposable fixtures for destructive deletion checks and record
  cleanup; the pass ran against a dev deployment with disposable data.
