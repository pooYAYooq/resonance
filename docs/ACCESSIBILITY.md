# Accessibility Evidence

Behavioral accessibility evidence for v1.0, recorded by the V1-16 pass. This is
not a WCAG conformance claim. Method and per-surface results live here; scope
requirements live in `ROADMAP.md`.

Notification results below are historical, revision-specific checks. The current
drawer, rows, read semantics, and focused destinations have their own
[verification record](NOTIFICATIONS_EVIDENCE.md#current-revision-summary).

## Required bar

- Keyboard traversal reaches and operates all controls; no unintended traps;
  visible focus throughout.
- Modal dialogs have accessible names, contain focus while open, and return
  focus to the trigger or a logical surviving target.
- Controls expose appropriate roles and accessible names.
- Mobile navigation and drawers remain operable at the tested narrow widths.

Target-size thresholds, zoom/reflow criteria, and layout polish are out of
scope (V1-21/V1-23). Layout that prevents required control operation is a
behavioral failure.

## Method and environment

- Chromium on the maintainer's Windows host, driven through the Windows-side
  Playwright CLI with no new repository tooling. The signed-in pass ran on
  Chrome 154 attached over the maintainer's Chrome extension (`resonance`
  session); the signed-out pass and the validation fixes ran in a
  Playwright-managed Chrome window (`reswin` session, fresh profile) after the
  extension attach proved unstable across navigations.
- Per surface: keyboard-only traversal, accessibility-tree name/role
  inspection, visible focus observation, and dialog focus behavior. Tree
  inspection is not screen-reader acceptance; no screen reader was used.
- Tiers: Standard = 375px and 1280px, light and dark. Deep = Standard plus
  320px and 768px. Additional widths are named per row.
- Chrome only. Firefox and Safari are not verified by this pass.
- Touch: programmatic touch emulation is unavailable in the attached session
  (CDP is denied and the CLI has no touch primitive), and no touch device was
  available to the maintainer. Touch operability of the drawer is recorded as
  an accepted limitation for this pass.
