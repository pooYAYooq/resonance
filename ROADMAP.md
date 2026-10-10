# Resonance Roadmap

The source of truth for scope, remaining work, estimates, dependencies, and
completion in this revision. Product requirements live in
[PHASE_3A.md](docs/PHASE_3A.md) and [decisions](docs/PHASE_3A_DECISIONS.md).
[FEATURES.md](FEATURES.md) describes capabilities; [status](docs/status.md)
holds the resume point. GitHub owns PR review and merge state.

## v1.0 definition of done

Resonance v1.0 requires Phase 3A complete (decision 3A-024):

- Every v1.0 item below is Done.
- The release revision passes lint, edge tests, component tests, build/typecheck,
  formatting, and diff checks.
- Browser acceptance is recorded for the full journey.
- Release readiness items V1-24 to V1-27 are complete.

Phase 3 Platform and post-1.0 items stay outside v1.0. Paste hardening (V1-05)
is the explicit v1.0 exception. Design-session deferrals retain their v1.0
membership until an approved decision changes it.

## v1.0 delivery scope

27 tracked items. Status values: Todo, In progress, Done, Pending spec, and
Pending design session. Done means agreed scope implemented and verified in
this revision, with accepted limitations recorded. It does not mean merged,
deployed, or released. Estimates (S, M, L) are rough sizes, not commitments.

