# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Standard Shadcn BlockNote authoring environment with native menus, remote
  embeds, code-language selection, Shiki highlighting, tables, and persistent
  visible Undo/Redo controls.
- Explicit Review step before publish/update: a read-only rendering of the
  frozen canonical post that blocks publication while inline media is
  unresolved (an unresolved cover does not block).
- Silent local draft recovery: unsaved work is snapshotted to `localStorage`
  and reloaded on return, with no restore prompt and no `beforeunload` warning.
- Canonical `blocknote@1` document contract validated at both the browser form
  and the Convex write boundary, covered by an all-block round-trip conformance
  test.

### Changed

- Adopted the installed standard BlockNote editor; the curated interaction
  contract was retired in favour of the full default authoring experience.

### Fixed

- Media, table, and divider blocks were rejected on save because editor-only
  block identity bypassed the canonical contract.
- Remote safe HTTP(S) embed URLs resolved to an empty string; they now pass
  through unchanged.
- Session-media cleanup helpers called `.paginate()` inside already-paginated
  mutations; they now use bounded `.take()` reads.

> Earlier phases between 0.1.0 and this entry are recorded in `FEATURES.md` and
> the git history; this changelog resumes at the standard-BlockNote authoring
> and Review baseline.

## [0.1.0] - 2026-04-15

### Added

- Full-stack blogging platform scaffold with Next.js 16 App Router.
- Convex real-time backend with a `posts` table (`title`, `body`, `authorId`).
- Better Auth integration via `@convex-dev/better-auth` with email/password
  authentication and no email verification requirement.
- Login and sign-up auth pages under `/auth`.
- Blog listing route (`/blog`) and post creation route (`/create`).
- shadcn/ui component library with Tailwind CSS v4 as the UI foundation.
- Dark/light theme support powered by `next-themes`.
- Form validation using React Hook Form and Zod.

[Unreleased]: https://github.com/pooYAYooq/resonance/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/pooYAYooq/resonance/releases/tag/v0.1.0