- Fixtures: purpose-created drafts, posts, and comments only, deleted after
  use with cleanup recorded. Pre-existing content is never modified.
  Sign-out/sign-in transitions are performed by the maintainer on request.
  Exception: the maintainer-requested demo post ("The Lost Art of Writing by
  Hand in a World of Blinking Cursors"), its cover and inline image, and the
  follow, like, and comment exchanged between the two demo accounts were
  intentionally left in place on 2026-10-10.
- Base revision: `d68b9c9` on `accessibility/behavioral-evidence` (started
  2026-10-09). Committed revisions in this branch: `a954036` (scope),
  `455501b` (validation messages and invalid state), `9e1aa09` (list focus
  restoration), `b7d9b12` (this evidence record), followed by the
  label-association fix, the completion documents, the list focus-restore
  rework, and the PR review follow-ups.
- Baseline on 2026-10-09 at `d68b9c9`: lint, 623 edge-runtime tests, 654
  component tests (single worker), and the production build passed.

## Results

### Feed and Blog cards (2026-10-30)

- Revision: Blog responsive `b3e731f`; feed responsive `3950e3f`; base
  `25a7ad0`.
- Automated: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test:ci` (908 tests),
  `pnpm test:component` (1173 tests), `pnpm build`, and `pnpm format:check`
  passed.
- Desktop visual confirmation: the maintainer confirmed the feed and Blog
  uniform rows, real avatars, dates, tags, engagement, Save/Read actions,
  excerpt-free rows, full-height covers at the horizontal breakpoint, and the
  Blog hover lift on `/blog`.
- Keyboard/component evidence: Blog Load more restores focus to the first
  appended card when the final page removes the button, keeps the in-flight
  control focusable with `aria-disabled`, and announces the current count,
  loading, and completion through a persistent polite status. Feed auto-load
  keeps the visible fallback and restores focus when an auto-load removes the
  final button.
- Footer spacing: the Blog results grid keeps bottom padding, and the Load more
  control keeps a reserved 64px slot even after the final page removes the
  button, so the footer does not jump and the last card keeps its gap. Browser
  checked at every tested width.
- Browser check: headless Chromium through local Playwright against the
  signed-out public `/blog` on the local dev server at 320, 375, 768, 1024, and
  1280 in light and dark. No horizontal overflow at any width. Card covers
  stayed horizontal: 1.78 at 320/375, 1.66 at 768, 2.21 at 1024, and 2.06 at 1280. Below `md`, cards were flat full-width list items (transparent, no ring
  or shadow, 0 radius) at 288/343px content width; at 768 the boxed row was
  720px wide. The page used the container's 16/24/32px side padding. The
  reserved Load more slot was 64px at every width. The last-card-to-footer gap
  was 128px at 320/375 and 136px at 768/1024/1280.
- Topics menu: below `xl`, the trigger is closed by default. At 768/1024 search
  and Topics shared a row (search 452/692px, Topics 256x56px, both square with
  a 0px radius); at 320 both stacked full width at 288x56px. Opening the panel
  kept the first-card top unchanged (799px at 320, 694px at 768, 738px at
  1024). The panel was 288px wide at 320 and 384px at 768/1024; at `sm` and up
  it right-aligns to the trigger, so it stayed fully inside the viewport at
  640, 768, 900, and 1024. Escape closed it and returned focus to the trigger.
  Choosing Design navigated to
  `/blog?tag=Design`, changed the trigger to "Topics: Design", and closed the
  panel. Topics were ordered Culture (5), Design (4), Photography (4); the
  selected Culture link had `text-decoration: none` and the primary color, and
  the selected All topics link used color only. At 1280 the trigger was hidden
  and the 18rem sidebar was visible. The dark panel was checked at 768.
- Search clear: on `/blog?q=design`, the clear control was visible and removed
  the query. Clicking it returned to `/blog`, emptied the input, and showed
  All posts; emptying the field by hand did the same. The control was absent
  on `/blog`, and the clear and Search controls fit inside the 240px field at 320. The native `::-webkit-search-cancel-button` is suppressed, so only the
  custom clear control is visible.
- Responsive hero: at 320/375 the hero starts at the navigation bottom with no
  top padding and is 286/246px tall, with a 36px title and the concise
  description. At 640 it is 319px tall with a 48px title; at 768 the top
  padding is 32px, the height is 331px, and the title is 60px. The desktop hero
  is unchanged at 391px with a 72px title.
- Sticky filter bar: after scrolling 1200px at 320, 375, 640, 768, and 1024, the
  search/Topics wrapper stayed at the navigation bottom (65px below 768, 57px
  at 768/1024). Its 12px top padding kept the search and Topics visible. At
  1280 the 18rem Topics sidebar stuck at 138px, directly below the search bar.
- Compact navbar: the navbar is now 65px tall on mobile and 57px on desktop,
  with a 24px logo. The 32px avatar, 36px notification/theme controls, and 44px
  mobile menu all fit inside it. The navbar keeps its 1px bottom border; the
  Blog filter tucks 1px underneath it: navbar bottom 65px, filter top 64px. The
  border draws over the filter background, so a post cover behind the seam at
  393/412/360 widths cannot show through. A 44px mobile-menu placeholder and a
  65/57px min-height keep
  the navbar from growing when auth resolves; the measured height stayed 65px
  at 320 and 57px at 768/1280 through a 1.5s load sample.
- Results anchor: choosing Design or submitting `design` navigated to
  `#blog-results` and placed the title directly below the sticky controls. At
  768/1280 the sticky bar top was 57px, the title 160px, and the first card
  229px; at 320 the values were 65px, 236px, and 305px. The hero stayed above
  the viewport. Filtered pages keep an 80px bottom cushion so the target scroll
  is reachable even with one result.
- Short landscape: at 932x430, 844x390, 667x375, and 568x320 the navbar became
  static and scrolled away, the search/Topics bar stayed pinned at 0px with a
  73px height, the title sat at 96px, and the first card at 165px. The filter
  stayed a single row at 568px, with no horizontal overflow. This leaves the
  title and a full post visible on the A71 landscape viewport.
- Topic clear: the active topic showed the circled X in the sub-`xl` trigger
  and in the `xl` sidebar. Clearing it returned to `/blog#blog-results` with the
  title and first post in the same position.
- Signed-in feed matrix: T3 preview signed in as the Phone Preview fixture,
  at 320/375/768/1024/1280 in light and dark. Five cards, no horizontal
  overflow. At 320/375 rows were flat (transparent, 0 radius, 0 ring) with 3:2
  covers 288x185 and 343x215. At 768 the card stacked (cover 408x272) with card
  chrome; at 1024 it used 50/50 (cover 316x204); at 1280 40/60 (cover 355x174).
  The workspace sidebar was hidden at 320/375 and 312px at 768+.
- Not verified: no real screen reader was used for the status regions.
- Retest when the feed/Blog card classes, pagination controls, status copy,
  Blog grid breakpoints, Topics menu behavior, or feed matrix fixture change.

**Blog search and filter review fixes (2026-10-31 Australia/Sydney, `d45255e` plus fixes)**

- The earlier search-clear check verified navigation and field value, but did
  not check retained focus or typing while navigation was pending. The
  query-dependent search key remounted the input on completion. Six new
  regressions failed before the fix and passed afterward, covering the real
  page's input identity/focus, replacement typing during clear navigation,
  external query/history synchronization, pending submit edits, and focus
  after the clear button disappears. Two further regressions failed on a
  pending-search clear found during local review, then passed when manual
  and button clearing also cancelled the pending search. The final targeted
  page/search run passed all 20 tests. Search remains mounted and distinguishes
  a local navigation acknowledgement from an external query change.
- Chromium on the signed-out local Blog confirmed the same focused input
  survives manual clearing and clear-button navigation at 375x667. Typing and
  submitting a replacement search worked; Back and Forward synchronized the
  field. The delayed-navigation typing race is component-tested, not a
  throttled browser result.
- A separate Chromium check held the submitted search request pending, then
  cleared via the button before releasing it. The settled route had no query,
  the results heading remained All posts, and the empty input retained focus.
- The earlier responsive matrix missed short portrait. At 320x480, Chromium
  reproduced the incorrect filter row before the fix. The row direction,
  Topics width, compact padding, and result offset now all require both
  height at most 500px and landscape orientation, matching the existing
  sticky-navbar condition.
- The targeted Chromium resize sequence passed at 320x480, 480x320, 568x320,
  375x667, 768x1024, and back to 320x480. Short portrait used full-width
  288px stacked controls, 12px filter padding, and a 236px results scroll
  margin; short landscape retained a row, 8px padding, and a 96px margin.
  Search and Topics did not overlap and no horizontal page overflow occurred.
  These targeted checks do not replace the earlier light/dark card matrices.
- Final verification passed lint, standalone typecheck, all 908 edge-runtime
  tests, all 1,181 component tests across 117 files (`--maxWorkers=2`), and
  the production build.
- Retest after changes to search identity, draft reconciliation, route
  navigation, filter media queries, or result offsets. Real screen-reader
  acceptance remains outside this evidence.

### Sidebar and mobile drawer iterations (2026-10-28)

Working tree on `codex/dashboard-sidebar-improvements`, based on
`c3f8fee` plus the sidebar and Feed/Notifications route iterations:

- The earlier account-popup iteration passed 1,081 component tests. After the
  inline drawer changes, a parallel run had four timeouts and one missing-dialog
  failure; all five passed in the subsequent one-worker run, which passed all
  1,085 component tests across 107 files. The edge suite passed 904 tests across
  56 files, including the legacy-route redirects. The focused sidebar, mobile
  drawer, and account-menu run passed 29 tests.
- Isolated Chromium at 375px and 700px showed the signed-out drawer at the full
  viewport width with its RESONANCE header. An isolated touch-only fixture using
  the compiled sidebar CSS showed the expand control visible and tappable at
  820px; this was not a test of the authenticated sidebar itself.
- The running development server returned HTTP 307 from `/feed` and
  `/notifications` to their corresponding workspace routes.
- An earlier account-popup iteration was checked in signed-in Chromium at 375px
  and 700px. The mobile account actions have since moved into the drawer itself.
- The current signed-in drawer passed touch-emulated Chromium checks at 320px,
  375px, and 700px with a 700px viewport height. The drawer filled the viewport;
  the identity link opened Profile, Settings and Theme occupied equal halves,
  and Settings, theme buttons, and Sign Out had at least 48px tap targets.
  Theme selection kept the drawer open without a tooltip, Sign Out could be
  reached by scrolling, Escape restored focus to the drawer trigger, and the
  document had no horizontal overflow. Sign Out was not activated in the browser.
- At 820px with touch and no-hover emulation, the sidebar toggle worked by tap,
  Enter, and Space; keyboard focus stayed on the toggle, and navigation icon
  centers differed by less than 1.5px between expanded and collapsed states.
  Feed and Notifications opened in the workspace and exposed the current route.
- These checks do not establish a full keyboard and theme matrix, physical
  device, screen-reader, or non-Chromium acceptance. Repeat the affected
  checks after drawer alignment or interaction changes.

### Collapsible workspace sidebar (2026-10-28)

Checkpoint on `codex/dashboard-sidebar-improvements`, based on `11bccf4` plus
the initial sidebar implementation and tests. The maintainer approved
the desktop collapse and persistence behavior during the interactive session.
[Features](../FEATURES.md#authentication) owns the behavior description.

- The targeted `WorkspaceSidebar`, `MobileNavMenu`, and `WorkspaceShell`
  component run passed all 24 tests with one worker.
- Coverage includes expanded defaults, both persisted choices after remount,
  invalid and unavailable storage, hydration without mismatch reports, keyboard
  activation with focus retained, current-route naming, hover/focus tooltips,
  unread notification labels, and the mobile drawer's full-label presentation
  when the browser stores a collapsed desktop preference.
- The first test run found that the notification label and count concatenated
  in the accessible name. An explicit accessible label fixes this; the final
  targeted run passed. Existing drawer sign-out confirmation and focus-return
  tests also passed.
- This is component-level evidence. It does not establish real screen-reader
  acceptance or repeat the full browser width/theme matrix. That matrix remains
  to be rerun during the broader sidebar work before its final handoff.
- Repeat these checks after changes to sidebar state, storage, tooltip wrappers,
  accessible names, or shared mobile navigation. Repeat relevant browser checks
  when changing width, overflow, icon placement, or focus styling.

### Saved and Liked initial presentation (2026-10-26)

Initial checks on `feat/saved-liked-collection-presentation`, based on `59c4f17`
with uncommitted collection changes, using the T3 collaborative Chromium browser
and the worktree's Next.js server on port 3001 against dev `woozy-spaniel-283`.
This records an initial version, superseded by the final time-group presentation
below.

Current separate-page dashboard routing checks:

- `/dashboard/saved` and `/dashboard/liked` rendered separate pages inside the
  workspace shell, with their own titles, active navigation entries, and
  inherited `noindex, nofollow` metadata. Neither rendered collection tabs.
- Both pages passed the 375, 768, and 1280px light/dark browser matrix without
  horizontal document overflow. Each showed three existing collection posts;
  the posts and their saved/liked state were not changed.
- `/saved` and `/liked` returned HTTP 307 redirects to their corresponding
  dashboard pages. Fresh incognito visits reached login with the corresponding
  dashboard path preserved in `returnTo`, without private post links rendering.
- All 71 affected existing navigation, route-redirect, and section tests passed.
  Lint, typecheck, and production build passed. At that time, new
  presentation-specific UI tests were postponed. Browser mutation, empty
  collections, and more-than-12-row pagination were not exercised in this pass.

Earlier combined-dashboard checks (superseded by separate dashboard pages):

- `/dashboard/collections` rendered inside the workspace shell. Both tabs were
  inspected at 375, 768, and 1280px in light and dark, without horizontal
  overflow. Only the active tab had mounted collection rows.
- Clicking Liked selected it and added `?tab=liked`; switching back to Saved
  removed that parameter. Browser Back restored Liked. Arrow keys moved tab
  focus without selection; Enter activated the focused tab.
- Direct `/saved` and `/liked` visits redirected to the corresponding dashboard
  tab. A fresh incognito `/liked` visit reached login with
  `/dashboard/collections?tab=liked` preserved in `returnTo`.
- The combined navigation entry remained active in both contexts. The dashboard
  metadata exposed `noindex, nofollow`. The existing navigation/collection tests
  (69), redirect tests (2), and full component suite (1,052) passed. Lint,
  typecheck, production build, changed-file formatting, and artifact checks also
  passed for the dashboard revision. No new presentation-specific UI test
  files were added.
- Collection mutations, empty results, and more-than-12-row pagination were not
  exercised in this browser pass. Their existing automated coverage remains;
  visual acceptance is still open.

Earlier separate-page checks, before the dashboard routing amendment:

- Both populated collections were inspected at 375, 768, and 1280px in light
  and dark. No horizontal document overflow occurred. The first two widths
  use one column; 1280px uses two columns. Three existing posts were read;
  their saves/likes were not changed.
- The page titles and `noindex, nofollow` metadata matched each collection.
  Toggle names included the post title and exposed `aria-pressed` state.
  Title links, author links, comments, Like, and Save remain separate controls.
  Keyboard traversal of a Saved row followed that order; links showed outlines
  and toggles showed the application's solid focus border.
- The real shared-toggle/list-hook component regressions and both collection
  section suites passed in the targeted 177-test run, including removal and
  pagination focus handoffs. Browser mutation/removal, empty collections, and
  pagination with more than 12 rows were not exercised in this initial pass.
- Fresh verification passed: `pnpm lint`, `pnpm exec tsc --noEmit`,
  `pnpm test:ci` (898 tests), `pnpm test:component --maxWorkers=2` (1,052 tests),
  `pnpm build`, formatting of changed files, and `pnpm check:artifacts`.
  The earlier concurrent component run failed on outdated bookmark labels and
  two authoring timeouts; label assertions were updated, and the bounded-worker
  full rerun passed. Stale malformed Next.js dev type output was regenerated
  before the passing typecheck/build; these are resolved setup failures.
- At that time, new presentation-specific UI tests were postponed while the
  design evolved; the final time-group presentation below adds them. Physical
  touch, screen readers, and other browsers remain unverified. Repeat affected
  checks after layout/action changes.

### Saved and Liked time-group presentation (2026-10-27)

Final collection checks on `feat/saved-liked-collection-presentation`, based on
`59c4f17` with uncommitted changes, using the T3 collaborative Chromium browser
and the worktree's Next.js server on port 3001 against dev `woozy-spaniel-283`.
The maintainer approved the browser and keyboard-focus results.

- At 320 and 341px, Saved and Liked use flat rows with no card chrome: a 3:2
  cover (96 x 64), the byline after the title, one page-specific action, and a
  divider between rows. Tags are hidden. No horizontal document overflow
  occurred.
- At 667 and 1079px the card surface uses one column; at 1280px it uses two
  columns. Cards keep the 3:2 cover (112 x 74.66), tags under the cover,
  the byline after the title, page-specific actions, and equal row heights.
  Hover and focus-within use the same muted background as Notifications and My
  Posts.
- Relationship-time groups render in order: Today, Yesterday, Previous 7 days,
  Previous 30 days, and Earlier. Headers use a left chevron, label, and 14px
  loaded count. Expanded headers keep the muted background; collapsed groups
  sit 16px apart. The preview showed Today 1 and Yesterday 2.
- Collapse state is stored in `sessionStorage`, keyed by signed-in user and
  collection. A group-list remount with the same key restored the collapsed
  group; a clean key started expanded. This is covered by a group-list test.
  New tabs and browser restarts start expanded.
- Browser check in T3 Chromium at 1280px: Today was collapsed, its session key
  stored `["today"]`, and two cards remained visible. Navigating to Liked and
  back with browser history left Today collapsed; reloading `/dashboard/saved`
  also kept it collapsed. Saved and Liked used independent keys.
- Collapsing Today set the header to `aria-expanded="false"`, hid its panel, and
  left the two Yesterday cards visible. Expanding restored it. The header is a
  native button with `aria-controls` inside a group `h2`; card titles are `h3`
  beneath it, so heading navigation groups each post under its time heading.
- Removing the last visible card while another group was collapsed used to
  leave focus on the document body because the hidden successor failed every
  visibility check. The shared list-focus hook now records and resolves item
  positions among visible cards only, then falls back to the first visible
  recovery or pagination control, a visible group heading, or a programmatically
  focusable root. Four regressions cover a hidden successor, the no-card
  recovery fallback, the all-collapsed heading fallback, and visible-position
  recording; the first three failed against the previous hook.
- No saved/liked timestamp appears on a card. The time group is the only
  visible time context. Collection search, filters, and exact timestamps remain
  deferred.
- Automated verification after the review fixes: time-group helper 4 tests;
  collection group-list, storage, and card tests 13; Saved/Liked section suites
  44; shared list-focus hook 8 tests, including four collapsed-group
  regressions; full component suite 1,069; edge suite 902; lint, typecheck,
  build, formatting, and artifact checks passed.
- The review-fix browser pass at 1280px confirmed card titles render as `h3`
  inside the collection DOM. The deployed Convex functions at that time did not
  return the branch's `addedAt` field, so every saved post grouped into
  Earlier and the two-group collapsed-focus scenario could not be repeated in
  the browser. The three focus regressions failed against the previous hook
  and pass with the fix; rerun the browser scenario after the collection
  queries are deployed.
- Physical touch, real screen-reader sessions, and browsers other than Chromium
  were not exercised in this pass. The grouping uses local time and loaded counts;
  see [known limitations](KNOWN_LIMITATIONS.md).

### Saved and Liked card primitives (2026-10-31)

- Revision: `feat/saved-and-liked-collection-cards`, based on `a879744`.
- Browser check: headless Chromium through local Playwright against the
  signed-in Saved and Liked pages on the local dev server. The T3 profile was
  signed in as Phone Preview. Both pages were checked at 320, 360, 375, 390,
  414, 480, 600, 640, 667, 768, 900, 1024, 1080, 1200, 1279, 1280, 1366, 1440,
  1536, and 1920 in light and dark, for 80 page loads. No horizontal document or
  card overflow occurred at any width.
- Mobile below `sm`: flat rows kept transparent backgrounds, no ring or shadow,
  0 radius, 96 x 64 covers (3:2), the title followed by the byline, the
  page-specific action, and a divider between rows. Tags stayed hidden.
- At `sm` and above: cards kept an 8px radius, the card background and ring, a
  112 x 74.66 cover (3:2), the byline after the title, and linked tags in a
  full-width row under the cover. Tags wrapped without overflow.
- The cover and content started on the same row at every width. Each action
  stayed inside the card and did not overlap the byline. The group header kept
  the full content width.
- The group grid used one column from 320 through 1279 and two columns from 1280. At 1280 the two columns were 430px wide; the single-column card was
  620px at 1024 and 875px at 1279. Cards in the same group row shared a height
  at 1280. A card without tags therefore kept the height of its tagged peer and
  showed additional empty space, following the approved equal-row-height rule.
- Automated: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test:ci` (908 tests),
  `pnpm test:component` (1,189 tests), `pnpm build`, and `pnpm format:check`
  passed. The targeted cover-frame, author-line, tags, collection card, group
  list, Saved, and Liked suites passed within those runs.
- Not verified: physical touch, real screen-reader sessions, and browsers other
  than Chromium; see
  [known limitations](KNOWN_LIMITATIONS.md#saved-and-liked-collections).
- Retest when collection card classes, group grid breakpoints, collection
  fixtures, or action presentation change.

### Required publication covers (2026-10-12)

Incremental evidence on `feat/required-publication-covers`, based on `7decfa9`
with uncommitted cover validation, readiness, focus, visual-state, and
selected-file policy changes. The first implementation gated entry to Review on
a cover; the maintainer rejected that model, so checks of it are marked
historical and superseded below. This does not replace the earlier full-surface
evidence.

- Windows Chrome, attached extension session, dev `woozy-spaniel-283`. The
  attached browser denied native file-chooser assignment; a generated PNG was
  assigned to the actual file input with a File/DataTransfer change event, and
  the application performed the real upload and publication. Native chooser
  operation is not established by these checks.
- Historical, superseded model: missing covers then blocked entry to Review.
  At 375/1280 light/dark the dimmed Review Update control stayed
  keyboard-reachable with a visible focus ring
  (`cover-update-focus-{375,1280}-{light,dark}.png`, local artifacts). Those
  captures are not acceptance evidence for the current flow.
- Enter on Remove cover returned focus to Add cover, both for a new post and a
  published-edit fixture. This behavior carried into the corrected model.
- A held upload kept Publish focusable (`disabled=false`, `aria-disabled=true`)
  while displaying Publishing. Repeated Enter/Space produced exactly one upload
  request. Shift+Tab moved to Back to editing; releasing the held request as a
  network failure did not steal focus back. Returning to editing retained the
  title, body, and selected cover; Start fresh then cleared only that unsaved
  fixture. The interception was removed afterward.
- Publication-after-upload recovery used two editing tabs on a disposable
  post: one saved a concurrent update, then the stale tab uploaded its
  replacement cover and received `Document changed elsewhere.` Review remained
  available, and returning to editing retained its unsaved title, body, and
  replacement File. Discarding those unsaved changes left the concurrent saved
  title intact. The fixture was then deleted; its absence and the demo's
  engagement counts were verified. A beforeunload prompt appeared during
  cleanup navigation; it was accepted only after fixture deletion. This check
  does not establish why that prompt occurred or change navigation policy.
- Functional checks saved a coverless draft, published after adding an image,
  and saved a coverless pending update without changing the published source.
  Those disposable fixtures were deleted through the app; the existing demo
  post retained its one like and one comment.

**Corrected model, retested 2026-10-12:**

- Coverless Review opened by keyboard with a neutral 16:9 placeholder and
  “No cover yet. Add one before publishing.” Final Publish stayed focusable
  with `aria-disabled=true`, described by the visible sticky-header reminder.
  Enter/Space could not submit without a cover and produced no repeated error
  toasts. The normal writing and review journey was not blocked.
- Add cover in Preview returned to editing and focused Add cover without
  opening the native dialog. Title and body remained intact. A cover added as
  the last editing step previewed and published successfully.
- A separate cover-first fixture selected a PNG while title and body were
  empty, then wrote, previewed, and published successfully. Removing its cover
  during published editing still allowed preview, while final Update remained
  blocked. Add cover again returned logical focus to the picker.
- At 375/1280 in light/dark the reminder and Add cover action remained visible
  beneath the sticky toolbar and the placeholder kept its ratio. Tab/Shift+Tab
  established visible focus on Add cover. Inspected screenshots
  `coverless-preview-final-{375,1280}-{light,dark}.png` (local artifacts) show
  no toast overlays or horizontal overflow; scroll width equalled client width.
- Both named published fixtures were deleted and their absence verified in
  My Posts. The demo still showed one like and one comment. The unsaved visual
  fixture was cleared via Start fresh, restoring the original blank `/create`,
  dark theme, and 2554x1188 viewport. File selection used the same real-input
  method described above; native chooser acceptance remains outside the
  evidence.

**After this retest (review fix; automated coverage, no browser retest):**

- Final readiness checks a selected File for supported MIME (JPEG, PNG, WebP),
  nonzero size, and the 5 MiB maximum, and draft and publish validation reject a
  zero-byte file before it can be stored. An empty or unsupported selection
  surfaces the form's cover-policy message before Review instead of being saved
  and trusted later. Automated tests cover unsupported formats, unknown MIME,
  empty and oversized files, the exact valid size limit, and no reservation or
  upload on an invalid submit.
- Uploads are verified server-side at finalization: a zero-byte object is
  rejected, and an image must carry the stored signature for its declared JPEG,
  PNG, or WebP type. Automated coverage only.
- A saved cover the server cannot resolve blocks Review from both ordinary
  hydration and pending-target adoption, with the existing recovery message
  until the author replaces or removes it. Automated coverage only.
- Refreshed ordered lint, 659 edge-runtime tests, 742 component tests, and
  build passed after this fix.
- Minor review finding: Back to editing stays focusable and guarded while
  saving but does not visually dim like Review/Publish. This is recorded polish,
  not a reproduced focus-loss or duplicate-write defect.
- Screen-reader, touch, and non-Chromium limitations remain unchanged. Direct
  TypeScript verification retains the separate baseline test-file gaps in
  [known limitations](KNOWN_LIMITATIONS.md).
- Retest after cover controls, readiness guards, submission state, or focus
  handling change.

Result values: Pass, Fail, Blocked, Not applicable. Blocked rows name the
reason. Rows marked `Blocked - Not executed` are placeholders, not evidence.

### Journey 1: Discover and read

| Check ID    | Journey / surface / state                     | Check                  | Width / theme | Result | Evidence / revision | Finding |
| ----------- | --------------------------------------------- | ---------------------- | ------------- | ------ | ------------------- | ------- |
| J1-Home     | `/` marketing home                            | keyboard, names, focus | Standard      | Pass   | See notes           | None    |
| J1-Discover | `/blog` search, topics, latest, empty/results | keyboard, names, focus | Standard      | Pass   | See notes           | None    |
| J1-Post     | `/blog/[postId]` article and actions          | keyboard, names, focus | Deep          | Pass   | See notes           | None    |
| J1-Profile  | `/u/[userId]` profile and activity            | keyboard, names, focus | Standard      | Pass   | See notes           | None    |

**Journey 1 notes (2026-10-09, `d68b9c9+dirty`)**

- J1-Home: signed-in `/` redirects to `/dashboard` at 1280 and 375. The
  signed-out marketing page was traversed at 1280 and 375 in both themes:
  navigation, hero, Get Started, View All Posts, card controls, and footer
  links are all reachable with visible focus. Screenshots
  `home-signedout-375-light.png`, `home-signedout-dark.png`.
- J1-Discover: signed-in, 1280 dark full 26-control traversal in logical order
  with no traps, and landmarks/names verified from the accessibility snapshot.
  Focus visuals: search input border recolors to orange against gray at rest;
  card link gets a 1px orange outline against none at rest; theme button edge
  lightens; the same comparisons hold in light. 375 dark and light: content
  reachable, named navigation trigger, card outlines visible. Signed-out
  sweeps at 1280 and 375 in both themes. Search `zzzqqq` shows the named empty
  state with Clear search recovery; `the` renders results; a topic link
  navigates; pagination not applicable with the current data. Screenshots
  `discover-focus-input-dark.png`, `discover-focus-theme-dark.png`,
  `discover-focus-card-dark.png`, `discover-focus-input-light.png`,
  `discover-focus-card-light.png`, `discover-375-dark.png`,
  `discover-375-light.png`.
- J1-Post: signed-in, 1280 light and dark full traversals reach author link,
  Like (accessible name includes the count), Save, comment textarea, Comment,
  and Back to all posts, wrapping without a trap; compact traversals at 768,
  375, and 320 in both themes. Signed-out, 1280 light plus 768/375/320 in
  both themes reach author link, Follow, Like, Save, the Sign in and Sign up
  comment prompt, and Back to all posts. Focus visuals: Like ring in dark,
  link outlines, input border. Comments resolve to a named empty state; the
  comment form is labeled. Authored body links: none exist in the five
  published posts; topic links verified on the tagged post. Screenshots
  `post-focus-like-dark.png`, `post-320-light.png`,
  `post-signedout-dark.png`.
- J1-Profile: signed-in, 1280 and 375 in both themes; Edit Profile, named
  Profile stats group, post cards with Like, Save, Read More, author and tag
  links are all reachable with focus styles. Signed-out, 1280 and 375 in both
  themes show the Follow button and card controls instead. Screenshots
  `profile-375-dark.png`, `profile-1280-light.png`.
- Anonymous engagement starts authentication with the originating context
  preserved: Like from Home reached `/auth/login?returnTo=%2F` and Follow from
  the profile reached `/auth/login?returnTo=%2Fu%2F<id>` (console-log
  evidence). Save, comment reply, and the other follow surface use the same
  `buildAuthHref` path, with component tests pinning their return contexts
  (`%23save`, `%23comments`, `%23follow`).
- The transient `beforeunload` dialog (J1-Post finding) was not reproduced in
  two later navigation passes, and no unload handler was attached on reader
  pages when probed.

### Journey 2: Engage

| Check ID       | Journey / surface / state                                        | Check                              | Width / theme | Result                                | Evidence / revision | Finding                                      |
| -------------- | ---------------------------------------------------------------- | ---------------------------------- | ------------- | ------------------------------------- | ------------------- | -------------------------------------------- |
| J2-Auth        | `/auth/login`, `/auth/sign-up`                                   | keyboard, names, focus, validation | Standard      | Pass (signed-out states)              | See Journey 2 notes | OAuth handoff not exercised                  |
| J2-Actions     | post like, save, follow, comments; anonymous redirect and return | keyboard, names, focus, states     | Deep          | Pass                                  | See Journey 2 notes | None                                         |
| J2-Feed        | `/feed` feed and empty states                                    | keyboard, names, focus             | Standard      | Pass (current-design keyboard checks) | See Journey 2 notes | Fixed pagination and pending Like/Save focus |
| J2-Collections | `/liked`, `/saved`, focus after removal                          | keyboard, names, focus             | Standard      | Pass                                  | See Journey 2 notes | Fixed focus restoration after removal        |

**Journey 2 notes (light and dark; managed Chrome and extension contexts)**

- J2-Auth: login and sign-up are keyboard-operable at 1280 and 375 in both
  themes; controls are named, with labels programmatically associated to
  their inputs (`Email`, `Password`, `Full Name`), and focus is visible.
  Submitting invalid input keeps focus in the form, moves it to the first
  invalid field, announces plain-English messages in `role="alert"` elements,
  and marks the inputs `aria-invalid` with `data-invalid` on their Fields.
  OAuth provider handoff is external and was not exercised.
- J2-Actions: on the article at 1280, keyboard activation of Like and Save
  updates the pressed state, accessible name, and count ("Unlike this post,
  1 like", "Remove from reading list") and was restored to the original state.
  The comment textarea accepts and clears typed text without submitting; the
  reader comment prompt and comment controls remain reachable. Comment
  submission was additionally browser-verified in a maintainer-requested
  multi-account demo: a signed-in second account liked the demo post and
  posted a comment that appeared with its author name and timestamp. Follow
  was verified against a second account: keyboard activation toggles
  Follow -> Unfollow with `aria-pressed` and back, restoring the original
  state.
- J2-Feed: with no followed authors, the empty state reads "Your feed is
  empty / Follow authors to see their latest posts here." and offers a
  keyboard-reachable Discover link; the page traversal is clean. That initial
  check did not cover populated cards. The follow-up below records actual
  populated traversal/actions/navigation and reproduced focus failures.
- J2-Collections: after liking and saving two posts, removing an item moves
  focus to the same toggle action on the card that takes its place, or to the
  previous card when the removed one was last; removing the last item moves
  focus to the empty state's Explore Discover recovery link. A Load more page
  that appends no visible posts keeps focus on the replacement pagination
  control, or moves it to the final card or the empty state when the list
  exhausts. Refilled pages and disabled successor controls are covered by
  regression tests. Toggles were restored to their original state. The fixes
  are recorded under Findings.
  PR review follow-up: the hook now refreshes the focused card's position and
  the focused Load more control's item count after reactive list changes.
  Component regression tests cover insertion and removal ahead of the same
  connected control in both collections; this is automated evidence, not a
  new browser pass. The final time-group presentation retains this behavior,
  uses one page-specific action per card, and excludes group headings from
  fallback selection. Maintainer browser and keyboard acceptance is recorded
  in the 2026-10-27 section above; physical touch and real screen readers remain
  unverified.
- Dark theme: post actions at 1280 and 375, the Feed empty state at 1280 and
  375, and the empty Liked and Saved states were re-verified with visible
  focus.
- Automated evidence: pending and repeated toggles, rejected submissions,
  failed-submit toasts, validation and invalid-state wiring, label
  association, return paths, and auth guards are covered by
  `app/auth/login/page.test.tsx`, `app/auth/sign-up/page.test.tsx`,
  `components/web/LikeToggle.test.tsx`, `BookmarkButton.test.tsx`,
  `FollowButton.test.tsx`, and `CommentSection.test.tsx`.

### Journey 3: Author

| Check ID  | Journey / surface / state                                                       | Check                                   | Width / theme | Result | Evidence / revision | Finding |
| --------- | ------------------------------------------------------------------------------- | --------------------------------------- | ------------- | ------ | ------------------- | ------- |
| J3-Editor | `/create` new, draft, and published-edit modes; title, body, menus, tags, media | keyboard, names, focus                  | Deep          | Pass   | See notes           | None    |
| J3-Review | Review/Back, publish/update, pending update                                     | keyboard, names, focus, dialog behavior | Deep          | Pass   | See notes           | None    |
| J3-Guards | exit, recovery, document-switch, sign-out guards                                | keyboard, names, focus, dialog behavior | Deep          | Pass   | See notes           | None    |

**Journey 3 notes (managed Chrome, dark and light)**

- J3-Editor: the title receives focus when a writing view opens, and typing
  works in the title and the BlockNote editor at 1280, 768, 375, and 320 in
  both themes (768 and 320 light added during PR review). The `/` slash menu opens 18 named items and
  keyboard selection inserts blocks; tags render as a named fieldset with
  named checkboxes; Undo/Redo are named; formatting and side-menu affordances
  keep keyboard paths through shortcuts and the slash menu. A disposable
  new-post draft was saved ("Draft saved successfully!"), published through
  Review, opened in published-edit mode, and removed through management
  deletion afterwards. Entering Review moves focus to Back to editing and
  returning moves focus back to the Review control, or to Post title when
  Review is disabled while a requested document loads (added during PR review;
  covered by editor tests).
- J3-Review: Review opens with named Back to editing and Publish controls.
  Publishing announced "Post published successfully!" and landed on `/blog`.
  Published-edit mode showed its mode label with Cancel update, Save draft,
  and Review Update controls. Saving a pending update announced "Pending
  update saved as draft." and the draft appeared in Drafts labeled Pending
  update; Cancel update exits without discarding the saved pending draft and
  the live post stayed unchanged. Promotion was performed during the pass on
  the disposable post (a full body edit from published-edit mode announced
  "Post updated successfully!" and the live reader showed the new content,
  with the updated timestamp); the pending-update flow's acceptance remains
  recorded in V1-15.
- J3-Guards: an app-link departure from a new post recovers silently (no
  dialog) and the content was restored on return. The Start fresh
  confirmation is a named alertdialog ("Start fresh?") with focus inside,
  Cancel semantics on Escape, and focus restored to the trigger. Native
  document-level warnings attach only while unsaved authoring work exists
  (observed when navigating away from the editor with unsaved content).
- Automated evidence: rejected save and publish, busy and repeated
  submissions, failed target validation, unsaved-work preservation, recovery
  resumption, and guard cancellation are covered by
  `app/(workspace)/create/page.test.tsx` and the editor component tests under
  `app/(workspace)/create/_components/`.

### Journey 4: Manage

| Check ID     | Journey / surface / state                        | Check                                   | Width / theme | Result | Evidence / revision | Finding                                            |
| ------------ | ------------------------------------------------ | --------------------------------------- | ------------- | ------ | ------------------- | -------------------------------------------------- |
| J4-Published | `/dashboard/published` rows, actions, pagination | keyboard, names, focus                  | Deep          | Pass   | See notes           | Fixed collapsed title focus target; pagination N/A |
| J4-Drafts    | `/dashboard/drafts` rows, actions, pagination    | keyboard, names, focus                  | Deep          | Pass   | See notes           | Fixed collapsed title focus target; pagination N/A |
| J4-Delete    | deletion confirmation and focus restoration      | keyboard, names, focus, dialog behavior | Deep          | Pass   | See notes           | None                                               |
| J4-Dashboard | `/dashboard` overview                            | keyboard, names, focus                  | Standard      | Pass   | See notes           | None                                               |
| J4-Analytics | `/dashboard/analytics`                           | keyboard, names, focus                  | Standard      | Pass   | See notes           | None                                               |

**Journey 4 notes (managed Chrome, dark and light)**

- Rows expose the title link (View), Edit, and Delete with per-post accessible
  names at 1280 and 375 in both themes. Deletions used disposable draft and
  published content created during the pass. Confirmation is a named
  alertdialog (Delete pending draft? / Delete published post?) with Cancel and
  Delete Draft or Delete Post, focus inside, and Escape returning focus to the
  per-row trigger. Confirming shows success feedback, removes the row, and
  moves focus to the next row's Edit link or to the empty state's Create a
  post action. Pagination did not render with five posts, matching the
  accepted pagination behavior and component coverage.
- Dashboard and Analytics headings ("Your writing workspace", "Analytics",
  "Follower growth") and every sidebar control are reachable with visible
  focus; chart internals are not claimed as screen-reader verified.
- Automated evidence: pending and duplicate protection, failed deletion and
  retry, auth guards, and focus restoration when query updates arrive before
  or after mutation resolution are covered by
  `app/(workspace)/dashboard/_components/*.test.tsx`.

**Management breakpoint follow-up (2026-10-10, `f56a8b9`)**

Executed against `http://localhost:3000` in Windows Chrome 154 attached through
the Playwright extension (`mainaccount` session), signed in as the maintainer's
main demo account. Actual viewport sizes were 320×900 and 768×900; each route
was reloaded after selecting light/dark through the stored theme preference.
This does not establish operation of the Settings Appearance control.

| Width | Theme | Published rows                       | Draft rows                           | Delete dialogs                    |
| ----- | ----- | ------------------------------------ | ------------------------------------ | --------------------------------- |
| 320   | Dark  | Pass                                 | Pass                                 | Pass (open, trap, Escape, Cancel) |
| 320   | Light | Pass                                 | Pass                                 | Pass (open, trap, Escape, Cancel) |
| 768   | Dark  | Fail: title focus visually collapsed | Fail: title focus visually collapsed | Pass (open, trap, Escape, Cancel) |
| 768   | Light | Fail: title focus visually collapsed | Fail: title focus visually collapsed | Pass (open, trap, Escape, Cancel) |

- Traversed all 15 row controls across four existing published posts and all
  six controls across two purpose-created drafts using Tab. These include
  title links, Edit/Resume, Delete, and the published tagged row's topic links.
  Activated the first title and Edit/Resume links with Enter and returned to
  management without modifying content. Screenshots verified visible focus
  on the mobile row actions and desktop action groups in both themes.
- At 768px the sidebar, thumbnail, and actions consume the row width, leaving
  title/metadata visually collapsed. Both first-row headings measured **0px wide**
  with `overflow: hidden`; its title link still receives keyboard focus and
  activates, but no visible title focus target appears. Published rows show
  the same visual collapse. DOM focus and `:focus-visible` alone therefore
  do not establish a passing visible-focus result. This was the pre-fix
  failure, subsequently repaired and retested below. At 320px long titles
  are ellipsized but remain visible.
- At every combination, Enter on a per-row Delete button opened the named
  `Delete published post?` or `Delete draft?` alertdialog. Tab and Shift+Tab
  remained inside its enabled controls; focused controls and dialog text were
  visible within the viewport. Escape and keyboard-activated Cancel closed
  the dialog and restored its original per-row Delete trigger.
- Actual draft deletion was exercised at **320 dark** and **768 light**, not
  all four combinations. Deleting fixture B at 320 dark restored focus to
  fixture A's Resume link; deleting the final fixture A at 768 light restored
  focus to the empty state's Create a post link. Both fixture rows disappeared.
  Existing published posts were never deleted; published confirmation here
  covers cancellation, not a new destructive-operation pass.
- Fixture cleanup: `Management breakpoint fixture A 2026-10-10`
  (`j978v6ct5txsf60wy2k9tagnh18g07t0`) and fixture B
  (`j977srf5s77zfwmtbd1w1qprr58g0rrk`) were created with Save draft and
  deleted through the UI. Drafts returned to its original empty state. No
  images were uploaded; the retained demo post and its engagement were untouched.
  Pagination did not render for either list and remains unexercised here.
- Local evidence archive:
  `/home/studio/projects/resonance-docs-archive/browser-evidence-2026-10-10-management/`.
  `management-browser-results.json` contains per-control traversal, viewport,
  focus and dialog observations. Screenshots follow
  `management-{published|drafts}-{320|768}-{dark|light}-{row|dialog}.png`;
  `management-{drafts|published}-768-title-focus.png` records failing title focus,
  and `management-cleanup-{320-dark|768-light}.png` records deletion restoration.
  Scripts and cleanup results are archived alongside them; artifacts are local,
  not a portable CI/browser test suite.

**Collapsed-title fix and retest (2026-10-10, based on `f56a8b9` plus row fix)**

- Root cause: both row grids reserved 11rem for the cover and 12rem for
  actions starting at 768px, where the sidebar also appears. Those fixed
  columns, gaps, and padding exhausted the content width. Both rows now keep
  their existing two-column composition through 1023px, with actions on the
  following row; the third action column begins at 1024px. Sidebar and mobile
  layouts are unchanged.
- The browser regression script first failed on all four published headings
  measuring 0px at 768 dark. After the fix, all **24 route/width/theme runs**
  completed: Published and Drafts at 320, 375, 768, and 1280 in both themes,
  plus 900 and 1024 in both themes to check the revised breakpoint boundary.
  Every heading had positive width. At 768px the first draft and published
  headings both measured **198px**, and screenshots show the title text and
  its keyboard-focus outline. Long titles still truncate intentionally.
- Each run repeated full row traversal, title and Edit/Resume activation,
  named deletion-dialog opening, bidirectional focus trapping, Escape,
  keyboard Cancel, and trigger restoration. Existing published posts stayed
  untouched; pagination and actual published deletion are not newly verified.
- Recreated only the two approved draft fixtures for this retest: A
  (`j97698whqyq0kabv1jvcyad2td8g14qw`) and B
  (`j973jw3d7bsgkdbnav981t1mt98g0fae`). Both were deleted through keyboard
  confirmation afterward, again at 320 dark and 768 light. Focus returned to
  the surviving Resume link and then the empty-state Create a post link;
  zero drafts remained. No cover/media uploads or existing-content edits.
- Post-fix evidence is archived separately, preserving the failure evidence:
  `/home/studio/projects/resonance-docs-archive/browser-evidence-2026-10-10-management-layout-fix/`.
  It includes the executable browser regression script, RED/GREEN logs,
  `management-layout-results.json`, cleanup results, and screenshots using
  the same naming scheme with additional 375/900/1024/1280 widths.
  The script is local evidence tooling, not a new repository dependency.

**Retest after design changes:** this is evidence for the current revision,
not final acceptance of the ongoing Dashboard/management design. Repeat the
full Deep matrix (320/375/768/1280, both themes) whenever sidebar width,
responsive row composition, title truncation, action placement, dialog layout,
or focus restoration changes. Use long titles and mixed tag/cover states;
inspect screenshots as well as DOM focus to catch collapsed targets. Keep
existing content read-only; create disposable drafts/posts for destructive
checks, record cleanup, and exercise pagination only with sufficient fixtures.

### Journey 5: Navigate and account

| Check ID         | Journey / surface / state                                | Check                                   | Width / theme | Result     | Evidence / revision | Finding                                                       |
| ---------------- | -------------------------------------------------------- | --------------------------------------- | ------------- | ---------- | ------------------- | ------------------------------------------------------------- |
| J5-Nav           | navbar, sidebar, mobile drawer; signed-in and signed-out | keyboard, names, focus, dialog behavior | Deep          | Pass       | See notes           | None                                                          |
| J5-Menus         | account and theme menus; notification bell from editor   | keyboard, names, focus, guard context   | Deep          | Pass       | See notes           | None                                                          |
| J5-Notifications | `/notifications` list and empty state                    | keyboard, names, focus                  | Standard      | Pass       | See notes           | Pagination focus fixed; recovery link delivered (V1-18)       |
| J5-Settings      | `/settings` appearance and account                       | keyboard, names, focus                  | Standard      | Pass       | See notes           | None                                                          |
| J5-ProfileEdit   | Previous `/profile/edit` validation and save             | keyboard, names, focus                  | Standard      | Superseded | See notes           | Replaced by J6-ProfileEditor; not evidence for the new editor |
| J5-SignOut       | sign-out confirmation choices                            | keyboard, names, focus, dialog behavior | Standard      | Pass       | See notes           | None                                                          |
| J6-ProfileEditor | `/profile/edit` identity and selected-work editor        | keyboard, names, focus, reorder, status | Deep          | Pass       | See J6 follow-up    | Save/pagination focus and country keyboard recovery fixed     |

**Journey 5 notes (managed Chrome, dark and light; extension attach for the bell check)**

- J5-Nav: desktop sidebar and navbar traversals pass in both themes; the
  signed-out navigation states are covered in Journey 1. At 375 and 320 the
  drawer opens as a dialog named Navigation with focus inside, contains Tab
  traversal, lists every destination, and Escape restores focus to the
  hamburger trigger. The light-theme probe returned no aria-label through a
  raw DOM query while focus containment held; the dark evidence and the V1-15
  record confirm the accessible name.
- J5-Menus: the account menu opens with named items (Profile, Saved, Liked,
  Settings, Sign Out) and closes on Escape with focus back on Open user menu.
  The theme menu is named with three options and was used throughout the
  pass. The notification bell was executed from the editor with unsaved
  content: it navigated silently to `/notifications`, and returning to
  `/create` restored the typed title through the same silent-recovery
  mechanism verified for app-link departures.
- J5-Notifications: the initial pass covered only the empty state. The
  follow-ups below execute both empty and populated states, record the
  pagination-focus failure, and verify its fix. The empty state has no recovery link, recorded
  for V1-18's approved recover-to-Discover requirement.
- J5-Settings: Appearance is a named combobox (Light, Dark, System). The
  initial pass identified the control without selecting options; the PR
  follow-up below exercises its keyboard behavior. Account shows the signed-in
  email with a named Sign Out button; sign-out was not activated in this check.
- J5-ProfileEdit (historical, superseded by J6): groups and fields were named (disabled Email with
  explanation, Display Name, Bio with a live character counter). Save Changes
  was activated from the keyboard with the values unchanged (nothing was
  modified) during PR review; the form announced "Profile updated" and
  redirected to the profile.
- J6-ProfileEditor: the approved `/profile/edit` editor has display name, Bio,
  country, social links, a local-only Username field, and up to nine
  ordered Featured posts. The maintainer approved its layout and copy before
  the browser acceptance below; that design was not reopened. The earlier
  October 13 lint/728 edge/793 component/build results predate the acceptance
  fixes and are not the final verification for this editor.
- J5-SignOut: with unsaved authoring content, the sidebar Sign Out opens a
  named alertdialog ("Sign out?") with Cancel, Discard & sign out, and Save &
  sign out choices and focus inside. Escape closes it, keeps the session, and
  preserves the editor content. That initial check did not execute either
  sign-out choice; the follow-up below records both actual outcomes.
  Touch acceptance for the drawer remains an
  accepted limitation (no touch device available).

**J6-ProfileEditor follow-up (2026-10-14, `7d424d2` plus uncommitted editor fixes)**

- Windows Chrome 154, driven by the Windows-side Playwright CLI from WSL,
  against `http://localhost:3000` and dev `woozy-spaniel-283`. The completed
  pass used visible managed windows: `profileacceptance` for read-only demo
  checks/local unsaved edits and `profilefixtures` for disposable writes.
  The browser clock reported October 13. Light/Dark were selected through the
  actual theme menu; viewport sizes were 320×900, 375×900, 768×900, and
  1280×900 in each theme.
- **Historical blocked attempts, superseded:** extension attachment reached
  the signed-in editor and basic selection/Done/Escape worked, but field
  traversal repeatedly lost the connection with `Input.dispatchKeyEvent:
Detached while handling command` or a closed-page error. Disabling 1Password
  did not resolve it. Its cause was not established; these interrupted runs
  are not matrix evidence or a reproduced application defect. Managed Chrome
  passed the same five-Tab diagnostic and the complete matrix.
- All editor controls were keyboard-reachable with names and visible focus;
  inspected settled screenshots show field borders, picker focus, and moved-row
  focus rather than relying only on DOM state. The development-tool portal and
  browser-chrome traversal are not application controls. At every width/theme,
  document scroll width equalled client width. Long titles wrapped in both the
  picker and selected list without clipping their actions.
- Blank display-name and 1,001-code-point emoji Bio submissions focused the
  invalid field, retained input, and exposed associated descriptions/errors,
  `aria-invalid` on the control and `data-invalid` on its Field. The Bio counter
  read 1001 / 1000. Country search, ArrowDown/Enter selection, and Escape return
  worked. After the country fix, 31 Down presses scrolled the active option
  into view while search kept focus; keyboard Clear country returned focus to
  Country. An invalid Instagram URL exposed its named inline error, and keyboard
  removal returned focus to Add social link. Local-only Username/Location edits
  did not enable a persisted save.
- Picker opening focused Search posts. Tab/Down reached a result; Up/Down moved
  between available results and Up from the first returned to search.
  Enter/Space toggled selection; title search found the demo, no-match search
  exposed recovery, and clearing reset browsing. Shift+Tab from search reached
  Done and Tab wrapped back inside. Done and Escape returned focus to the
  surviving Choose/Add/Manage posts trigger without jumping the page.
- A disposable author supplied **14 distinct published posts**, named
  `Profile acceptance fixture 01` through `13`, with two distinct `02` posts
  because an interrupted publication batch had already created that title.
  Each used a generated PNG assigned to the real file input and the app's real
  Review/Publish flow. Native file-chooser operation is not claimed. All eight
  final pagination/limit/save runs loaded 12→14 posts, enforced nine selections
  and disabled the five remaining choices. Wheel input over the backdrop left
  background scroll unchanged; wheel input in the results scrolled that region
  while Search/Done kept their positions. Outside clicks kept the dialog open.
- **Fixed browser failures:** native disabling of Save dropped keyboard focus
  to body, and exhausted pagination dropped it to the dialog container. Save
  and pending Load more now remain focusable with `aria-disabled` and guarded
  activation. All eight final runs focused the first available appended post
  after pagination and retained visible Save focus after success. Component
  regressions verify pending duplicate guards and respect deliberate focus
  departure; the exhausted-at-cap fallback was also browser-checked.
- Keyboard Up retained the moved control at the first-position boundary and
  announced its new position. Removal focused the surviving row's Remove, or
  Choose posts when the final row was removed. Both-theme Deep runs exercised
  these transitions. Saved reorder persisted in the disposable account.
- One save independently accepted selected-work changes while rejecting a
  blank display name. Two authenticated tabs then saved concurrent identity and
  selection changes: the dirty tab retained its introduction and chosen order,
  showed both conflicts, and each explicit Load saved version replaced only its
  own section. Query-echo-before-response, reverting during pending saves,
  older query echoes, and late errors after account switch have automated
  regression coverage; those timing cases were not browser fault-injected.
- **Cleanup verified:** all 14 fixture posts were deleted through their own
  management confirmations. My Posts returned to No published posts yet and
  the editor reconciled to zero selections. The empty disposable author account
  `k1770qhj3g8xytq755n9rch4x98g61qf` remains; no delete-account UI exists.
  The protected demo `j97ewf0y3ckz82j9q5225yaqj18fzzrp` still showed one like
  and one comment, and the existing follow action remained pressed/Following.
  No protected content or engagement was modified. The original attached tab's
  unsaved edits were left alone; the managed demo window returned to its
  2554×1278 viewport and System theme.
- Raw scripts/results and screenshots remain outside Git. Retest this Deep
  matrix after changes to modal geometry, field validation, country navigation,
  pending-action guards, pagination/removal focus, or revision reconciliation.
  Screen-reader, touch, non-Chromium, target-size, and zoom limitations remain;
  this does not certify the unfinished public author canvas/catalogue.
- Final ordered verification after the fixes: `pnpm lint` passed, all **729**
  edge/backend tests passed, all **800** component tests passed with one worker,
  and `pnpm build` passed. Changed editor/document formatting and
  `pnpm check:artifacts` also passed. The latter checks the Git index, not all
  possible untracked filenames. The fixture browser was closed and its temporary
  authentication-state file removed at the maintainer's requested stopping point.

**J6 Country-row refresh (2026-10-14, approved layout adjustment)**

This refresh supersedes the earlier J6 Location-field, long official-name, and
trailing Clear country observations. The other editor journeys above retain
their tested scope; this was a focused retest of the changed country controls,
not a new complete editor pass.

- The maintainer approved removal of Location and the full-row Country control,
  with a compact dropdown and No country as the first browsing option. Username
  remains local-only. The existing country codes use common English labels and
  familiar search aliases; only a code or null is emitted by the picker.
- Managed Windows Chrome (`profileacceptance`) on the signed-in development
  editor, based on `7d424d2` plus the current uncommitted changes. All eight
  320/375/768/1280 × light/dark runs verified that Location was absent and the
  Country trigger had the same width as Bio. Its widths were 273, 328, 705,
  and 760px respectively; popup widths were 273, 328, 400, and 400px.
- Search for Saint Vincent and the Grenadines exposed its named option, with
  no No country option during search. ArrowDown/Enter selected it. The full
  selected name wrapped to two lines at 320px and remained one line at the
  other widths, without text clipping or horizontal document overflow. Popup
  right edges stayed inside the viewport. Inspected themed screenshots show
  selected-control focus, complete names, and the compact browsing panel.
- Reopening with empty search put No country first. ArrowDown/Enter cleared
  the selection, closed the popup, and returned visible focus to Country with
  Choose a country shown, at every width/theme. Component coverage also checks
  mouse clearing, null callbacks, selected state when reopening, query clearing,
  no form submission from Enter, and persistence only after explicit Save.
- No save was performed during this browser refresh. The starting country,
  theme, and viewport were restored, and the page returned to the top; protected demo content
  and engagement were not changed. Raw results and screenshots remain outside
  Git under `/tmp/opencode/country-row-approved-browser.*` and the Windows-side
  browser tools directory (`country-row-approved-*`).
- Fresh lint, all **736** edge/backend tests, and all **828** component tests
  (one worker), followed by the production build, passed after updating the
  approved UI's regressions. Retest this
  focused Deep matrix after changes to country layout, popup sizing, labels,
  search, clearing, or keyboard behavior. Existing screen-reader, touch,
  non-Chromium, and broader author-page limitations remain unchanged.

**J6 Codex review fixes (2026-10-14)**

- The read-only Codex review identified a growing cross-search card cache and a
  Country trigger whose fixed accessible name hid the selected value. Both
  findings were validated against the source and repaired without changing the
  approved visible layout.
- The cache now retains only selected card summaries (at most nine), evicts
  removed selections, and refreshes details when a post is selected again.
  Pure regression coverage cycles through 100 unrelated searches without
  growing a nine-card cache; component coverage verifies fresh title/cover
  details after deselection and reselection. A browser check retained an unsaved
  chosen title after a no-match search, then removed it and returned the editor
  to zero selections and a guarded Save. No save or protected-data mutation was
  performed.
- The Country trigger's accessible name now combines its label and current
  value, including No country selected for an empty value. Component regressions
  failed on the previous fixed name and passed after the change. The focused
  320/375/768/1280 × light/dark browser refresh confirmed the full selected name,
  unchanged geometry, no horizontal overflow, and visible focus return with
  Country: No country selected after keyboard clearing. This inspects accessible
  naming; it is not a real screen-reader acceptance claim.
- Final ordered lint, **741** edge/backend tests, **831** component tests
  (one worker), and the production build passed after these fixes. These results
  supersede the earlier verification counts for this editor revision. Raw
  review output, RED/GREEN logs, and browser results remain outside Git under
  `/tmp/opencode/`. The original review was not rerun after repair; the fixes
  were verified by regression tests and the affected browser checks.

**Profile PR review follow-up (2026-10-14, `6e8b322` plus calendar fix)**

- [The calendar-query finding](https://github.com/pooYAYooq/resonance/pull/110#discussion_r4268817499)
  was validated as a query-guideline violation. The existing calendar branch
  ignored the clock argument, so the finding did not demonstrate an incorrect
  date. The query now uses a pure UTC calendar formatter without a current-time
  argument; relative formatting retains its explicit clock.
- The new formatter regression failed before implementation and passed after
  extraction. Public-query coverage verifies a UTC year boundary, a zero epoch,
  and a missing join timestamp without falling back to profile insertion time.
  All **16** focused date/user tests passed.
- Fresh ordered lint, **745** edge/backend tests, **831** component tests
  (one worker), and the production build passed for this repair. No visible
  layout or date semantics changed; no browser or deployment verification was
  performed for this backend-only extraction. Recheck the date evidence when
  formatting or join-date semantics change. The other three PR findings still
  require their planned repairs; this result is not acceptance of those fixes.

**Profile picker eligibility follow-up (2026-10-14, `5d95f21` plus picker fix)**

- [The picker eligibility finding](https://github.com/pooYAYooq/resonance/pull/110#discussion_r4268817512)
  reproduced in browse and title search: coverless published posts were offered
  even though the selection mutation rejected them. Both query paths now omit
  coverless entries from each bounded page before hydration, without changing
  native pagination metadata or weakening mutation validation. This does not
  filter other public post lists or repair development records.
- Four backend regressions failed before the change and passed afterward:
  browse/search eligibility and continuation through a filtered-empty first
  page. Two further regressions confirm that a stored cover with an unavailable
  URL is still returned and accepted by the selection mutation. All **32**
  profile backend tests passed. The focused run emitted a Node
  `TimeoutNegativeWarning` from the test runtime but had no test failures.
- A new component regression passed against the existing picker: an empty page
  with CanLoadMore does not announce an exhausted list, and the next loaded post
  receives focus and can be selected. All **26** selected-work component tests
  passed; no component implementation change was required.
- Fresh ordered lint, **751** edge/backend tests, **832** component tests
  (one worker), and the production build passed. This is automated query and
  keyboard-component evidence, not a fresh live-browser/deployment check.
  Recheck eligibility, continuation, and pagination focus when the picker query
  or published projections change. The country composition/casing repairs remain
  outstanding at this checkpoint.

**Country review follow-up (2026-10-14, `e48dabc` plus country fix)**

- [The composition finding](https://github.com/pooYAYooq/resonance/pull/110#discussion_r4268817522)
  reproduced with composing Enter both before arrowing to a match and with an
  active option. Both regressions failed because the event was prevented.
  The country search now ignores custom keyboard handling during composition;
  both tests verify no selection, retained list/search focus, and normal Enter
  selection with trigger focus return afterward.
- [The flag-casing finding](https://github.com/pooYAYooq/resonance/pull/110#discussion_r4268817531)
  reproduced for FI and IN with Turkish default casing. Their trigger flags
  had non-ASCII selectors. Country-code class generation now uses toLowerCase;
  regressions verify ASCII classes in both triggers and options. The custom
  Iran image and country membership are unchanged.
- All four new regressions failed before implementation and passed afterward;
  all **42** country-picker tests passed. Fresh ordered lint, **751**
  edge/backend tests, **836** component tests (one worker), and the production
  build passed for this revision.
- These are synthetic-event and component checks, not native IME acceptance.
  The earlier Windows browser harness was unavailable and no browser session
  was active, so no fresh live-browser run is claimed. Recheck with a real IME
  and Turkish browser locale when that harness is available; the prior browser
  matrix remains evidence for its tested revision only.
- A read-only Codex review of all three repair groups identified one remaining
  issue: picker empty-state wording did not distinguish cover eligibility from
  the existence of published posts. At this checkpoint it remained open for a
  separate copy/regression fix, recorded below. The review found no other
  actionable issues and did not
  run tests or perform browser verification.

**Picker empty-state review repair (2026-10-14, `e48dabc` plus country/copy fixes)**

- The final Codex review finding was validated: a fully exhausted eligible
  result list could still coexist with coverless published posts. Browse and
  title-search empty messages now explicitly name published posts with covers,
  without claiming no published posts exist or adding a false repair action.
- Both browse/search regressions failed with the old messages and passed with
  the correction. All **28** selected-work component tests passed; the
  filtered-empty continuation regression also confirms that no exhausted-state
  message appears while Load more remains available.
- Final ordered lint, **751** edge/backend tests, **838** component tests
  (one worker), and the production build passed with all four original findings
  repaired and the review follow-up corrected. This supersedes the earlier
  automated counts for the repaired revision, not its browser verification
  gaps. The copy fix was verified with regressions; Codex was not rerun after
  this final correction. Retest empty-state wording when picker eligibility or
  exhaustion semantics change. No new browser/deployment run is claimed.

**Editor query-work review follow-up (2026-10-14, `33b10d7` plus picker/availability fixes)**

- [The closed-picker finding](https://github.com/pooYAYooq/resonance/pull/110#discussion_r4270539405)
  was validated: the picker's paginated query ran on mount, so every editor
  visit hydrated a page of cards and resolved their storage URLs even when the
  dialog was never opened. The query is now skipped while the dialog is closed;
  chosen cards stay in the existing selection cache, so the closed list keeps
  its titles and covers. A component regression asserts the skip, resume, and
  skip-again argument sequence, and a second regression proves a chosen card
  still renders while the picker is closed.
- [The availability-payload finding](https://github.com/pooYAYooq/resonance/pull/110#discussion_r4270539410)
  was validated: the subscription returned hydrated cards plus storage URLs and
  the component read only `postId`. It now returns surviving IDs from a new
  ID-only reader that shares the existing bounded lookup with card hydration, so
  filtering and ordering behavior is unchanged. A regression also pins that a
  coverless published post is still available, since treating it as gone would
  silently drop an existing selection.
- RED/GREEN: three backend assertions plus the affected component and page tests
  failed before the change and passed after it. All **34** profile backend tests
  and **44** focused component/page tests passed.
- Fresh ordered lint, **753** edge/backend tests, **844** component tests (one
  worker), and the production build passed after both fixes.
- Reviewed locally with the CodeRabbit CLI (0.9.0) against `33b10d7` instead of
  spending the remaining Codex review budget. The first pass reported one minor
  finding about the page test double deriving availability from the saved
  selection; the double now answers existence independently, and a second pass
  reported **0** findings. No production-code finding was raised in either pass.
  Local review output is untrusted input and was verified against the code.
- This is automated query, component, and local-review evidence. Reopening the
  picker now returns to the first page of the retained search term, which is a
  deliberate consequence of releasing the query; no browser re-acceptance or
  deployment check was performed.

**Public profile featured-read follow-up (2026-10-14, `d6f6cc6` plus selected-only read)**

- [This finding](https://github.com/pooYAYooq/resonance/pull/110#discussion_r4270165773)
  was validated: the page fetched `getShowcase`, whose no-selection branch reads
  and hydrates the latest three published posts plus their storage URLs, while
  the page rendered only `mode === "selected"` and discarded that result.
- The page now reads a selected-only query, `getSelectedShowcase`, bounded to the
  nine-post maximum through the existing hydration helper. `getShowcase` and its
  latest-three fallback remain for the planned author canvas, so the rendered
  profile, the approved design, and existing showcase coverage are unchanged.
- Three regressions failed before the change and passed after it: the page no
  longer requests the fallback query, saved featured order still renders, and the
  selected-only read returns an empty list without a selection, preserves saved
  order, and drops a deleted selection. All **33** profile backend tests and
  **4** page tests passed.
- Fresh ordered lint, **752** edge/backend tests, **842** component tests
  (one worker), and the production build passed. This is a read-path change with
  no visible behavior, so the result is automated query/page evidence rather
  than a browser observation. Retest when the public profile's featured rendering
  or the author-canvas fallback changes.

**Country search review repair (2026-10-14, `caf74a0` plus search fix)**

- [The follow-up country-search finding](https://github.com/pooYAYooq/resonance/pull/110#discussion_r4269787738)
  reproduced under Turkish default casing: lowercase india, iran, and italy did
  not match the English names, and uppercase BRITAIN did not match the alias.
  All four component regressions failed before the change and passed afterward.
- Search queries, names, and aliases now use the same locale-independent casing.
  The search control's English accessible label uses it as well. Regressions
  verify matching, keyboard selection, focus return, and the selected option
  after reopening. Country membership and accent-matching behavior are unchanged.
- All **46** country-picker tests passed. Fresh ordered lint, **751**
  edge/backend tests, **842** component tests (one worker), and the production
  build passed. These are the latest automated results for the repair, not a
  fresh Turkish-browser or native IME acceptance run. Existing browser evidence
  gaps remain. Retest when country search normalization, aliases, or keyboard
  behavior changes.

**Settings Appearance follow-up (2026-10-10, `345a2f7`)**

- Executed on the current `/settings` design at 375×900 and 1280×900 in
  Windows Chrome 154, attached via the Playwright extension (`mainaccount`),
  signed in as the main demo account. The six runs selected Light, Dark, and
  System at each width; Light/Dark cover both Standard themes.
- Used Tab to reach the named Appearance combobox, then Home/ArrowDown/End
  and Enter to select options through the native control. Selection invoked
  the page's theme behavior: the combobox value, stored preference, rendered
  document theme, and foreground/background colors changed consistently.
  Screenshots show the selected option, visible keyboard focus, and resulting
  light/dark appearance. No direct localStorage assignment or mocked theme
  mutation was used to establish these results.
- After each selection, Tab reached Sign Out and Shift+Tab returned to
  Appearance, with no unintended trap. Sign Out was never activated. Reload
  preserved all six selections. System resolved to Dark, matching the host's
  actual `prefers-color-scheme: dark`; live OS changes and System resolving
  to Light were not exercised. Light was restored after the successful run,
  along with its starting 1280×900 viewport. No account/content data changed.
- Pass is limited to this control's current keyboard/theme behavior. It does
  **not** mean Settings is finished, its responsive layout is universally
  accepted, or its design cannot change. Repeat the Standard matrix and
  screenshot inspection when the control, theme provider, navigation, or
  Settings layout changes; extend widths as needed for the new design.
- Local evidence:
  `/home/studio/projects/resonance-docs-archive/browser-evidence-2026-10-10-settings-appearance/`.
  `settings-appearance-results.json` records selection, persistence, rendered
  theme/colors, focus, geometry, and traversal for every run. The executable
  script and CLI output are preserved alongside
  `settings-appearance-{375|1280}-{light|dark|system}.png`. These are local
  browser artifacts, not new repository tooling or a claim of CI coverage.

**Notifications empty/populated follow-up (2026-10-10, `a970753`)**

- At this tested revision, Notifications remained a placeholder subject
  to redesign. These results neither finalize its layout nor constrain future
  changes. Repeat both states, link navigation, pagination, and screenshot
  inspection after changes to the rows, navigation, focus handling, or paging.
- Ran Windows Chrome 154 against `http://localhost:3000`, main account
  `k176zm7fveh74x08673t5wnqs988ertx` via the Playwright extension. A separate
  visible managed Chrome window authenticated author account
  `k178crg6qv41q70qrhaszw4jm58c256f`. The main account already followed that
  author; no follow/unfollow operations were needed.
- **Empty state Pass:** before fixture creation, checked 375×900 and 1280×900
  in light and dark. Heading and empty-state copy were visible, no notification
  rows or Load more rendered, and navigation traversal did not trap focus.
  There are no actionable controls inside the empty-state main content; no
  recovery-link operation is claimed. Themes here were setup through the
  stored preference, not an additional Appearance operation test.
- **Populated links Pass:** published 13 uniquely numbered disposable posts
  through the second account's editor and Review/Publish UI. At each Standard
  width/theme combination the main account initially received 12 rows, with
  36 row links (avatar, author, and post per row). Tab traversal reached every
  link with `:focus-visible`; screenshots show title focus and wrapping.
  Keyboard-activated avatar/author links opened the correct second-account
  profile, and the first post link opened fixture 13's reader. Back returned
  to Notifications. Visiting the page marks these fixture notifications read
  by existing behavior; no pre-existing notifications were present to alter.
- **Pagination Fail in all four combinations:** reached Load more using Tab
  and activated it with Enter. The list appended the 13th notification and
  exhausted pagination correctly, but the removed button left active focus
  on **`document.body`**, with no visible focus target. DOM observation and
  before/after screenshots are recorded. This is not a passing keyboard-focus
  result. No pagination code change was made during that evidence task;
  the subsequently approved fix and retest are recorded below.
- **Cleanup verified:** deleted only
  `Notification keyboard fixture 01` through `13 2026-10-10` using their
  per-row published deletion confirmations. The first 12 deletions exhausted
  the loaded management slice; reloading exposed fixture 01, which was also
  deleted. After reload the second account had zero published rows and no
  Load more; the main account returned to No notifications yet. No images
  were uploaded, and no pre-existing content, retained demo post, likes,
  comments, or follow relationships were edited.
- Evidence archive:
  `/home/studio/projects/resonance-docs-archive/browser-evidence-2026-10-10-notifications/`.
  `notifications-fixtures.json` lists all 13 titles/post URLs;
  `notifications-empty-results.json` and `notifications-populated-results.json`
  record every combination, traversal, navigation, and the body-focus failure.
  Screenshots use `notifications-empty-{375|1280}-{light|dark}.png` and
  `notifications-populated-{375|1280}-{light|dark}-{title|load-more|appended}.png`.
  Executable browser scripts, CLI output, and cleanup records are local
  artifacts, not additional repository dependencies or CI coverage.

**Notification pagination focus fix (2026-10-10, `0de7547` plus focus fix)**

- Notifications now uses the existing list-focus hook. Keyboard Load more
  restores to the first link (avatar/profile) in the first appended row. A
  settled page with no visible additions restores to replacement Load more,
  a surviving row, or the named empty-list context when no controls remain.
  The empty context is programmatically focusable (`tabIndex=-1`) and adds
  no sequential tab stop or recovery action. Layout and notification behavior
  are otherwise unchanged.
- Real Chromium emits `focusout` with no next target while a removed button
  is still connected. The hook previously treated that as deliberate blur.
  It now classifies null-target departures after the DOM operation, preserving
  removal tracking; known outside targets still clear it immediately. Tests
  cover this event ordering, deliberate blur/departure, filtered pages, empty
  loading renders, nonfinal/final appends, and repeated activation. Existing
  Liked/Saved focus regression suites are included in verification because
  they share the hook. This corrects a browser assumption missed by jsdom.
- Recreated 13 disposable publication fixtures from the same second account.
  All four Standard width/theme combinations repeated the populated traversal,
  link activation, and 12-to-13 pagination check. The browser assertion now
  requires active focus on the appended row's first link, not just an increased
  row count. At 375/1280 in light/dark it passed with visible avatar focus;
  screenshots confirm the target rather than relying only on DOM state.
  Component tests, not this fixture sweep, verify filtered-page fallbacks.
- Deleted the 13 repeat fixtures, including fixture 01 after reloading the
  management slice. The author list returned to zero published rows and no
  Load more. The main account's empty state was rechecked in all four Standard
  combinations. Existing posts and follow/engagement relationships were not
  changed. The repeat batch's distinct post IDs are in its fixture record.
- Post-fix evidence is preserved separately from the earlier failure:
  `/home/studio/projects/resonance-docs-archive/browser-evidence-2026-10-10-notifications-focus-fix/`.
  It includes component RED/GREEN logs, Chromium focus-event tracing,
  `notifications-focus-browser.json`, repeat fixture IDs, cleanup output,
  scripts, and screenshots. Notification acceptance remains revision-specific
  and does not finalize the placeholder's design. Retest after redesign or
  changes to paging, focus behavior, row links, or navigation.
- Repository verification passed lint, 624 edge-runtime tests, 701 component
  tests (single worker), the production build, and changed-file formatting.

**Unsaved-work sign-out choices (2026-10-10, `44149c0`)**

- Executed Discard & sign out and Save & sign out with disposable new-post
  title/body content in the second account at 375×900 and 1280×900, in light
  and dark: eight actual sign-outs. Tab/Enter opened the mobile Navigation
  drawer or reached desktop sidebar Sign Out, opened the named alertdialog,
  and activated each choice. Every active choice matched `:focus-visible`
  inside the dialog and had a bounding box within the viewport. Choice and signed-out
  screenshots accompany the results.
- Every execution cleared the fixture's `new:new` local recovery copy and
  returned to Home. Attempting `/dashboard/drafts` afterward redirected to
  `/auth/login?returnTo=%2Fdashboard%2Fdrafts`. The maintainer signed the same
  account back in between runs so the actual persisted outcome could be checked.
- All four Discard runs left Drafts empty after signing back in. The dark
  mobile and both desktop runs additionally reopened Create and verified an
  empty title and absent recovery copy; the mobile/light run checked absent
  recovery immediately after logout and the empty Drafts list after login.
- All four Save runs produced a draft. Resuming each draft verified the exact
  title **and body**, not just its presence in the list. Each saved fixture was
  then deleted individually through the draft confirmation; the list returned
  to zero rows after each cleanup. Existing publications, engagement, and the
  follow relationship were untouched. No app-code change was needed.
- A harness navigation from an untouched Create page raised a native
  `beforeunload` prompt before the mobile/dark Save script could finish. After
  accepting that navigation, execution continued to the chosen sign-out;
  its focused-choice screenshot, subsequent Login/recovery-state check, and
  exact persisted draft verification provide the evidence. Its initial CLI
  log has no final result object and must not be read as one. Later runs reused
  the already-open empty editor instead of forcing that extra navigation.
  This is consistent with the known empty-paragraph dirty-state limitation
  in `docs/status.md`, not a new sign-out failure.
- Evidence archive:
  `/home/studio/projects/resonance-docs-archive/browser-evidence-2026-10-10-signout-choices/`.
  It contains execution/outcome logs, saved draft IDs, scripts, and screenshots.
  This acceptance covers successful new-post save/discard sign-out in the
  current design, not failed-network saves, every authoring mode, touch, or
  screen-reader behavior. The choice screenshots were taken immediately after
  focus movement, so they are not separate proof of settled focus-ring contrast
  after CSS transitions. Retest after changes to navigation, dialog layout,
  save/discard sequencing, recovery, or authentication. No page design is
  finalized by this evidence.

**Populated-feed follow-up (2026-10-10–11, `c7d624c`)**

- Published 21 disposable `Feed keyboard fixture 01` through `21 2026-10-10`
  posts from the already-followed second account, without changing the follow
  relationship. The feed's initial page contains 20 items. Its Standard matrix
  was executed at 375×900 and 1280×900 in both rendered themes.
- Each initial page had 101 main-content tab stops: five controls per card
  (author link, post-title link, Like, Save, Read More), then Load more. Every
  recorded target was within the viewport after keyboard scrolling. The avatar
  is an image, not another profile link. Accessible control names and toggle
  states were recorded. Focus was sampled after a 250ms settling interval;
  screenshots show the themed outline or border on representative links,
  Like/Save, and Load more. Existing horizontal-scroll/layout observations
  remain with the separately led responsive work, not an automatic fix here.
- Separately activated the author, title, and Read More links with Tab/Enter
  in all four combinations. Author navigated to the second account's profile;
  title and Read More navigated to fixture 21's reader. Browser Back returned
  to Feed. The completed navigation logs, not the interrupted combined probe,
  are the acceptance evidence.
- Like and Save on fixture 21 were each activated and reversed by keyboard
  in every combination. Accessible names and `aria-pressed` changed in both
  directions. Separate navigation runs after reload confirmed both reversals
  persisted (`false`). No demo-post engagement was changed.
- **Pending-action focus Fail in all four combinations:** after Like/Save
  activation the temporarily disabled control lost focus to `document.body`;
  it remained there after the action settled, including after reversal. The
  probe had to Tab back to the settled control to execute the reverse action.
  Successful data mutation is not a focus pass. This concerns shared card
  controls; the subsequently approved regression/fix scope is recorded below.
- **Pagination focus Fail in all four combinations:** Tab/Enter activated
  Load more, the cards were replaced by a loading spinner, and focus fell to
  `document.body`. A MutationObserver recorded that pending state. The final
  page rendered 21 unique fixture titles with no Load more, but focus remained
  on body after settling instead of moving to the appended card. No feed or
  shared-control code was changed during that evidence task. The subsequently
  approved pagination fix is recorded below; pending Like/Save remains open.
  Only the final-page append was exercised, not nonfinal pagination.
- Deleted all 21 fixture posts through the published-post confirmation. The
  initial cleanup deleted 21/20 before a native navigation interruption; its
  log has no complete result object. The continuation records deletion of
  19–01 and a freshly visited author list with zero rows/no Load more. Main
  Feed returned to its empty state with zero cards/no Load more; final-state
  evidence confirms 375px/light and removal of temporary session evidence.
  The cleanup probe also reached the empty Notifications state, checked the
  existing Unfollow state without activating it, and returned to Feed; its
  navigation-interrupted log is not a complete result object. Existing posts,
  the follow relationship, and demo like/comment were preserved.
- Some full-document harness navigations raised native `beforeunload`
  prompts, including on reader/management routes. Their cause was not diagnosed
  in this evidence-only task. Interrupted combined logs are not passing runs;
  completed card/action/pagination and navigation probes are separate. No
  reviewer replies or unrelated warning/layout fixes were made.
- Evidence archive:
  `/home/studio/projects/resonance-docs-archive/browser-evidence-2026-10-11-populated-feed/`.
  It includes fixture URLs, per-combination execution logs, consolidated
  `feed-populated-browser.json` and `feed-navigation-results.json`, scripts,
  settled screenshots, interrupted probes, and cleanup/final-state records.
  This documents the current design, not a finalized Feed layout or page-wide
  acceptance. Retest after changes to cards, pending actions, pagination,
  navigation, or focus behavior. Touch and real screen-reader acceptance remain
  outside this browser evidence.

**Feed pagination focus fix (2026-10-11, `c0a9c54` plus pagination fix)**

- Root cause: changing the cursor makes the current `useQuery` result
  temporarily undefined. Feed previously replaced all loaded cards and the
  focused Load more button with a spinner, then provided no restoration when
  the new page arrived. The fix retains the accumulated cards and pagination
  button through loading. Load more remains focusable with `aria-disabled`
  and an activation guard; its pending label reads Loading more. Initial
  loading and authentication gating still use the existing spinner.
- A request-scoped focus record captures the unique-item boundary and active
  pagination control. A settled page focuses the first enabled control in the
  first appended card; a page with no new unique cards keeps the available
  pagination button, or falls back to the last surviving card/Discover when
  exhausted. Deliberate focus departure cancels restoration, including blur
  without a next target. Chromium's blur-before-disconnection ordering is
  accounted for. The shared collection hook and Like/Save code are untouched;
  this does not fix their pending-focus defect.
- Eleven new component cases cover pending preservation and repeated
  activation, final/nonfinal appends, deduplicated/repeated page boundaries,
  empty/duplicate-only pages, empty scanning exhaustion, Chromium removal
  ordering, and departure to an outside control/card/body. Nine failed on the
  original code; two departure guards already passed. All 18 Feed tests passed
  after the fix. Query cutoff, bounds, bookmark hydration, and auth checks
  remain covered by the existing tests.
- Recreated 21 disposable publications with distinct `Feed pagination fixture`
  titles/IDs. All four Standard combinations passed real final-page pagination.
  A MutationObserver captured **20 retained cards, active pagination focus,
  `aria-disabled` loading, and its status label** during each request. After
  settling, all 21 cards rendered with no Load more, and visible focus landed
  on the author link of appended fixture 01. Screenshots inspected at mobile
  dark and desktop light confirm its visible outline. This retest asserts
  both the pending and settled outcomes, not only row count. Nonfinal and
  filtered-page fallbacks are component evidence, not browser-fixture evidence.
- All 21 repeat publications were deleted; the completed author cleanup log
  records each title and zero remaining rows/no Load more. Main Feed returned
  to empty and its original 375px/light presentation was restored. The main
  cleanup probe encountered the already-recorded native `beforeunload` harness
  interruption; it is not a completed result object. Final empty-feed state is
  checked separately. No existing publications or demo engagement/follow
  relationships were changed, and no new engagement was created in this retest.
- Verification passed lint, 624 edge-runtime tests, 712 component tests,
  production build, and changed-file formatting. A local CodeRabbit review
  raised one minor advisory: a status region mounted together with its loading
  text may not announce reliably in some screen readers; a persistently mounted
  region could improve that. Its boolean `aria-disabled` observation requires
  no change because React serializes the expected strings. The announcement
  advisory is not treated as verified screen-reader behavior or automatically
  folded into this keyboard-focus fix; real screen-reader acceptance remains
  an explicit limitation.
- Archive:
  `/home/studio/projects/resonance-docs-archive/browser-evidence-2026-10-11-feed-pagination-focus-fix/`.
  It preserves RED/GREEN and full verification logs, local review output,
  repeat fixture URLs, pending/settled browser results, screenshots, scripts,
  and cleanup records separately from the prior failures. Feed's current
  design remains changeable; retest pagination after relevant layout, query,
  control, or focus changes. Pending Like/Save is the next separate maintainer
  decision, not resolved by the pagination acceptance.

**Shared Like/Save pending focus fix (2026-10-11, `72cc138` plus toggle fix)**

- The pending transitions in `LikeToggle` and `BookmarkButton` set native
  `disabled`, causing Chrome to blur the active control to body. They now
  preserve focusability with `aria-disabled` during a mutation, while their
  click handlers reject repeated activation. Native `disabled` remains for
  authentication loading, and anonymous redirect/query gating is unchanged.
  There is no forced focus restoration after settlement, so a user who tabs
  elsewhere remains there. Styling, mutations, names, counts, and error toasts
  retain their existing contracts. No Follow or other pending-control redesign
  is implied by this scope.
- Eight new success/failure regressions failed against the native-disabled
  implementation for compact and reader Like/Save, then passed with the fix.
  Deferred mutations keep the actual controls pending while tests check focus,
  Enter/Space/pointer repeat guards, enabled-but-aria-disabled state, settlement,
  and correct labels/pressed states. Existing tests plus new guards cover auth
  loading, anonymous redirects, bookmark reconciliation, and deliberate focus
  departure. Component tests don't simulate Chrome's native disabled-button
  blur, so the enabled-control assertion pins that browser-specific cause.
- Because post and comment likes share `LikeToggle`, a deferred real
  `CommentLikeButton` test also verifies pending focus and one mutation with
  the correct comment ID. Four integration cases combine the real shared
  toggles with `useListFocusRestore`: when a reactive collection slice removes
  a pending row, focus reaches the surviving like/save action or empty-state
  recovery link and stays there after the removed mutation settles. These
  supplement, rather than rely only on, the existing Liked/Saved tests that
  use card doubles. The targeted eight-file run passed 123 tests.
- Published one disposable post from the already-followed author:
  `Pending toggle focus fixture 2026-10-11`
  (`j979n37zey0nnq2zqrhae7vxeh8g0ykh`). At 375/1280 in both themes, keyboard
  activation and reversal of Like and Save passed all **16 action checks**.
  The MutationObserver captured active focus on the same enabled toggle during
  `aria-disabled` pending in every check. After settlement each control still
  had keyboard-visible focus and the expected name/state, within the viewport.
  Settled screenshots inspected at mobile dark and desktop light show the
  themed focus borders. Each following page reload confirmed prior reversals;
  a separate final reload confirmed the last reversal as well.
- Deleted that post alone through author management. The completed cleanup
  records zero published rows/no Load more; a separate main Feed check records
  zero cards/no Load more at the restored 375px/light presentation. Existing
  publications, the follow relationship, and demo like/comment were not
  modified. No new comment fixture was needed; comment-like behavior here is
  component evidence, not a new browser comment acceptance claim.
- Full verification passed lint, 624 edge-runtime tests, 731 component tests
  across 83 files, build, and changed-file formatting. The first gate attempt
  stopped on a raw-link lint error in the new integration test; using Next.js
  `Link` corrected it before the successful full rerun. Local CodeRabbit output
  returned no actionable finding but reported `completed_with_warnings`
  ("unverified findings"); it is not claimed as a clean independent review.
  Its reviewed-file list covers tracked controls and their tests, not the new
  untracked integration file; that file was checked by the tests/lint/build.
- Archive:
  `/home/studio/projects/resonance-docs-archive/browser-evidence-2026-10-11-pending-toggle-focus-fix/`.
  It preserves RED/GREEN/full gate logs, local review limitations, fixture URL,
  pending/settled browser results, screenshots, reversal and cleanup records,
  and the local verification checklist. Retest after changes to pending-state
  semantics, mutation guards, auth gating, card removal, or focus styling.
  Current-design acceptance does not finalize Feed or shared-action design.
  The maintainer deferred the loading-announcement advisory; its current
  disposition is in [known limitations](KNOWN_LIMITATIONS.md). Real
  screen-reader and touch acceptance remain limitations.

### Journey 7: Public author page and catalogue

| Check ID      | Journey / surface / state                   | Check                                    | Width / theme | Result | Evidence / revision | Finding                                                  |
| ------------- | ------------------------------------------- | ---------------------------------------- | ------------- | ------ | ------------------- | -------------------------------------------------------- |
| J7-AuthorPage | `/u/[username]` public author canvas        | keyboard, names, focus, status           | Deep          | Pass   | See J7 notes        | None                                                     |
| J7-Catalogue  | `/u/[username]/posts` public post catalogue | keyboard, names, focus, status, boundary | Deep          | Pass   | See J7 notes        | Query-error boundary and Retry are component-tested only |

**J7 notes (managed Chrome, dark and light)**

- Executed on `feat/public-author-showcase` (commits `d856b5b` and `08e0852`)
  against dev `woozy-spaniel-283`; the delivery, its fixtures, and the browser
  results are recorded in [author page verification](AUTHOR_PROFILE_VERIFICATION.md).
- Keyboard: the signed-out author page traverses navigation, the social links,
  Follow, the catalogue link, and the first card in order, and the catalogue
  traverses its header and card controls in order; each stop shows a visible
  focus ring. Inspected screenshots `focus-home.png` and `focus-card.png` (local
  artifacts).
- Reveal: More of my work appends three cards at a time, announces
  `Showing 6 of 9 posts.` and then `Showing 9 of 9 posts.` through the polite
  status region, moves focus to the first newly revealed card, and is removed
  once everything is shown.
- Deletion focus: live deletion kept the surviving cards and the loaded list
  usable; component regressions pin restoration for a removed card, an emptied
  list (focus moves to the return link or the named empty context), and a
  disconnected Load more control.
- Image recovery: with the image request blocked the card kept its 3:2 frame and
  a `Retry` control that is a sibling of the card link, and the link stayed
  usable; after unblocking, Retry remounted the image and the recovery cleared.
  Both steps were exercised in the browser.
- Layout: at 320, 375, 768, and 1280 in light and dark, document scroll width
  equalled client width on both the author page and the catalogue, so neither
  surface produced horizontal overflow.
- No hydration warning appeared on either surface.
- The catalogue's query-error boundary and its Retry have component-test
  coverage only: a live Convex subscription failure cannot be injected with this
  browser tooling. The `J6-ProfileEditor` query-echo timing used the same
  automated-only pattern.
- Not claimed: screen-reader, touch, Firefox/Safari, or WCAG-conformance
  coverage. This is Chromium keyboard, focus, and layout evidence, consistent
  with the rest of this document.

## Findings

- Auth and editor forms exposed raw Zod messages to users ("Too small:
  expected string to have >=8 characters"). Replaced with plain-English
  messages in `schemas/auth.ts` (name and password) and `schemas/blog.ts`
  (title), with login, sign-up, and create tests updated (RED then GREEN; 117
  targeted tests pass). Also aligned login invalid-state signaling with
  sign-up: `aria-invalid` on the inputs and `data-invalid` on their Fields,
  with new test coverage. Browser-verified: login and sign-up validation shows
  the new messages and the invalid attributes; the editor title message was
  browser-verified during Journey 3. Requested by the maintainer during the
  signed-out pass.
- Login and sign-up labels were not programmatically associated with their
  inputs, so accessible names fell back to placeholder samples (for example
  the sign-up password name was the dot placeholder). Paired `FieldLabel`
  `htmlFor` with input `id`s, moved the tests to `getByLabelText` (RED then
  GREEN; 16/16), and browser-verified: the accessibility trees now report
  textbox Email, Password, and Full Name. Found in the branch review.
- The first list focus-restore implementation tracked a global control index
  and only reacted to shrinking lists. Review found that cards with different
  tag counts could shift the target onto a different control, and that a
  paginated refill of a removed row kept the count unchanged so focus stayed
  on the document body. Reworked to track the focused control's card and
  toggle action, restore when the control disconnects, and prefer the same
  enabled toggle in the successor card, with regression tests for refills,
  tag-count drift, and disabled targets (RED then GREEN; 20/20 in the section
  suites).
- A second review round found two follow-on issues in the reworked list
  focus hook: activating Load more (a control outside the items) sent focus
  back to the first card, and the enabled-only toggle lookup could substitute
  a different toggle action when a sibling was disabled. The hook now moves
  focus to the first appended item after a page loads and resolves the
  recorded toggle ordinal against the full toggle list before requiring it to
  be enabled; both paths are pinned by new regression tests.
- Liked and Saved lists dropped keyboard focus to the document body when the
  focused item was removed (`/liked`, `/saved`). Added a shared
  `useListFocusRestore` hook so focus moves to a surviving control in the
  list, or to the empty state's Browse the Blog recovery link when the list
  empties. Tests written first (RED) and passing (14/14 in the two section
  files); browser-verified with two-item flows that were fully restored to
  their original state. Found during the J2-Collections check.
- A later review round found that a Load more page consisting only of
  deleted or unpublished posts appended no visible card, so the append
  restore never ran: the replacement pagination control was left unfocused,
  or the exhausted list dropped focus to the document body. The hook now
  waits for the pending request, restores to the replacement control, the
  final card, or the empty state action when the list exhausts, and keeps
  tracking the restored control so a later removal restores focus again,
  with regression tests for both sections (RED then GREEN; 36/36 in the
  section suites).
- The editor's Review and Back to editing transitions reset focus to the
  document body (J3-Editor). Fixed during PR review: entering Review focuses
  Back to editing and returning focuses the Review control, covered by editor
  tests.
- Two evidence-completion gaps were closed during PR review: the editor at
  768 in both themes and 320 in light was run at the same checks, and the
  profile save was activated from the keyboard with the values unchanged
  (the form announced "Profile updated" and redirected to the profile).
- The earlier Notifications empty state offered no recovery link (J5-Notifications).
  The approved reader-utilities requirement says empty states recover to
  Discover. Delivered by the notifications slice: the empty state now carries a
  Discover action, and an exhausted page with no visible rows focuses it; see
  [notifications verification](NOTIFICATIONS_EVIDENCE.md).

### Author gallery cards (2026-10-29)

- **Method:** Playwright-managed Chromium 1.63.0 on the Linux workstation, not
  the maintainer's Windows host. Widths 320, 375, 768, 1024, and 1280; light and
  dark themes; keyboard traversal; accessibility-tree names and roles; one-post
  and three-post public author fixtures. No screen reader was used.
- **Gallery geometry:** every card cover measured 3:2 in the browser.
  - One post: 1280 feature 747x614 with a 747x498 cover; 768 tile 306x280 with
    a 306x204 cover (two-column grid, single tile); 320 tile 238x238 with a
    238x159 cover.
  - Three posts: 1280 feature 747x658 with a 747x498 cover and two 361-wide
    tiles; 1024 feature 576x544 with a 576x384 cover and two 276-wide tiles;
    768 all three 306-wide tiles; 320 all three 238-wide tiles.
  - No horizontal overflow at any tested width.
  - All three author cards measured a 10px radius; the cover top corners
    matched the card radius.
- **Responsive lead:** the feature exists only from `lg`; below `lg` the first
  card uses the same tile content as the rest.
- **Section heading:** `Selected articles` stayed on one line at 320 and 375
  (15px, nowrap) with no horizontal overflow.
- **Catalogue:** 320 one column, 768 two columns, 1280 three columns; uniform
  cards, no featured card, 3:2 covers.
- **Keyboard and names:** tab order reached the feature card link, then the two
  supporting tiles; each link exposed the post title as its accessible name and
  a visible 1px focus outline.
- **Feature metadata:** the featured card showed a concise date (`Oct 29, 2026`
  in the preview) and static tags (`Theory`, `Culture`, `Design`, `Nature`,
  `Music`). The tags are labels, not links, so the card kept one anchor and one
  tab stop.
- **Title sizing:** at 320 and 375 the feature title used 17px and stayed on one
  line (`Real Artists are Gems...`), with no horizontal overflow. Long titles
  step to 15px and clamp to two lines visually; the card link keeps the full
  title as its accessible name, so the ellipsis does not hide the title from
  assistive technology.
- **Cover failure:** routing the image optimizer to 404 produced
  "Cover unavailable" and a Retry. The Retry was not inside the card link
  (`nested: false`), and clicking it restored the image.
- **Reduced motion:** with `prefers-reduced-motion: reduce`, hover left the
  cover transform at `none`.
- **Not browser-verified:** a two-post gallery, and the 6/9 reveal states. The
  available fixtures had one and three posts, and no author with a six- or
  nine-item selection. Component tests cover the two-post and reveal states;
  this is a verification gap, not a pass.

## Limitations

- Chromium-only evidence. Firefox and Safari remain recorded limitations of
  the repository, not of this pass.
- No real screen-reader testing. Accessibility-tree inspection covers names,
  roles, and states only.
- Real fault injection (network failure, mutation rejection) is covered by
  component tests where marked; browser rows describe observed browser
  behavior only.
- Scripted navigation intermittently raised a spurious `beforeunload` prompt
  in both browser contexts. No app listener is attached on reader pages when
  probed, the dev-overlay listener found does not call `preventDefault`, and
  no Chrome crash logs exist, so it is classified as a Playwright/Chrome
  artifact as of this pass. Navigation was resumed by accepting the prompt;
  later checks used a fresh-tab pattern that avoids the prompt entirely.
- Touch operability of the drawer could not be verified: programmatic touch
  emulation is unavailable in the attached session and the maintainer had no
  touch device available (accepted 2026-10-10). Keyboard operability at 320,
  375, 768, and 1280 is covered instead.
- The Chrome-extension attach dropped the attached tab on in-page navigations
  and eventually stopped surviving navigations entirely. No Chrome crash dumps
  exist and app console logs showed the correct pages loading, so this is
  tooling instability, not an app defect. The signed-out pass and the
  validation fixes moved to a Playwright-managed Chrome window with a fresh
  profile and no maintainer cookies; checks recorded in each context are
  labeled in the rows, and no evidence was inferred across contexts.
- The author gallery browser pass used one- and three-post fixtures only; the
  two-post and 6/9 reveal states remain component-tested, not browser-verified
  (2026-10-29).

## Re-verification

1. Attach the Windows `resonance` session and open the app.
2. For each changed surface, repeat its row's checks at the listed widths and
   themes using keyboard traversal; inspect names/roles in the accessibility
   tree; verify dialog focus containment and restoration.
3. Update the row: result, date, revision, and any finding disposition.
4. V1-21/V1-23 repeat the checks their changes affect; V1-24 consolidates the
   evidence for release acceptance.
