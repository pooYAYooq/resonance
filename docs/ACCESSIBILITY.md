# Accessibility Evidence

Behavioral accessibility evidence for v1.0, recorded by the V1-16 pass. This is
not a WCAG conformance claim. Method and per-surface results live here; scope
requirements live in `ROADMAP.md`.

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

| Check ID       | Journey / surface / state                                        | Check                              | Width / theme | Result                                   | Evidence / revision | Finding                                     |
| -------------- | ---------------------------------------------------------------- | ---------------------------------- | ------------- | ---------------------------------------- | ------------------- | ------------------------------------------- |
| J2-Auth        | `/auth/login`, `/auth/sign-up`                                   | keyboard, names, focus, validation | Standard      | Pass (signed-out states)                 | See Journey 2 notes | OAuth handoff not exercised                 |
| J2-Actions     | post like, save, follow, comments; anonymous redirect and return | keyboard, names, focus, states     | Deep          | Pass                                     | See Journey 2 notes | None                                        |
| J2-Feed        | `/feed` feed and empty states                                    | keyboard, names, focus             | Standard      | Fail (populated focus); empty state Pass | See Journey 2 notes | Pending Like/Save and pagination lose focus |
| J2-Collections | `/liked`, `/saved`, focus after removal                          | keyboard, names, focus             | Standard      | Pass                                     | See Journey 2 notes | Fixed focus restoration after removal       |

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
  focus to the empty state's Browse the Blog recovery link. A Load more page
  that appends no visible posts keeps focus on the replacement pagination
  control, or moves it to the final card or the empty state when the list
  exhausts. Refilled pages and disabled successor controls are covered by
  regression tests. Toggles were restored to their original state. The fixes
  are recorded under Findings.
  PR review follow-up: the hook now refreshes the focused card's position and
  the focused Load more control's item count after reactive list changes.
  Component regression tests cover insertion and removal ahead of the same
  connected control in both collections; this is automated evidence, not a
  new browser pass. This behavior applies to the current Liked/Saved design
  and may need revisiting as those pages and their controls evolve; it does
  not establish accessibility completion for their future designs.
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

| Check ID         | Journey / surface / state                                | Check                                   | Width / theme | Result | Evidence / revision | Finding                                                      |
| ---------------- | -------------------------------------------------------- | --------------------------------------- | ------------- | ------ | ------------------- | ------------------------------------------------------------ |
| J5-Nav           | navbar, sidebar, mobile drawer; signed-in and signed-out | keyboard, names, focus, dialog behavior | Deep          | Pass   | See notes           | None                                                         |
| J5-Menus         | account and theme menus; notification bell from editor   | keyboard, names, focus, guard context   | Deep          | Pass   | See notes           | None                                                         |
| J5-Notifications | `/notifications` list and empty state                    | keyboard, names, focus                  | Standard      | Pass   | See notes           | Fixed pagination focus; no empty-state recovery link (V1-18) |
| J5-Settings      | `/settings` appearance and account                       | keyboard, names, focus                  | Standard      | Pass   | See notes           | None                                                         |
| J5-ProfileEdit   | `/profile/edit` validation and save                      | keyboard, names, focus                  | Standard      | Pass   | See notes           | None                                                         |
| J5-SignOut       | sign-out confirmation choices                            | keyboard, names, focus, dialog behavior | Standard      | Pass   | See notes           | None                                                         |

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
- J5-ProfileEdit: groups and fields are named (disabled Email with
  explanation, Display Name, Bio with a live character counter). Save Changes
  was activated from the keyboard with the values unchanged (nothing was
  modified) during PR review; the form announced "Profile updated" and
  redirected to the profile.
- J5-SignOut: with unsaved authoring content, the sidebar Sign Out opens a
  named alertdialog ("Sign out?") with Cancel, Discard & sign out, and Save &
  sign out choices and focus inside. Escape closes it, keeps the session, and
  preserves the editor content. That initial check did not execute either
  sign-out choice; the follow-up below records both actual outcomes.
  Touch acceptance for the drawer remains an
  accepted limitation (no touch device available).

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

- Current implementation only: Notifications remains a placeholder subject
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
  controls and needs its own approved regression/fix scope.
- **Pagination focus Fail in all four combinations:** Tab/Enter activated
  Load more, the cards were replaced by a loading spinner, and focus fell to
  `document.body`. A MutationObserver recorded that pending state. The final
  page rendered 21 unique fixture titles with no Load more, but focus remained
  on body after settling instead of moving to the appended card. No feed or
  shared-control code was changed; these failures await the maintainer's
  decision. Only the final-page append was exercised, not nonfinal pagination.
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
- The Notifications empty state offers no recovery link (J5-Notifications).
  The approved reader-utilities requirement says empty states recover to
  Discover; recorded for V1-18's notifications slice rather than fixed here.

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

## Re-verification

1. Attach the Windows `resonance` session and open the app.
2. For each changed surface, repeat its row's checks at the listed widths and
   themes using keyboard traversal; inspect names/roles in the accessibility
   tree; verify dialog focus containment and restoration.
3. Update the row: result, date, revision, and any finding disposition.
4. V1-21/V1-23 repeat the checks their changes affect; V1-24 consolidates the
   evidence for release acceptance.
