# Resonance Roadmap

This file is the single source of truth for scope, remaining work, and delivery
status. Product requirements and rationale live in
[`docs/PHASE_3A.md`](docs/PHASE_3A.md) and
[`docs/PHASE_3A_DECISIONS.md`](docs/PHASE_3A_DECISIONS.md). The shipped
capability catalog is [`FEATURES.md`](FEATURES.md). Release history is
[`CHANGELOG.md`](CHANGELOG.md). The short resume note is
[`docs/status.md`](docs/status.md).

## v1.0 definition of done

Resonance v1.0 ships when Phase 3A is complete:

- Every v1.0 item below is Done.
- The automated gate is green on the release revision: lint, edge tests,
  component tests, build, typecheck, formatting, and diff checks.
- Browser acceptance is recorded for the full journey.
- Release readiness items V1-24 to V1-27 are complete.

Phase 3 Platform and the post-1.0 items listed below ship after v1.0. Paste
hardening (V1-05) is a v1.0 exception. Design-session deferrals postpone a
decision to an approved design session and keep their v1.0 membership unless
that session decides otherwise.

## Remaining work for v1.0

27 tracked items. Status values are Todo, In progress, In review, Done,
Pending spec, or Pending design session. Estimates are rough sizes (S, M, L),
not commitments.

### Authoring polish

Source: Track 1 UI and UX audit, recorded in `docs/status.md` at commit
`46d26a3`. Requirements in `docs/PHASE_3A.md` 3A.3.

| ID    | Item                                                        | Status | Estimate |
| ----- | ----------------------------------------------------------- | ------ | -------- |
| V1-01 | Editor title sizing                                         | Done   | S        |
| V1-02 | Published-edit code highlighting                            | Done   | M        |
| V1-03 | Editor and Review width and spacing consistency             | Done   | M        |
| V1-04 | Tag checkbox grid styling                                   | Done   | S        |
| V1-05 | Paste hardening for rejected pasted content                 | Done   | S        |
| V1-06 | Track 1 closure documentation and author browser acceptance | Done   | S        |

Track 1 is closed. Author browser acceptance passed on 2026-10-05 on the merged
revision `3b5102c`: the heading, paste, table/list/code, Review, and
publish/reader journeys plus the editor width, tag grid, published-edit code
highlighting, and contrast and focus checks held at 320, 375, 768, and 1280px in
both themes. Reader checks covered the 700px prose column with its reserved
wide-screen rail, author attribution and engagement placement, underlined links,
and the published H3 and divider scale. No regression was found, so the closure
changed documentation only; the signed-out engagement acceptance gap stays with
V1-09 and the signed-in navbar overflow at 320px stays with V1-23.

### Reader and design system

Source: Track 1 UI and UX audit, coordinated with 3A.4 and 3A.5.

| ID    | Item                             | Status | Estimate |
| ----- | -------------------------------- | ------ | -------- |
| V1-07 | Reader width on wide screens     | Done   | S        |
| V1-08 | Author identity on the post page | Done   | M        |
| V1-09 | Engagement control emphasis      | Done   | S        |
| V1-10 | Reader link distinctness         | Done   | S        |
| V1-11 | Dark-mode contrast and focus     | Done   | M        |
| V1-12 | H3 and Divider content check     | Done   | S        |

Author identity browser acceptance was confirmed on 2026-10-02, including the
stable-width Follow button tested with a different user account and the rest of
the reader design. Accessibility and responsive verification cover the byline,
dates, topic links, and compact Follow action. Implementation is complete on
`feat/reader-author-identity`; PR #85 merged as `4c94efe`. Follow
colors are deferred to V1-21.

Engagement emphasis shipped in PR #86 (merged as `25705e0`). Reader-only outlined
Like/Liked and Save/Saved controls sit after the article, immediately before
discussion; Back to all posts follows discussion. Like reserves only the natural
Liked label width; compact tabular counts grow naturally, with the exact count in
its accessible name. Cards and comment reactions retain compact controls. Browser
verification covered authenticated toggles restored to their original states,
keyboard focus, and 320/375/768/1280px in both themes on the final compact
revision. Like/Liked measured approximately 97px for 0/1, 122px for `999k`, and
128px for `999m`, with stable label transitions at each count and no action-row
overflow. Signed-out redirects have automated coverage; separate signed-out
browser acceptance remains unverified because the Chrome extension denied
creation of an isolated context.

Reader link distinctness was confirmed on 2026-10-04 without a UI change. An
author-created post-body link remained underlined at rest, changed to the primary
color on hover, and stayed visible without clipping at 320, 375, 768, and 1280px
in light and dark themes.

