# Resonance — Architecture

This document is a reference for when you've been away from the codebase and need to
re-orient fast. It covers the full stack, how the layers connect, and why things were
built the way they were. Read it top-to-bottom once, then use it as a lookup.

---

## Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) | Server + client components, route handlers |
| Backend | Convex | Database, serverless functions, real-time subscriptions |
| Auth | Better Auth via `@convex-dev/better-auth` | Runs *inside* Convex, not in Next.js |
| UI | shadcn/ui + Tailwind CSS v4 | Primitive components + utility styles |
| Forms | React Hook Form + Zod | Client-side forms with schema validation |
| Theming | next-themes | Dark/light mode toggle |

---

## Directory Structure

```
resonance/
├── app/
│   ├── layout.tsx              # Root layout — ThemeProvider, ConvexClientProvider, Toaster
│   ├── globals.css
│   ├── (app)/                  # Route group: main app shell (has Navbar)
│   │   ├── layout.tsx          # Renders <Navbar /> above all (app) pages
│   │   ├── page.tsx            # Home / index (placeholder)
│   │   ├── blog/
│   │   │   └── page.tsx        # Blog listing — Server Component, fetchQuery
│   │   └── create/
│   │       └── page.tsx        # Create post form — Client Component, useMutation
│   ├── auth/                   # Auth pages — isolated layout, no Navbar
│   │   ├── layout.tsx          # Full-screen centered layout with Back button
│   │   ├── login/
│   │   └── sign-up/
│   ├── schemas/
│   │   ├── auth.ts             # Zod: signUpSchema, loginSchema
│   │   └── blog.ts             # Zod: postSchema
│   └── api/                    # Next.js route handlers (Better Auth HTTP handler)
│
├── convex/
│   ├── schema.ts               # DB schema: posts { title, body, authorId }
│   ├── auth.config.ts          # Convex auth config — registers Better Auth provider
│   ├── auth.ts                 # Creates the Better Auth instance; reads SITE_URL
│   ├── http.ts                 # Registers Better Auth HTTP routes on Convex router
│   └── posts.ts                # createPost mutation, getPosts query
│
├── components/
│   ├── ui/                     # shadcn/ui primitives (Button, Card, Input, etc.)
│   └── web/
│       ├── ConvexClientProvider.tsx  # Convex + Better Auth session bridge
│       ├── Navbar.tsx               # Top nav — auth state via useConvexAuth()
│       └── theme-toggle.tsx         # Dark/light toggle
│
└── lib/
    ├── auth-server.ts          # Next.js server-side auth helpers
    └── auth-client.ts          # Browser-side authClient (sign-in, sign-up, sign-out)
```

---

## Auth Flow

Better Auth runs **inside Convex**, not in the Next.js server. User and session records
live in the same Convex database as your app data — no separate auth DB.

### How the pieces wire together

```
┌────────────────────────────────────────────────────────────────┐
│                        CONVEX BACKEND                          │
│                                                                │
│  convex/auth.ts          Creates the Better Auth instance.     │
│    └─ betterAuth()       Uses Convex DB adapter.               │  
│                          Reads SITE_URL from Convex env.       │
│                                                                │
│  convex/auth.config.ts   Registers Better Auth as the          │
│                          Convex auth provider.                 │
│                                                                │
│  convex/http.ts          Mounts Better Auth HTTP routes        │
│    └─ registerRoutes()   (sign-in, sign-up, session…)          │
│                          served at NEXT_PUBLIC_CONVEX_SITE_URL │
└────────────────────────────────────────────────────────────────┘
         ▲ HTTP calls (sign-in / sign-up / session)
         │
┌───────────────────────────────────────────────────────────────┐
│                       NEXT.JS SERVER                          │
│                                                               │
│  lib/auth-server.ts      Server-side helpers from             │
│    convexBetterAuthNextJs()  convexBetterAuthNextJs():        │
│    ├─ handler            → used in app/api/ route handler     │
│    ├─ preloadAuthQuery   → preload queries with auth token    │
│    ├─ isAuthenticated    → boolean check in Server Components │
│    ├─ getToken           → raw token for SSR data fetching    │
│    └─ fetchAuthQuery/    → authenticated server-side fetches  │
│       Mutation/Action                                         │
└───────────────────────────────────────────────────────────────┘
         ▲ session reads
         │
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                 │
│                                                                 │
│  lib/auth-client.ts      authClient from better-auth/react      │
│    └─ convexClient()     with the convexClient plugin.          │
│                          Used for signIn / signUp / signOut.    │
│                                                                 │
│  ConvexClientProvider    Wraps the app in                       │
│    └─ ConvexBetterAuth   ConvexBetterAuthProvider — bridges     │
│       Provider           the real-time Convex client with       │
│                          the Better Auth session.               │
│                          Needs NEXT_PUBLIC_CONVEX_URL.          │
│                                                                 │
│  Navbar                  Reads auth state via                   │
│    └─ useConvexAuth()    useConvexAuth() — reactive,            │
│                          sourced from Convex (not authClient)   │
└─────────────────────────────────────────────────────────────────┘
```

### Sign-up / sign-in sequence

```
Browser                 Next.js              Convex HTTP
  │                        │                     │
  │── authClient.signIn ──>│                     │
  │   (lib/auth-client.ts) │                     │
  │                        │── POST /auth/... ──>│
  │                        │                     │── Better Auth handler
  │                        │                     │   writes session to
  │                        │                     │   Convex DB
  │                        │<── session token ───│
  │<── session token ──────│                     │
  │                        │                     │
  │  ConvexBetterAuthProvider picks up token     │
  │  and attaches it to all subsequent Convex    │
  │  queries / mutations automatically           │
```

