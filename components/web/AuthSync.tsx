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
 */

"use client";

import { useEffect, useState } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

interface AuthSyncProps {
  children: React.ReactNode;
}

type SyncState = "idle" | "failed" | "retrying";

export function AuthSync({ children }: AuthSyncProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const syncUser = useMutation(api.users.syncUser);
  const [syncState, setSyncState] = useState<SyncState>("idle");

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    let cancelled = false;
    // Handle both outcomes so a failure never becomes an unhandled rejection.
    syncUser({}).then(
      () => {
        if (!cancelled) setSyncState("idle");
      },
      () => {
        if (!cancelled) setSyncState("failed");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, syncUser]);

  const retry = () => {
    setSyncState("retrying");
    syncUser({}).then(
      () => setSyncState("idle"),
      () => setSyncState("failed"),
    );
  };

  return (
    <>
      {children}
      {syncState !== "idle" && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-50 flex max-w-sm items-center gap-3 rounded-lg border border-border bg-background p-4 text-sm text-foreground shadow-lg"
        >
          <span>We could not finish setting up your account.</span>
          <button
            type="button"
            onClick={retry}
            disabled={syncState === "retrying"}
            className="shrink-0 rounded-md border border-border px-3 py-1 font-medium disabled:opacity-60"
          >
            {syncState === "retrying" ? "Retrying…" : "Try again"}
          </button>
        </div>
      )}
    </>
  );
}
