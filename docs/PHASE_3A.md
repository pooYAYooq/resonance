# Phase 3A: Product Direction and Delivery Map

## Status

**Authority:** This is the tracked product and delivery source of truth for
the remaining Phase 3A redesign work.

**Current delivery position:** Phase 3A.0 is shipped. Phase 3A.1, Product
Structure, is the sole next delivery focus. No Slice 1 application code has
started.

**Required fresh-session reading order:**

1. `AGENTS.md`
2. `docs/status.md`
3. `docs/PHASE_3A.md`
4. `docs/PHASE_3A_DECISIONS.md`
5. `FEATURES.md`
6. `docs/ARCHITECTURE.md`
7. The active local implementation plan under `docs/superpowers/plans/`, when
   present

## Authority and Terminology

Section 18 of the former working brief is the authoritative Phase 3A scope
structure. Section 4 is retained only as an earlier high-level principle:
settle product and UX structure before visual redesign. It is not a competing
numbered phase sequence.

The Section 18 areas describe product scope. They are not a rigid delivery
order. Delivery uses repository-aware slices that may cross scope areas only
when doing so establishes a shared prerequisite once, avoids duplication, or
keeps a user flow coherent.

The repository is the authority for what exists today. This document is the
authority for the approved target direction. Current code that differs from
this target is a delivery gap, not a reason to reopen approved product
decisions.

`docs/ARCHITECTURE.md` records shipped architecture only. Do not update it to
describe this target state until the corresponding implementation has shipped.

## Product Direction

### Product Model

Resonance is an author-first publishing platform where people write and build
an audience. It has two user states: anonymous and authenticated. There is no
separate author role; every authenticated user can read, write, publish,
follow, save, like, and manage their own content.

The primary product loop is:

> Write -> Publish -> Get discovered -> Gain followers -> Understand your
> audience -> Write again

Reader features serve that loop. Resonance must not drift toward a generic
social network unless a feature strengthens authors' audience growth.

### Core Experience Rules

- Blog is discovery. Feed is retention for writers a reader already follows.
- Reading is public. Durable participation is authenticated.
- Authentication is an interruption, not a reset. Preserve the exact return
  destination for protected routes and engagement actions.
- If viewer identity is known, initial viewer-specific state must be correct.
- Publishing is explicit. Saving must never publish accidentally.
- Public UI must not imply functionality or meaningful data that does not
  exist.
- Profile is identity. Settings is configuration.
- UX structure precedes visual-system redesign.

## Current Repository Baseline

Phase 3A.0 shipped the correctness baseline for anonymous public reading,
viewer-aware reads, preserved auth returns, explicit publishing, honest metrics,
and removal of misleading placeholders. The original audit is historical input,
not live requirements.

The remaining redesign is constrained by these repository facts:

- `app/(app)/layout.tsx` currently forces the global Navbar and Footer around
  every main-app route. A child dashboard layout cannot replace them. Route
  groups must change before the workspace shell can be correct.
- Current dashboard tabs combine author management, Saved, analytics, and a
  deferred root surface. Saved must leave the workspace; analytics must become
  an intentional destination; `/dashboard` must remain routed without becoming
  a premature Overview.
- `PostCard` currently combines a reusable hydrated post shape with one visual
  presentation. The data shape is a reusable seam; the universal visual card is
  not the target.
- Liked lacks a user-first listing access path. Saved already has one through
  bookmarks.
- Post bodies are BlockNote JSON and tags are arrays. Search and topic browsing
  need deliberate query/index contracts, but their exact projection/index/table
  strategy is a Slice 2 planning decision.
- Published deletion touches comments, likes, bookmarks, views, notifications,
  feed rows, and derived counters. It is deliberately deferred to Writing and
  Content Management.
- Feed is a bounded retention stream. Do not turn it into a discovery system or
  redesign it before its Slice 2 recovery work.

## Target-State Architecture

### Route and Shell Model

| Route group   | URLs                                                                                                  | Shell responsibility                                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `(marketing)` | `/`                                                                                                   | Anonymous marketing Home, fuller marketing footer, auth-aware navbar. Authenticated `/` resolves directly to Dashboard.           |
| `(site)`      | `/blog`, posts, profiles, `/profile/edit`, `/settings`, `/feed`, `/saved`, `/liked`, `/notifications` | Public and authenticated reader/site surfaces, global navbar, compact product footer.                                             |
| `(workspace)` | `/dashboard/*`, `/create`                                                                             | Authenticated workspace shell, collapsible desktop sidebar, mobile drawer, workspace utility cluster, no global Navbar or Footer. |
| `auth`        | `/auth/*`                                                                                             | Existing isolated authentication shell.                                                                                           |

