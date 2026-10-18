/**
 * Global Auth Sync component.
 *
 * Client Component ("use client") that wraps the app and automatically
 * calls `api.users.syncUser` whenever the user transitions from
 * unauthenticated → authenticated.
 *
 * Why a global component instead of putting this in Navbar?
 * - The Navbar only renders on pages that include it (most pages, but not all).
 * - Auth sync is a global concern: the `users` table must stay in sync
 *   regardless of which page triggers the sign-in.
 * - By placing this inside `ConvexClientProvider`, it fires on every
 *   auth state change across the entire app.
 *
 * This component is deliberately placed inside `ConvexClientProvider`
 * (and thus inside `ConvexBetterAuthProvider`) so `useConvexAuth` has
 * access to the auth state.
 *
 * A failed sync is recoverable, not swallowed: the children always render and a
 * non-blocking banner offers a manual retry. There is no automatic backoff, so
 * the retry path stays deterministic and the user controls when to try again.
 * The `onCreate` trigger in `convex/auth.ts` already provisions the profile at
 * account creation; this effect converges accounts that predate that trigger.
 *
 * The banner is keyed by the auth lifecycle. Stored status carries the
 * lifecycle it belongs to, and the render derives `idle` whenever the stored
 * lifecycle is not the current one, so a sign-out clears a stale failure
 * without a reset write. A retry tags its outcome with the lifecycle it
 * started under, so a completion that lands after the lifecycle changed is
 * ignored by the same derivation.
 */

"use client";

import { useEffect, useState } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

interface AuthSyncProps {
  children: React.ReactNode;
}

/** The three states the auth lifecycle settles into between renders. */
type Lifecycle = "loading" | "in" | "out";

type SyncState = "idle" | "failed" | "retrying";

export function AuthSync({ children }: AuthSyncProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const syncUser = useMutation(api.users.syncUser);
  const lifecycle: Lifecycle = isLoading
    ? "loading"
    : isAuthenticated
      ? "in"
      : "out";
  // The status is stored with the lifecycle it was produced under. Rendering
  // derives `idle` whenever the stored lifecycle is stale, so a sign-out or a
  // later sign-in clears the banner with no state write in the effect.
  const [sync, setSync] = useState<{ lifecycle: Lifecycle; status: SyncState }>(
    {
      lifecycle: "out",
      status: "idle",
    },
  );
  const status = sync.lifecycle === lifecycle ? sync.status : "idle";

  useEffect(() => {
    if (lifecycle !== "in") return;
    let cancelled = false;
    // Handle both outcomes so a failure never becomes an unhandled rejection.
    syncUser({}).then(
      () => {
        if (!cancelled) setSync({ lifecycle: "in", status: "idle" });
      },
      () => {
        if (!cancelled) setSync({ lifecycle: "in", status: "failed" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [lifecycle, syncUser]);

  const retry = () => {
    // Tag the outcome with the lifecycle it started under: if the lifecycle has
    // since changed, the derivation renders `idle` and ignores the stale write.
    const startedIn = lifecycle;
    setSync({ lifecycle: startedIn, status: "retrying" });
    syncUser({}).then(
      () => setSync({ lifecycle: startedIn, status: "idle" }),
      () => setSync({ lifecycle: startedIn, status: "failed" }),
    );
  };

  return (
    <>
      {children}
      {status !== "idle" && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-50 flex max-w-sm items-center gap-3 rounded-lg border border-border bg-background p-4 text-sm text-foreground shadow-lg"
        >
          <span>We could not finish setting up your account.</span>
          <button
            type="button"
            onClick={retry}
            disabled={status === "retrying"}
            className="shrink-0 rounded-md border border-border px-3 py-1 font-medium disabled:opacity-60"
          >
            {status === "retrying" ? "Retrying…" : "Try again"}
          </button>
        </div>
      )}
    </>
  );
}
