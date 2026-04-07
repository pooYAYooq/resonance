# Resonance

A full-stack blogging platform built with Next.js, Convex, and Better Auth.

## Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org) (App Router)
- **Backend:** [Convex](https://convex.dev) — real-time database & serverless functions
- **Auth:** [Better Auth](https://better-auth.com) via `@convex-dev/better-auth`
- **UI:** [shadcn/ui](https://ui.shadcn.com), [Tailwind CSS v4](https://tailwindcss.com), [Radix UI](https://radix-ui.com)
- **Forms:** React Hook Form + Zod

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm

### Install dependencies

```bash
pnpm install
```

### Set up environment variables

Copy `.env.local.example` to `.env.local` and fill in your Convex deployment URL and Better Auth secret.

### Run the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Project Structure

```
app/
  (app)/        # Main app routes (home, blog, create)
  auth/         # Auth pages (login, sign-up)
  schemas/      # Zod validation schemas
convex/         # Convex backend (schema, queries, mutations, auth)
components/
  ui/           # shadcn/ui components
  web/          # App-level components (Navbar, providers)
lib/            # Auth client/server helpers
```