Historical verification details for completed work are preserved in
[the PR #103 roadmap revision](https://github.com/pooYAYooq/resonance/blob/d2d5fed/ROADMAP.md).
Its old review-state narratives are historical, not current status. Current
[accessibility evidence](docs/ACCESSIBILITY.md) and
[known limitations](docs/KNOWN_LIMITATIONS.md) take precedence for those topics.

### Authoring polish

Source: Track 1 audit in `docs/status.md` at `46d26a3`; requirements in
`docs/PHASE_3A.md` 3A.3.

| ID    | Item                                                        | Status | Estimate |
| ----- | ----------------------------------------------------------- | ------ | -------- |
| V1-01 | Editor title sizing                                         | Done   | S        |
| V1-02 | Published-edit code highlighting                            | Done   | M        |
| V1-03 | Editor and Review width and spacing consistency             | Done   | M        |
| V1-04 | Tag checkbox grid styling                                   | Done   | S        |
| V1-05 | Paste hardening for rejected pasted content                 | Done   | S        |
| V1-06 | Track 1 closure documentation and author browser acceptance | Done   | S        |

Track 1 acceptance passed on `3b5102c` at 320/375/768/1280px in both themes.
The historical record above retains the journeys and outcomes; later
accessibility checks and responsive limitations have their own linked records.

### Reader and design system

Source: Track 1 audit, coordinated with 3A.4 and 3A.5.

| ID    | Item                             | Status | Estimate |
| ----- | -------------------------------- | ------ | -------- |
| V1-07 | Reader width on wide screens     | Done   | S        |
| V1-08 | Author identity on the post page | Done   | M        |
| V1-09 | Engagement control emphasis      | Done   | S        |
| V1-10 | Reader link distinctness         | Done   | S        |
| V1-11 | Dark-mode contrast and focus     | Done   | M        |
| V1-12 | H3 and Divider content check     | Done   | S        |

Follow colors and light-theme contrast observations remain with V1-21.
Later engagement acceptance is recorded in
[accessibility Journey 2](docs/ACCESSIBILITY.md#journey-2-engage). The H3/divider check found
an empty authored paragraph, not a missing block or stylesheet defect.

### Management and navigation

Source: Track 4 in `FEATURES.md` at `46d26a3`, 3A.3 requirements, and decision
3A-014. Includes the approved dense management-row requirement.

| ID    | Item                                                              | Status | Estimate |
| ----- | ----------------------------------------------------------------- | ------ | -------- |
| V1-13 | Published management rows and deletion UI with clear confirmation | Done   | M        |
| V1-14 | Draft management rows and deletion confirmation check             | Done   | S        |
| V1-15 | Unsaved-exit guards beyond target switches                        | Done   | M        |
| V1-16 | Accessibility evidence pass                                       | Done   | M        |

- Management rows and deletion: [PR #92](https://github.com/pooYAYooq/resonance/pull/92),
  [diagnostics #93](https://github.com/pooYAYooq/resonance/pull/93), and
  [drafts #94](https://github.com/pooYAYooq/resonance/pull/94). Narrow metadata
  intentionally ellipsizes. Search, filters, sorting, layout switching,
  sharing, and batch deletion remain deferred. Browser fault-injection and
  draft-pagination gaps are recorded in [known limitations](docs/KNOWN_LIMITATIONS.md).
- Exit guards and pending published updates: [PR #101](https://github.com/pooYAYooq/resonance/pull/101).
  Scope includes app links, history, target switches, sign-out, native unload,
  Start fresh, and Cancel update. Older-browser recovery limits remain in
  [known limitations](docs/KNOWN_LIMITATIONS.md); behavior is in
  [authoring architecture](docs/ARCHITECTURE.md).
- Accessibility: [PR #103](https://github.com/pooYAYooq/resonance/pull/103) and
  [executed evidence](docs/ACCESSIBILITY.md). Agreed keyboard/focus/name and
  mobile-navigation scope is complete. Touch and real screen-reader acceptance
  are not claimed; the loading-announcement advisory is explicitly deferred.
  Owner handoffs: V1-18 for notification empty-state recovery, V1-21/V1-23 for
  visual/responsive polish, V1-24 for release consolidation. These checks do
  not finalize unfinished page designs.

### Profiles and engagement

Source: `docs/PHASE_3A.md` 3A.4, delivery slice map slice 4.

| ID    | Item                                             | Status | Estimate |
| ----- | ------------------------------------------------ | ------ | -------- |
| V1-17 | Stronger public profile identity and author work | Todo   | M        |
| V1-18 | Compact, actionable Notifications                | Todo   | M        |
| V1-19 | Saved and Liked collection presentation          | Todo   | S        |
| V1-20 | Context-specific post-card variants              | Todo   | M        |

### Visual system and responsive polish

Source: `docs/PHASE_3A.md` 3A.5.

| ID    | Item                                                 | Status | Estimate |
| ----- | ---------------------------------------------------- | ------ | -------- |
| V1-21 | Typography, color, surface, spacing, density systems | Todo   | L        |
| V1-22 | Shared page-state language                           | Todo   | M        |
| V1-23 | Responsive and interaction polish                    | Todo   | M        |

- V1-21 includes Follow/Following colors and the light-theme observations
  from V1-11: primary button text at 3.12:1 and focus border at 2.96:1.
- V1-22 retains broader page-state work. Malformed editor-target recovery is
  already implemented in [PR #99](https://github.com/pooYAYooq/resonance/pull/99).
- V1-23 retains broader responsive work and signed-out 320/375px acceptance.
  Shared responsive navigation and reader/Review parity are implemented in
  [PR #96](https://github.com/pooYAYooq/resonance/pull/96) and
  [#97](https://github.com/pooYAYooq/resonance/pull/97), with the accessible
  drawer-heading refinement recorded in the historical evidence. Keeping
  Dashboard in the drawer/sidebar does not approve its Overview redesign.

### Release readiness

Source: Phase 3A.3 release tasks in `docs/status.md` at `46d26a3`.

| ID    | Item                            | Status | Estimate |
| ----- | ------------------------------- | ------ | -------- |
| V1-24 | FEATURES.md acceptance matrix   | Todo   | S        |
| V1-25 | package.json release checks     | Todo   | S        |
| V1-26 | Human review checklist          | Todo   | S        |
| V1-27 | Release PR and worktree cleanup | Todo   | S        |

## Post-1.0, not committed

Each item keeps its original condition or note.

### Phase 3 Platform

- Admin role and moderation. Later, High.
- AI features. Later, High.
- Subscriptions and tipping. Later, High.
- Email digest. Later, Medium.

### Deferred Phase 1C

- 1.9 Trending and Popular. Revisit when ranking formula and time window are defined.
- 1.10 User Activity Feed. Revisit when profiles have enough activity and privacy rules exist.
- 1.11 Polish, reading time and share links. Revisit when distribution becomes a priority.

### Optional editor enhancements

Required keyboard, focus, and mobile accessibility stays in v1.0 through
V1-16 and V1-23. Optional enhancements:

- Richer slash-menu focus management and shortcut discoverability.
- Always-available in-page Discard. Deferred by decision 3A-021.

### Deferred boundaries

- Dashboard Overview purpose and composition.
- Hot ranking formula and time window.
- Server autosave, unpublish, revision history, and detailed Create/Edit composition.
  Silent local recovery is implemented instead.
- Avatar upload, custom storage, and new public identity fields.
- Follower/following directories, activity feeds, recommendation infrastructure,
  semantic/AI search, and broader analytics or notification infrastructure.

### Unscheduled

Reader engagement follow-ups requested on 2026-10-03, outside V1-09 and committed v1.0 scope:

- Top-of-article comments link beside estimated reading time, coordinated with
  Phase 1C reading-time polish. No redundant shortcut directly above discussion.
- Link commenter identity to the comment writer's public profile.

Other uncommitted work:

- One-level comment replies with `parentId` and an inline reply form.
- Branded 404 with navigation; static `/about` and a `/contact` form.
- Optional `EmptyState` rollout audit for comments and remaining search/pagination
  states. Profiles, Discover, feed, liked, saved, notifications, drafts, and
  published lists already use it. Separate from required V1-22 page-state work.
- Custom avatar upload with `avatarStorageId`; provider/DiceBear avatars already work.
- SEO phase 2: JSON-LD, `sitemap.xml`, and `robots.ts`.
- Content-shaped skeletons for `/blog` and comments.

### Deferred product specs

- Cancel and save-draft options for new posts and published edits: existing
  exit-guard/pending-update behavior is covered by V1-15; further composition
  remains with the deferred Create/Edit design scope.
- Cover size limit decision.
- Author-controlled cover focal point across editor, Review, cards, and reader:
  16:9 cover surfaces and 3:2 cards per the 2026-09-30 decision.
- Wide-screen reader rail contents: content map first, related posts and more
  from the author later. The article reserves space from `xl`; contents await design.

## Design-session deferrals

These retain v1.0 membership until an approved design decision changes it:

- Exact supporting palette, compact footer, and final responsive treatments.
  V1-21/V1-23 establish the structure; a design session settles treatments.
  Published typography and content width were decided on 2026-09-30 and
  implemented in [PR #82](https://github.com/pooYAYooq/resonance/pull/82).

## Engineering follow-ups

- Durable Playwright connection guide: postponed until after the accessibility
  work; estimate M. Await maintainer scope before implementation.
- Sibling storage-cleanup guard in `convex/pendingUploads.ts`: investigate only
  after reproducing a trigger and a failing test. The post-deletion cleanup
  correction is in [PR #104](https://github.com/pooYAYooq/resonance/pull/104);
  it does not establish that this sibling path needs the same fix.

## How to update this file

Update affected rows and references in the same PR that changes implementation,
scope, or deferrals. Keep notes brief and preserve unique requirements and
evidence before shortening them. Do not copy this table into status or feature
docs, or add PR-lifecycle states that need a post-merge bookkeeping change.
