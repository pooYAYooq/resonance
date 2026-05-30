# Resonance

> A full-stack blogging platform built with **Next.js**, **Convex**, and **Better Auth**.
> Write, share, and engage with a community of curious minds.

---

## Features

| Feature | Description |
|---------|-------------|
| **Landing Page** | Animated hero, feature highlights, live recent posts, community stats, and conversion CTA |
| **Blog** | Create posts with cover images, browse paginated listings, read individual posts |
| **Comments** | Leave comments on posts with real-time updates |
| **Authentication** | Email/password sign-up and login via Better Auth (runs inside Convex) |
| **SEO** | Per-page metadata, Open Graph tags, and dynamic meta generation for blog posts |
| **Dark Mode** | System-aware dark/light theme toggle |
| **Responsive** | Mobile-first design, works across all breakpoints |

---

## Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org) (App Router)
- **Backend:** [Convex](https://convex.dev) — real-time database & serverless functions
- **Auth:** [Better Auth](https://better-auth.com) via `@convex-dev/better-auth` (runs inside Convex)
- **UI:** [shadcn/ui](https://ui.shadcn.com), [Tailwind CSS v4](https://tailwindcss.com), [Radix UI](https://radix-ui.com)
- **Fonts:** Geist Sans, Geist Mono, Inter (via `next/font`)
- **Forms:** React Hook Form + Zod
- **Testing:** Vitest (edge-runtime for Convex, jsdom for UI components)

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (locked to v10 via `packageManager` in `package.json`)
- A Convex project (sign up at [convex.dev](https://convex.dev))

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up environment variables

Copy `.env.local.example` to `.env.local` and fill in:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CONVEX_URL` | Your Convex deployment URL |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Your Convex site URL |
| `BETTER_AUTH_SECRET` | 32+ character secret for auth encryption |
| `NEXT_PUBLIC_SITE_URL` | Public site URL (for OG tags) |

> **Note:** Also set `SITE_URL` in the **Convex dashboard** environment variables (not `.env.local`) — `convex/auth.ts` and Better Auth read it from there.

### 3. Run the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Convex setup (first time)

```bash
npx convex dev
```

This starts the Convex dev server and syncs your schema/functions.

---

## Development Commands

| Intent | Command |
|--------|---------|
| Dev server | `pnpm dev` |
| Lint | `pnpm lint` |
| Format | `pnpm format` |
| Typecheck | `pnpm build` (includes TS type-checking via Next plugin) |
| Tests (edge-runtime) | `pnpm test:ci` — Vitest with edge-runtime for Convex functions |
| Component tests | `pnpm test:component` — Vitest with jsdom for React components |
| Single test file | `pnpm test -- <path>` |
| Build | `pnpm build` |

---

## CI Before PR

```bash
pnpm lint && pnpm test:ci && pnpm test:component && pnpm build
```

---

## Project Structure

```text
app/
  (app)/                      # Main app routes (has Navbar + Footer)
    page.tsx                  # Landing page (public, auth-aware CTAs)
    layout.tsx                # App layout with Navbar + Footer
    blog/
      page.tsx                # Blog listing with gradient hero + post grid
      [postId]/
        page.tsx              # Single post view with comments
    create/
      page.tsx                # Create new post form
  auth/                       # Auth routes (login, sign-up)
    login/page.tsx
    sign-up/page.tsx
    layout.tsx                # Auth layout (no Navbar, full-screen forms)
  api/auth/[...all]/          # Better Auth route handler → Convex HTTP
  schemas/                    # Zod validation schemas

convex/
  schema.ts                   # Database schema
  posts.ts                    # Post queries, mutations, image upload
  comments.ts                 # Comment queries and mutations
  auth.ts                     # Better Auth integration inside Convex
  http.ts                     # Convex HTTP actions

components/
  ui/                         # shadcn/ui primitives
  web/                        # App-level components
    home/                     # Landing page sections
      HeroSection.tsx
      FeaturesSection.tsx
      RecentPostsSection.tsx
      RecentPostsSkeleton.tsx
      StatsSection.tsx
      ExploreSection.tsx      # Category placeholder grid
    AuthCTA.tsx               # Auth-aware CTA button ("Write a post" / "Get Started")
    FooterCTA.tsx             # Auth-aware CTA card for Footer
    Navbar.tsx
    Footer.tsx
    CommentSection.tsx
    CommentCard.tsx
    UserAvatar.tsx
    ConvexClientProvider.tsx

lib/
  constants/                  # Site-wide constants
  utils.ts                    # cn() and other helpers
  auth-client.ts              # Better Auth client setup
  auth-server.ts              # Server-side auth helpers
```

---

## Architecture

### Server vs Client Components

| Type | Usage | Data Fetching |
|------|-------|---------------|
| **Server Components** | Read-only pages & sections | `fetchQuery` from `convex/nextjs` |
| **Client Components** | Interactivity, hooks, auth state | `useConvexAuth`, mutations |

### Auth Flow

```text
Browser → Next.js API route (app/api/auth/[...all]/route.ts)
         → Convex HTTP action (convex/http.ts)
         → Better Auth handler (convex/auth.ts)
```

User and session records live in the same Convex DB as application data.

### Data Fetching Patterns

| Section | Query | Pattern |
|---------|-------|---------|
| Landing stats | `fetchQuery(api.posts.countPosts)` | Live total post count |
| Recent posts | `fetchQuery(api.posts.getPosts, { numItems: 4 })` | Paginated, wrapped in `<Suspense>` |
| Blog listing | `fetchQuery(api.posts.getPosts, { numItems: 50 })` | Full paginated grid |
| Post detail | `fetchQuery(api.posts.getPostById)` | Single post + image URL resolution |

---

## Testing

| Suite | Command | Runtime | Coverage |
|-------|---------|---------|----------|
| Convex | `pnpm test:ci` | Edge | Functions, queries, mutations |
| UI | `pnpm test:component` | jsdom | React components, forms |

---

## Contributing

1. Create a feature branch from `main`
2. Follow **Conventional Commits** (active voice, subject ≤72 chars)
3. Run the full CI pipeline before opening a PR
4. **Open a Pull Request** — do not merge directly to `main`

---

## License

[MIT](LICENSE)
