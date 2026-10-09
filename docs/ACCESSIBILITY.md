# Accessibility Evidence

Behavioral accessibility evidence for v1.0, recorded by the V1-16 pass. This is
not a WCAG conformance claim. Method and per-surface results live here; scope
requirements live in `ROADMAP.md` and the active local spec under
`docs/superpowers/`.

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

- Chromium 154 (Windows x64), attached over the maintainer's Chrome extension
  and driven through the Windows `resonance` Playwright session. No new
  repository tooling.
- Per surface: keyboard-only traversal, accessibility-tree name/role
  inspection, visible focus observation, and dialog focus behavior. Tree
  inspection is not screen-reader acceptance; no screen reader was used.
- Tiers: Standard = 375px and 1280px, light and dark. Deep = Standard plus
  320px and 768px. Additional widths are named per row.
- Chrome only. Firefox and Safari are not verified by this pass.
- Touch: programmatic touch emulation is unavailable in the attached session
  (CDP is denied and the CLI has no touch primitive). Narrow-width
  operability is checked with the keyboard; human touch acceptance is
  required for navigation and is recorded in the results when performed.
- Fixtures: purpose-created drafts, posts, and comments only, deleted after
  use with cleanup recorded. Pre-existing content is never modified.
  Sign-out/sign-in transitions are performed by the maintainer on request.
- Base revision: `d68b9c9` on `accessibility/behavioral-evidence` (started
  2026-10-09). Evidence rows recorded before batch commits name this base plus
  the dirty worktree; committed ranges are added as batches land.
- Baseline on 2026-10-09 at `d68b9c9`: lint, 623 edge-runtime tests, 654
  component tests (single worker), and the production build passed.

## Results

Result values: Pass, Fail, Blocked, Not applicable. Blocked rows name the
reason. Rows marked `Blocked - Not executed` are placeholders, not evidence.

### Journey 1: Discover and read

| Check ID    | Journey / surface / state                     | Check                  | Width / theme | Result                 | Evidence / revision | Finding |
| ----------- | --------------------------------------------- | ---------------------- | ------------- | ---------------------- | ------------------- | ------- |
| J1-Home     | `/` marketing home                            | keyboard, names, focus | Standard      | Blocked - Not executed |                     |         |
| J1-Discover | `/blog` search, topics, latest, empty/results | keyboard, names, focus | Standard      | Blocked - Not executed |                     |         |
| J1-Post     | `/blog/[postId]` article and actions          | keyboard, names, focus | Deep          | Blocked - Not executed |                     |         |
| J1-Profile  | `/u/[userId]` profile and activity            | keyboard, names, focus | Standard      | Blocked - Not executed |                     |         |

### Journey 2: Engage

| Check ID       | Journey / surface / state                                        | Check                              | Width / theme | Result                 | Evidence / revision | Finding |
| -------------- | ---------------------------------------------------------------- | ---------------------------------- | ------------- | ---------------------- | ------------------- | ------- |
| J2-Auth        | `/auth/login`, `/auth/sign-up`                                   | keyboard, names, focus, validation | Standard      | Blocked - Not executed |                     |         |
| J2-Actions     | post like, save, follow, comments; anonymous redirect and return | keyboard, names, focus, states     | Deep          | Blocked - Not executed |                     |         |
| J2-Feed        | `/feed` feed and empty states                                    | keyboard, names, focus             | Standard      | Blocked - Not executed |                     |         |
| J2-Collections | `/liked`, `/saved`, focus after removal                          | keyboard, names, focus             | Standard      | Blocked - Not executed |                     |         |

### Journey 3: Author

| Check ID  | Journey / surface / state                                                       | Check                                   | Width / theme | Result                 | Evidence / revision | Finding |
| --------- | ------------------------------------------------------------------------------- | --------------------------------------- | ------------- | ---------------------- | ------------------- | ------- |
| J3-Editor | `/create` new, draft, and published-edit modes; title, body, menus, tags, media | keyboard, names, focus                  | Deep          | Blocked - Not executed |                     |         |
| J3-Review | Review/Back, publish/update, pending update                                     | keyboard, names, focus, dialog behavior | Deep          | Blocked - Not executed |                     |         |
| J3-Guards | exit, recovery, document-switch, sign-out guards                                | keyboard, names, focus, dialog behavior | Deep          | Blocked - Not executed |                     |         |

### Journey 4: Manage

| Check ID     | Journey / surface / state                        | Check                                   | Width / theme | Result                 | Evidence / revision | Finding |
| ------------ | ------------------------------------------------ | --------------------------------------- | ------------- | ---------------------- | ------------------- | ------- |
| J4-Published | `/dashboard/published` rows, actions, pagination | keyboard, names, focus                  | Deep          | Blocked - Not executed |                     |         |
| J4-Drafts    | `/dashboard/drafts` rows, actions, pagination    | keyboard, names, focus                  | Deep          | Blocked - Not executed |                     |         |
| J4-Delete    | deletion confirmation and focus restoration      | keyboard, names, focus, dialog behavior | Deep          | Blocked - Not executed |                     |         |
| J4-Dashboard | `/dashboard` overview                            | keyboard, names, focus                  | Standard      | Blocked - Not executed |                     |         |
| J4-Analytics | `/dashboard/analytics`                           | keyboard, names, focus                  | Standard      | Blocked - Not executed |                     |         |

### Journey 5: Navigate and account

| Check ID         | Journey / surface / state                                | Check                                   | Width / theme | Result                 | Evidence / revision | Finding |
| ---------------- | -------------------------------------------------------- | --------------------------------------- | ------------- | ---------------------- | ------------------- | ------- |
| J5-Nav           | navbar, sidebar, mobile drawer; signed-in and signed-out | keyboard, names, focus, dialog behavior | Deep          | Blocked - Not executed |                     |         |
| J5-Menus         | account and theme menus; notification bell from editor   | keyboard, names, focus, guard context   | Deep          | Blocked - Not executed |                     |         |
| J5-Notifications | `/notifications` list and empty state                    | keyboard, names, focus                  | Standard      | Blocked - Not executed |                     |         |
| J5-Settings      | `/settings` appearance and account                       | keyboard, names, focus                  | Standard      | Blocked - Not executed |                     |         |
| J5-ProfileEdit   | `/profile/edit` validation and save                      | keyboard, names, focus                  | Standard      | Blocked - Not executed |                     |         |
| J5-SignOut       | sign-out confirmation choices                            | keyboard, names, focus, dialog behavior | Standard      | Blocked - Not executed |                     |         |

## Findings

None recorded yet.

## Limitations

- Chromium-only evidence. Firefox and Safari remain recorded limitations of
  the repository, not of this pass.
- No real screen-reader testing. Accessibility-tree inspection covers names,
  roles, and states only.
- Touch behavior needs human acceptance; it cannot be proven through the
  attached session.
- Real fault injection (network failure, mutation rejection) is covered by
  component tests where marked; browser rows describe observed browser
  behavior only.

## Re-verification

1. Attach the Windows `resonance` session and open the app.
2. For each changed surface, repeat its row's checks at the listed widths and
   themes using keyboard traversal; inspect names/roles in the accessibility
   tree; verify dialog focus containment and restoration.
3. Update the row: result, date, revision, and any finding disposition.
4. V1-21/V1-23 repeat the checks their changes affect; V1-24 consolidates the
   evidence for release acceptance.