Auth is **email + password only**. Email verification is disabled.

---

## Data Flow

Two distinct rendering patterns are used depending on what the page needs.

```
┌──────────────────────────────────────────────────────────────────┐
│  PATTERN A — Server Component  (app/(app)/blog/page.tsx)         │
│                                                                  │
│  Next.js Server                        Convex                    │
│      │                                    │                      │
│      │── fetchQuery(api.posts.getPosts) ─>│                      │
│      │   (convex/nextjs, runs at          │── reads posts table  │
│      │    request time on the server)     │                      │
│      │<── posts[] ────────────────────────│                      │
│      │                                    │                      │
│      │  Renders HTML with data baked in.                         │
│      │  Wrapped in <Suspense> with skeleton fallback.            │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  PATTERN B — Client Component  (app/(app)/create/page.tsx)       │
│                                                                  │
│  Browser (React)                       Convex                    │
│      │                                    │                      │
│      │  React Hook Form + Zod             │                      │
│      │  validates input                   │                      │
│      │                                    │                      │
│      │── useMutation(api.posts            │                      │
│      │     .createPost) ─────────────────>│                      │
│      │                                    │── safeGetAuthUser()  │
│      │                                    │   throws if unauthed │
│      │                                    │── writes to posts    │
│      │<── result ─────────────────────────│                      │
└──────────────────────────────────────────────────────────────────┘
```

**When to use which:**
- Server Component + `fetchQuery` → read-only pages, good for SEO, no client JS needed.
- Client Component + `useMutation`/`useQuery` → anything that writes data or needs
  real-time reactivity.

---

## Component Organization

```
components/
├── ui/          shadcn/ui primitives. Don't edit these by hand —
│                re-generate via the shadcn CLI if you need changes.
│                (Button, Card, Input, Textarea, Field, Skeleton, …)
│
└── web/         App-level components. Everything specific to Resonance.
    ├── ConvexClientProvider.tsx
    │     Wraps the entire app tree. Sets up ConvexBetterAuthProvider
    │     with NEXT_PUBLIC_CONVEX_URL. Must be a client component
    │     ("use client") because it manages a real-time WebSocket.
    │
    ├── Navbar.tsx
    │     Reads auth state with useConvexAuth() — reactive to the
    │     Convex session, not to the Better Auth client directly.
    │     Calls authClient.signOut() from lib/auth-client.ts on logout.
    │
    └── theme-toggle.tsx
          Wraps next-themes' useTheme(). Toggling updates a class on
          <html>; Tailwind picks it up via the dark: variant.
```

---

## Layouts & Route Groups

```
app/
├── layout.tsx          Root layout — providers that must wrap everything:
│                         ThemeProvider, ConvexClientProvider, Toaster
│
├── (app)/
│   └── layout.tsx      Adds <Navbar /> above page content.
│                       All "logged-in app" pages live here.
│
└── auth/
    └── layout.tsx      Full-screen centered layout.
                        No Navbar. Has a Back button.
                        Auth pages are deliberately isolated so there's
                        no visual chrome distracting from the form.
```

Route groups (the `(app)` folder name) are a Next.js App Router convention — the
parentheses mean the folder name is **not** part of the URL. `/blog` resolves to
`app/(app)/blog/page.tsx`.

---

## Key Decisions

### 1. Why Convex?
Real-time subscriptions out of the box, TypeScript-first schema, and fully serverless —
no separate API server to maintain. Queries and mutations are just TypeScript functions.
The schema in `convex/schema.ts` is the single source of truth for the DB shape.

### 2. Why Better Auth instead of Clerk or Auth.js?
- **Cost:** Open-source and self-hosted. No per-MAU pricing.
- **Integration:** `@convex-dev/better-auth` is the official package, so user/session
  data lives directly in Convex — no second database or third-party service.
- **Control:** You own the auth logic. Adding providers or custom flows means editing
  your own code, not reading someone else's dashboard docs.

### 3. Why does Better Auth run on Convex instead of Next.js?
If it ran in Next.js, sessions and user records would need their own database. By
running Better Auth inside Convex functions (via `convex/auth.ts` and `convex/http.ts`),
everything — posts, users, sessions — lives in one place. Fewer moving parts.

### 4. Why two separate layouts (`(app)` vs `auth`)?
The main app needs a persistent Navbar. Auth pages need to be distraction-free,
full-screen forms. Route groups let you express this with zero conditional rendering logic
— the layout file handles it structurally.

### 5. Why the mixed Server / Client Component rendering strategy?
- `/blog` is read-only and benefits from server-side rendering for SEO and fast initial
  load. `fetchQuery` runs at request time — no client JS required to see the content.
- `/create` needs React Hook Form state and fires a Convex mutation directly from the
  browser. It has to be a Client Component.

The rule of thumb: default to Server Components; drop to Client Components only when
you need interactivity, browser APIs, or real-time Convex hooks.

---

## Environment Variables

| Variable | Where it lives | Used by |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Next.js `.env.local` | `ConvexClientProvider` — WebSocket URL |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Next.js `.env.local` | Points browser auth calls at Convex HTTP |
| `SITE_URL` | Convex dashboard env vars | `convex/auth.ts` — Better Auth base URL |

`NEXT_PUBLIC_*` variables are exposed to the browser bundle. `SITE_URL` stays
server-side inside Convex.
