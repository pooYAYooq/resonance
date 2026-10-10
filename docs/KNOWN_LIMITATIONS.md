# Known limitations

Current constraints and verification gaps, not a second backlog. Scope and
priorities belong in [ROADMAP.md](../ROADMAP.md). Remove or revise entries when
evidence resolves them. The previous detailed delivery history remains in
[the PR #103 revision](https://github.com/pooYAYooq/resonance/blob/d2d5fed/docs/status.md).

## Accessibility and responsive behavior

- [Accessibility evidence](ACCESSIBILITY.md) covers the agreed keyboard scope
  in Chrome. It is not WCAG conformance, real screen-reader acceptance, touch
  acceptance, or a final design sign-off. Firefox and Safari were not manually
  exercised. Retest after relevant behavior/layout changes.
- The maintainer deferred the feed loading-announcement advisory to avoid
  expanding PR #103. A status region created with its initial text may not
  announce reliably in some screen readers; this has not been reproduced with
  a real screen reader. No follow-up implementation is currently scheduled.
- Shared navigation corrected earlier narrow-layout overflow. The separate
  signed-out responsive acceptance at 320/375 remains unverified under V1-23;
  keyboard evidence does not close the broader responsive item.
- Management pending/error/retry and empty-state deletion were component-tested
  rather than browser fault-injected. Draft pagination also had only automated
  coverage because there were insufficient drafts during its acceptance pass.
  Later keyboard matrices in `ACCESSIBILITY.md` supplement that original scope.
- Follow colors and the light-theme contrast observations remain under V1-21.
  Notifications' missing empty-state recovery action remains under V1-18.

## Authoring and recovery

- Pasted Table-of-Contents anchors (`#heading`) become plain text because the
  safe-link allowlist permits http, https, and mailto, and reader headings have
  no IDs. HTML drag-and-drop can still introduce shapes repaired by paste:
  BlockNote exposes no drop hook, so save-time validation handles that path.
- The installed side-handle menu has no separate "Turn into" surface. A
  custom drag-safe adapter replaces the menu that opened on mousedown.
- An untouched new post can briefly count as dirty because the default empty
  paragraph differs from the empty-block baseline. Empty recovery snapshots
  are suppressed, but a blank target switch may show a transition notice.
- Always-available in-page Discard is deferred by decision 3A-021. Local
  recovery clears on save, revert, or empty content.
- Browsers without the Navigation API and uncancelable history traversals
  flush new/draft recovery synchronously instead of presenting a cancellable
  Back/Forward dialog. Published edits and selected cover Files can still be
  lost there. See [authoring architecture](ARCHITECTURE.md).
- Native beforeunload wording/appearance is browser-controlled. Crashes or
  forced shutdowns can lose work; unload performs no server save/upload. Some
  full-document browser-test navigations raised prompts outside the editor;
  the cause was not diagnosed in the accessibility evidence task.
- Cover removal alone still confirms lightly on app navigation: an
  effectively-empty draft cannot recover it. A validated target switch can
  clear recovery just before a page-level adoption rejection; the in-memory
  document is retained in that narrow race.
- A newly saved draft keeps `/create`; New Post points to the same URL and
  does nothing in that session. Use Start fresh to open another new post.

## Engineering and verification

- No stored-data migration/backfill exists for this undeployed app. A large
  existing deployment would need a staged migration before new indexed callers.
- Authenticated owner-scoped mutation tests are limited by the Better Auth
  fixture in `convex-test`; a passing test emits a known scheduled-cleanup
  warning. Preserve negative authorization coverage when changing these paths.
- Component runs can contend across workers. Use
  `pnpm test:component --maxWorkers=1` for reproducible local suite evidence.
- The title's Enter-to-body behavior depends on a dynamically imported editor
  handle and is browser-verified rather than exercised by jsdom.
- Repository-wide `pnpm format:check` has an unrelated pre-existing baseline.
  Check changed files without implying the baseline was repaired. Historical
  affected paths and measurements are retained in the linked PR #103 revision;
  rerun the command before describing a current failure list.