Dark-mode contrast and keyboard focus ship in this change. Keyboard focus now
renders as one solid 1px line: bordered controls recolor their rounded edge,
other targets use an offset outline, and the BlockNote editor canvas shows an
outline where its own stylesheet suppresses one. The authoring title field keeps
a persistent underline, receives one-time initial focus when a writing view
opens, and uses a readable placeholder (4.92:1 dark, 4.59:1 light). Unchecked
tag checkboxes use a stronger border (3.56:1 dark, 4.59:1 light). Browser
verification covered the reader and authoring surfaces in both themes at 320,
375, 768, and 1280px; the pre-existing signed-in navbar overflow at 320px is
unchanged and stays with V1-23.

H3 and Divider content check was confirmed on 2026-10-05 without a code change.
All four H3 body headings in the reviewed published post rendered with their text
at the published 2.333rem serif scale (10.46:1 dark, 17.74:1 light) and the
divider rendered as a 1px hairline at the prose measure, with no clipping at 320,
375, 768, or 1280px in either theme. The audit's perceived gap was an empty
authored paragraph adjacent to the divider, not a lost block or a stylesheet
defect.

### Management and navigation

Source: Track 4 (recorded in `FEATURES.md` at commit `46d26a3`),
`docs/PHASE_3A.md` 3A.3 scope, decision 3A-014. Includes the approved dense
management-row requirement from the 3A.3 detailed requirements.

| ID    | Item                                                              | Status       | Estimate |
| ----- | ----------------------------------------------------------------- | ------------ | -------- |
| V1-13 | Published management rows and deletion UI with clear confirmation | Done         | M        |
| V1-14 | Draft management rows and deletion confirmation check             | Done         | S        |
| V1-15 | Unsaved-exit guards beyond target switches                        | Pending spec | M        |
| V1-16 | Accessibility evidence pass                                       | Todo         | M        |

V1-13 verification on `feat/published-management-rows` (2026-10-05): approved
desktop rows and mobile title/thumbnail/metadata/action composition; existing
owner-authorized deletion and 12-item pagination preserved. Component coverage
includes cancellation, pending/duplicate protection, errors and retry, auth
guards, and focus restoration when query updates arrive before or after mutation
resolution. Browser checks passed at 320, 375, 700, 900, and 1280px in both
themes for dialog bounds, keyboard focus trapping, Escape cancellation, and
trigger restoration. A purpose-created disposable post was published and
deleted through the confirmation UI; the row disappeared, success feedback
appeared, and focus moved to the next Edit link. No pre-existing post was deleted.
Lint, 503 edge-runtime tests, 536 component tests, and production build passed.
Known fixture cleanup/timer warnings and expected failure-path logs remain.
Both CodeRabbit passes reported zero findings on tracked changes. A fresh-agent
review included the new untracked files; its neighboring-row focus race was
reproduced with failing next/previous tests and fixed, and its dark confirmation
hover finding was corrected locally and checked in isolated Chromium in both
themes. Browser pending/error/retry, empty-state deletion, and pagination cases
are covered by component tests rather than real-data browser fault injection.
Shipped in PR #92; the diagnostics follow-up shipped in PR #93. Both are merged.
Narrow metadata intentionally ellipsizes; search,
filters, sorting, layout switching, sharing, and batch deletion remain deferred.