Route groups do not change the approved URLs. `/profile/edit` and `/settings`
are authenticated site-shell surfaces, not workspace-mode pages.

### Navigation Responsibilities

| Context                  | Primary destinations                                                                   | Utility behavior                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Anonymous marketing/site | Home, Discover, Log In, Sign Up                                                        | No private data queries before auth resolves.                                                        |
| Authenticated site       | Discover, Feed, New Post                                                               | Logo -> Dashboard; bell/unread badge; account hub for Profile, Saved, Liked, Settings, and Sign Out. |
| Workspace sidebar        | New Post, Drafts, My Posts, Analytics, Discover, Feed, Saved, Liked, Profile, Settings | Reader links may leave the workspace shell. No Overview item.                                        |
| Workspace utilities      | Notification bell and account actions                                                  | Desktop sidebar footer; mobile workspace header; shared behavior may use different presentation.     |

`Profile` always means public identity at `/u/[userId]`. Its owner action opens
`/profile/edit`. Settings is not an identity-editing form.

### Data and Component Boundaries

- `posts` remains the source of truth. Search and topic browsing receive
  deliberate query/index contracts appropriate to their access patterns; Feed
  remains a bounded retention stream.
- A common hydrated post-summary result shape is shared where appropriate. It
  is not a universal backend query: Discover, Feed, Profile, Saved, Liked, and
  management surfaces may retain access paths and pagination contracts that fit
  their jobs.
- Editorial reader cards, compact collection cards, and dense management rows
  are distinct presentations over shared data/primitives. Do not force a
  universal card composition.
- Existing `NotificationBell`, auth-return helpers, public post rendering, and
  viewer-aware hydration are reusable seams. The current universal `PostCard`,
  dashboard tabs, dashboard-owned Saved route, and universal app shell are
  replacement seams.

## Section 18 Scope Areas

### 3A.0: UX Correctness - Shipped

Anonymous public reading, authenticated viewer state, auth returns, session
configuration verification, explicit Save Draft/Publish behavior, and removal
of misleading public placeholders are complete.

### 3A.1: Product Structure - Next

- Authenticated Home routing.
- Marketing, site, and workspace shell separation.
- Workspace sidebar and mobile drawer.
- Saved/Liked placement as reader utilities.
- Navbar/footer restructuring.
- Profile/Settings responsibility split.
- Analytics as a secondary workspace destination.

### 3A.2: Discover Foundations

- Discover redesign at `/blog`.
- Published-post and author-name search.
- Topic browsing using curated tags.
- Hot and Latest paths after the Hot ranking rule is defined.
- Feed empty-state recovery to Discover.

### 3A.3: Writing and Content Management

- Full-page Create/Edit environment inside the workspace shell.
- Preview/Review -> explicit Publish -> newly published post.
- My Posts and Drafts management rows.
- Clear confirmation and cleanup semantics for published-post deletion.

### 3A.4: Profiles and Engagement Surfaces

- Stronger public profile identity and author-work presentation.
- Compact, actionable Notifications.
- Saved/Liked collection presentation.
- Context-specific post-card variants.

### 3A.5: Visual System and Responsive Polish

- Typography, color, surface, spacing, and density systems.
- Shared page-state language for loading, empty, not-found, pagination, and
  authenticated-route states.
- Responsive and interaction polish across the established product hierarchy.

## Detailed Approved Requirements

### Authentication, Sessions, and Public Reading

- Anonymous visitors may browse Discover, read full posts, view public profiles,
  and read comments. They may not like, save, follow, comment, or publish.
- Engagement controls can remain visible to anonymous visitors, but activation
  starts authentication with the precise originating context preserved.
- Commenting must make the sign-in requirement clear before an anonymous reader
  invests effort typing.
- After authentication, return to preserved intent when it exists; otherwise,
  direct Login and Sign Up continue to Dashboard. Do not add onboarding.
- Better Auth's standard finite sliding-session model remains the approved
  direction. Do not add a client inactivity timer without a future security
  requirement.

### Reader Utilities and Page States

- Use **Saved** for intentionally bookmarked posts and **Liked** for posts the
  user has liked. Do not alternate among Reading List, Library, Bookmarks, and
  Saved for the same user-facing concept.
- Every empty state explains what is missing and offers one clear recovery
  action when an obvious next step exists. Feed and Notifications recover to
  Discover; this work belongs to their respective approved slices.
- Establish a small shared language for page headers, loading/skeleton states,
  empty/recovery states, pagination/load-more, not-found states, and
  authenticated-route boundaries. Shared behavior does not require identical
  visual markup.

### Profiles, Settings, and Notifications

