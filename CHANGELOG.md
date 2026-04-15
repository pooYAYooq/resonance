# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/your-org/resonance/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/your-org/resonance/releases/tag/v0.1.0