V1-14 verification on `feat/draft-management-rows` (2026-10-06): Drafts page and
rows match My Posts' responsive composition, with Resume replacing Edit, a
neutral blank cover fallback, Last saved dates, and no excerpts. Owner-scoped
cover URL hydration and 12-item pagination are preserved. The user reported
browser acceptance for blank covers, Resume, deletion confirmation/functionality,
and responsive/both-theme review; pagination could not be manually exercised due
to insufficient drafts. Component tests cover load-more/LoadingMore/exhaustion,
authentication guards, cancellation, pending/duplicate protection, errors/retry,
and neighboring/empty-state focus before and after mutation resolution. Backend
coverage verifies cursor pagination, owner/published isolation, and stored,
absent, and deleted cover URLs. The merged revision re-passed lint, 504
edge-runtime tests, 552 component tests, and the production build on `main` on
2026-10-06. Existing fixture cleanup/timer warnings and expected failure-path
logs remain. No new agent browser deletion was performed. CodeRabbit's
tracked-diff review found only a roadmap status inconsistency, corrected in the
PR; a manual pass covered the new untracked row and its tests. A Codex P1 finding
corrected the post-merge resume note. Shipped in
[PR #94](https://github.com/pooYAYooq/resonance/pull/94), merged as `5426bcd`.

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

V1-21 includes the deferred Follow/Following color treatment and the
light-theme contrast observations recorded with V1-11: primary button text at
3.12:1 and the focus border at 2.96:1. The reader/Review parity and shared
navigation changes shipped in PR #96 (merged as `4a306af`) and replace inline mobile account
controls with a drawer below 768px, addressing the layout that caused the
previously recorded signed-out navbar overflow at 320px and 375px and signed-in
overflow at 320px. Authenticated responsive navigation received browser
acceptance; signed-out browser acceptance at 320px and 375px remains unverified
and stays with V1-23. This bounded correction does not complete the broader
responsive and interaction polish item; its status remains Todo.

The late PR #96 review follow-up shipped in PR #97 (merged as `d2f9b3d`): the
preview identity query is locally gated on resolved authentication, and
published-edit Review previews a pending update date clamped against the saved
publication and update timestamps. The maintainer approved retaining Dashboard
in both sidebar and drawer; this clarifies access to the existing page without
approving its deferred Overview redesign (see `docs/PHASE_3A_DECISIONS.md`).
The drawer's visible Navigation heading remains unchanged and is deferred to a
later UI refinement.

V1-22 gained a discovered defect from the reader/Review parity browser
verification: a malformed editor target id in the `/create` URL (`editPostId`
or `draftId`), for example through a hand-edited or corrupted link, reached the
backing Convex query unvalidated. The rejected argument failed argument
validation and the page crashed with a client-side exception instead of showing
an unavailable state. The bounded fix shipped in PR #99 (merged as `60c992b`):
both lookup queries (`getDraftById`, `getPublishedPostForEditing`) accept a
string id and resolve it with `ctx.db.normalizeId`; an unparseable id now
returns null and renders the existing unavailable state, and a rejected pending
transition preserves the in-editor document. Backend and component regression
tests cover direct navigation and pending transitions; browser acceptance also
covered malformed direct navigation for both parameters, a dual-target request,
a history Back transition with unsaved content, and Review preservation after
rejection, with no client-side exceptions. The remaining shared page-state work
of V1-22 stays Todo.

### Release readiness

Source: release tasks for Phase 3A.3, recorded at commit `46d26a3` in
`docs/status.md`.

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

- 1.9 Trending and Popular. Revisit when the ranking formula and time window
  are defined.
- 1.10 User Activity Feed. Revisit when profiles have enough activity and
  privacy rules exist.
- 1.11 Polish, reading time and share links. Revisit when distribution becomes
  a priority.

### Optional editor enhancements

These are optional enhancements, not the required accessibility work. Required
keyboard, focus, and mobile accessibility stays in v1.0 through V1-16 and
V1-23.

- Richer slash-menu focus management and shortcut discoverability.
- Always-available in-page Discard. Deferred by decision 3A-021.

### Deferred boundaries

- Dashboard Overview purpose and composition.
- Hot ranking formula and time window.
- Server autosave, unpublish, revision history, and detailed Create and Edit
  composition. Silent local recovery shipped instead.
- Avatar upload, custom storage, and new public identity fields.
- Follower and following directories, activity feeds, recommendation
  infrastructure, semantic and AI search, and broader analytics or notification
  infrastructure.

### Unscheduled

Follow-ups requested during reader engagement acceptance (2026-10-03), not part
of V1-09 or committed v1.0 scope:

- Top-of-article link to the comments section beside estimated reading time.
  Coordinate with the deferred Phase 1C reading-time polish; no redundant
  comments shortcut directly above the discussion.
- Link commenter identity to the comment writer's public profile.

- Reply to comments: one-level threading with `parentId` and an inline reply
  form.
- Custom 404 page: branded not-found page with navigation.
- About and contact pages: static `/about` and a `/contact` form.
- Empty-state rollout audit: `EmptyState` already covers profiles, Discover
  results, feed, liked, saved, notifications, drafts, and published lists. Audit
  the remaining uncovered surfaces, such as comments and any search or
  pagination states, as an optional rollout. This is separate from the required
  page-state work in V1-22.
- Custom avatar upload: `avatarStorageId` plus upload UI; provider and DiceBear
  avatars already work.
- SEO phase 2: JSON-LD structured data, `sitemap.xml`, and `robots.ts`.
- Loading skeletons phase 2: content-shaped skeletons for the `/blog` listing
  and comments.

### Deferred product specs

- Cancel and save-draft options for new posts and published edits.
- Cover size limit decision.
- Author-controlled cover position inside the fixed cover crop: 16:9 on cover
  surfaces and 3:2 on cards since the 2026-09-30 content width decision. A
  stored focal point applied across the editor, Review, cards, and the reader.
- Wide-screen reader rail contents: a content map first, then related posts and
  more from the author. The article frame reserves the space from `xl` up; the
  contents wait on a design session.

## Design-session deferrals

These postpone a decision to an approved design session and keep their v1.0
membership unless that session decides otherwise.

- Exact supporting palette, compact footer, and final responsive treatments.
  The v1.0 visual system (V1-21 and V1-23) establishes the structure; the final
  treatments are settled in the design session. The published typography scale
  and the content width were decided on 2026-09-30 and shipped in PR #82; the
  resume note in `docs/status.md` records the delivery.

## Pending scope

- V1-15 unsaved-exit guards: in v1.0, scope pending a dedicated spec.
- V1-16 accessibility evidence: in v1.0, the exact evidence set is confirmed
  when scoped.

## How to update this file

When a change ships, alters scope, or defers an item, update its row here and
the linked documents in the same PR. Keep this file the only place that tracks
scope and progress; do not recreate status tables in `FEATURES.md` or
`docs/status.md`. Use the source references to keep every commitment traceable.
