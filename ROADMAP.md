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
`46d26a3`; local supplemental detail in
`docs/superpowers/plans/2026-09-20-media-review-correctness.md`. Requirements in
`docs/PHASE_3A.md` 3A.3.

| ID    | Item                                                        | Status                 | Estimate |
| ----- | ----------------------------------------------------------- | ---------------------- | -------- |
| V1-01 | Editor title sizing                                         | Done                   | S        |
| V1-02 | Published-edit code highlighting                            | Todo                   | M        |
| V1-03 | Editor and Review width and spacing consistency             | Pending design session | M        |
| V1-04 | Tag checkbox grid styling                                   | Todo                   | S        |
| V1-05 | Paste hardening for rejected pasted content                 | Todo                   | S        |
| V1-06 | Track 1 closure documentation and author browser acceptance | Todo                   | S        |

Track 1 closure (V1-06) depends on every Track 1 audit fix, V1-01 to V1-05
and V1-07 to V1-12,
plus a recorded author browser acceptance pass.

### Reader and design system

Source: Track 1 UI and UX audit, coordinated with 3A.4 and 3A.5.

| ID    | Item                             | Status                 | Estimate |
| ----- | -------------------------------- | ---------------------- | -------- |
| V1-07 | Reader width on wide screens     | Pending design session | S        |
| V1-08 | Author identity on the post page | Todo                   | M        |
| V1-09 | Engagement control emphasis      | Todo                   | S        |
| V1-10 | Reader link distinctness         | Todo                   | S        |
| V1-11 | Dark-mode contrast and focus     | Todo                   | M        |
| V1-12 | H3 and Divider content check     | Todo                   | S        |

### Management and navigation

Source: Track 4 (recorded in `FEATURES.md` at commit `46d26a3`),
`docs/PHASE_3A.md` 3A.3 scope, decision 3A-021. Includes the approved dense
management-row requirement from the 3A.3 detailed requirements;
`PublishedSection.tsx` still renders a PostCard grid today.

| ID    | Item                                                              | Status       | Estimate |
| ----- | ----------------------------------------------------------------- | ------------ | -------- |
| V1-13 | Published management rows and deletion UI with clear confirmation | Todo         | M        |
| V1-14 | Draft management rows and deletion confirmation check             | Todo         | S        |
| V1-15 | Unsaved-exit guards beyond target switches                        | Pending spec | M        |
| V1-16 | Accessibility evidence pass                                       | Todo         | M        |

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

## Design-session deferrals

These postpone a decision to an approved design session and keep their v1.0
membership unless that session decides otherwise.

- Content width Option C, using the side space on wide screens.
- Exact typography, supporting palette, compact footer, and final responsive
  treatments. The v1.0 visual system (V1-21 and V1-23) establishes the
  structure; the final treatments are settled in the design session.

## Pending scope

- V1-03 and V1-07 width and measure: in v1.0, awaiting the content width design
  session.
- V1-15 unsaved-exit guards: in v1.0, scope pending a dedicated spec.
- V1-16 accessibility evidence: in v1.0, the exact evidence set is confirmed
  when scoped.

## How to update this file

When a change ships, alters scope, or defers an item, update its row here and
the linked documents in the same PR. Keep this file the only place that tracks
scope and progress; do not recreate status tables in `FEATURES.md` or
`docs/status.md`. Use the source references to keep every commitment traceable.