- Public Profile helps a reader understand a writer, explore their work, and
  follow them. It keeps name, avatar, bio, follower/following counts, Follow,
  and the author's published work clear.
- Do not add follower/following directories or social activity feeds.
- Edit Profile owns public identity. Slice 1 supports display name and bio;
  provider avatar is context only. Avatar upload and new identity fields remain
  deferred.
- Settings owns product/account configuration. V1 provides only Appearance
  (Light, Dark, System through existing `next-themes`) and Account context with
  Sign Out.
- Notifications remain compact and actionable. Preserve publication/follow
  notifications, direct links to the relevant content, visible read/unread
  state, and Discover recovery when empty. Do not add taxonomy, email, or push
  systems.

### Discover and Feed

- Discover answers what to read, who to follow, and which topics are active.
  It must become more than a chronological archive.
- Discover's approved hierarchy is Search, Hot on Resonance, Latest, then
  Topics. Search is the intentional discovery tool; Hot's ranking formula and
  time window remain deferred. Do not render an inert Hot placeholder.
- V1 Search covers published post title/body and author name inside Discover.
  Advanced filters, semantic/AI search, saved searches, and external search
  services are deferred unless the chosen Convex strategy proves insufficient.
- Topics use existing curated tags. Clicking a Topic shows relevant published
  posts; tag visibility remains on cards and post detail. Do not add interest
  onboarding or taxonomy management.
- Feed remains a secondary personalized stream from followed authors. It must
  not compete with Discover or become a recommendation system.

### Writing, Publishing, Management, and Analytics

- Create/Edit becomes a full-page workspace writing environment. Title and
  editor dominate; cover image and tags are secondary; global Navbar/Footer do
  not render there.
- New, draft, and published-edit modes must be unmistakable. Save Draft and
  Publish remain distinct explicit actions.
- The approved publication sequence is Preview/Review -> explicit Publish ->
  the newly published post. Preview should reasonably reflect the public post
  without becoming a complex wizard.
- My Posts and Drafts use dense management rows with title, status/date
  metadata, Edit, View Post where relevant, and Delete where allowed. Do not
  show redundant Read more when View Post is available.
- Published deletion is approved and requires clear confirmation. Revision
  history is out of scope; unpublish remains deferred.
- Analytics remains signed-in unique-reader measurement, not total traffic.
  Labels must state that scope honestly. Do not add anonymous view tracking or
  broaden analytics merely to fill the interface.

### Visual and Responsive Principles

- Preserve Resonance's dark/orange identity while later formalizing display and
  body typography, supporting color roles, foreground/surface hierarchy,
  borders, states, spacing, density, and component families.
- Orange is deliberate emphasis, not every emphasis role. Exact fonts and color
  values remain deferred to the visual-design session.
- Responsive behavior preserves the same information hierarchy: desktop
  workspace uses a collapsible sidebar; tablet/mobile use a drawer; site
  navigation is compact; New Post and reader utilities remain easy to reach.
- Management rows and the future writing environment must remain usable on
  narrow screens. Do not invent a separate mobile product architecture.
- The Dashboard root may not become a collection of miniature sidebar pages,
  empty-state clutter, or shallow Discover/Feed duplication.

## Delivery Slice Map

| Slice                                  | Product outcome                                                                                 | Scope areas crossed                                           | Why this combination is deliberate                                                                                                   | Explicitly later                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 0. Documentation Canonicalization      | One durable source of truth, decision log, roadmap, and resume point.                           | Delivery governance                                           | Prevents rediscovery and conflicting instructions before any code changes.                                                           | Application implementation.                                                   |
| 1. Product Structure                   | Coherent shells/navigation, reader utilities, Settings/Profile split, and analytics relocation. | 3A.1 plus Saved/Liked data foundations needed for navigation. | A sidebar cannot expose working reader utilities until their routes/access paths exist. The shell boundary must be established once. | Dashboard Overview redesign, final card variants, Discover, writing redesign. |
| 2. Discover Foundations                | Real Search, Latest, Topics, and Feed recovery to Discover.                                     | 3A.2 with editorial post presentation foundations.            | Search, topic browsing, result pagination, cards, and empty states form one honest discovery loop.                                   | Hot implementation until its formula/time window is defined.                  |
| 3. Writing and Content Management      | Writing environment, review/publish completion, management rows, and safe published deletion.   | 3A.3 plus My Posts dependencies.                              | Create/Edit, Drafts, My Posts, publishing, and deletion are one author lifecycle.                                                    | Autosave, revision history, unpublish, and detailed editor-layout decisions.  |
| 4. Identity and Engagement Surfaces    | Stronger profiles, actionable Notifications, and compact collection presentations.              | 3A.4 with shared page-state work from 3A.5.                   | These surfaces support the reader-to-author loop and must use consistent recovery, loading, and collection behavior.                 | Follower directories, activity feeds, notification expansion.                 |
| 5. Visual System and Responsive Polish | Deliberate Resonance visual system and final interaction polish.                                | 3A.5 across shipped surfaces.                                 | A durable visual system depends on settled page responsibilities and component families.                                             | New product infrastructure.                                                   |

## Sequencing Rules

1. Establish route/shell boundaries before workspace or Create redesign work.
2. Establish the shared post-summary boundary before adding list consumers, but
   do not force all existing queries into one implementation.
3. Plan Search and Topics together with their target access contracts before
   implementing Discover UI. Do not preselect a table/projection strategy.
4. Treat published deletion as a bounded lifecycle operation, not a single
   `posts` delete.
5. Functional desktop collapse and mobile drawer access belong with the
   workspace shell. Visual density refinements belong later.
6. Do not introduce aliases, compatibility branches, duplicate old/new routes,
   or fallback APIs solely for pre-deployment behavior.
7. A later Section 18 area may inform an earlier architecture choice, but it
   must not silently expand an approved slice.

## Slice 1 Locked Boundary

Slice 1 is complete only when all of these are observable:

- Authenticated `/` and authenticated site logo resolve to `/dashboard` without
  marketing Home rendering first.
- Marketing, authenticated site, and workspace shells are separate while URLs
  remain stable.
- `/dashboard/*` and `/create` have workspace-only chrome; site Navbar/Footer
  do not render there.
- Desktop sidebar and mobile drawer expose the approved destinations and
  workspace notification/account utilities. No Overview item appears.
- `/dashboard` remains reachable with only mechanical legacy-root edits; it is
  not an approved Dashboard Overview.
- `/settings` contains Appearance and Account only. `/profile/edit` supports
  display name and bio, with provider avatar as context only.
- `/saved` is the sole Saved route. `/liked` is an authenticated paginated
  reader collection.
- Analytics is reachable at `/dashboard/analytics` with honest
  signed-in-unique-reader language.
- Shared account actions and bell behavior are reusable across site/workspace
  shells. A common hydrated post-summary shape is available where appropriate.

Slice 1 must not add Discover search/topics, Hot, Feed recovery, autosave,
unpublish, avatar upload, published-post deletion, follower directories,
notification expansion, final visual-system work, or a universal card redesign.

## Deferred Boundaries

- Dashboard Overview purpose and composition.
- Hot ranking formula and time window.
- Autosave, unpublish, revision history, and detailed Create/Edit composition.
- Avatar upload/custom storage and other new public identity fields.
- Search and Topic physical read-model strategy.
- Exact typography, supporting color palette, compact-footer composition, and
  final responsive visual treatments.
- Follower/following directories, activity feeds, recommendation infrastructure,
  semantic/AI search, and broader analytics/notification infrastructure.

These are intentional deferrals, not missing requirements. A slice may request
a decision only when the decision materially blocks its approved work.

## Documentation and Handoff Model

| Document                     | Responsibility                                                                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/PHASE_3A.md`           | Target direction, scope areas, slices, dependencies, sequencing, deferrals, and current delivery boundary.                                                        |
| `docs/PHASE_3A_DECISIONS.md` | Dated cross-cutting decisions and rationale.                                                                                                                      |
| `FEATURES.md`                | Concise roadmap/status board.                                                                                                                                     |
| `docs/status.md`             | Short resume point, verified evidence, and links to the authoritative documents.                                                                                  |
| `docs/superpowers/plans/`    | Active local execution artifacts. Untracked and intentionally not gitignored; supplemental only, never the only source of target direction.                       |
| `docs/superpowers/specs/`    | Active local working-design artifacts. Untracked and intentionally not gitignored; obsolete artifacts must be removed rather than retained as competing guidance. |

A new session must follow the required reading order at the start of this
document before proposing or changing Phase 3A work. It must not reconstruct
product direction from conversation history.

## Mandatory Human Review Gates

No Phase 3A work may bypass these gates:

1. **Before staging:** present the exact intended diff and documentation impact
   to the human reviewer. Confirm scope, target-state alignment, removals, and
   no omitted documentation. Do not run `git add` without explicit approval.
2. **Before committing:** after staging, present `git diff --staged`, fresh
   verification evidence, documentation updates, and known limitations. Do not
   run `git commit` without explicit approval.
3. **Before opening a PR:** present branch status, all included commits, full
   base diff, verification evidence, canonical-document consistency, and the
   required local PR checklist. Do not push or create a PR without explicit
   approval.

These gates are mandatory checkpoints, not implied consent from an earlier
request to implement a slice.
