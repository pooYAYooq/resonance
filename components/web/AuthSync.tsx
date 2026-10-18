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
 * The banner is keyed by the auth lifecycle and a per-sign-in epoch. Entering a
 * new lifecycle advances the epoch, and the visible status is derived by
 * comparing the status's epoch to the current session's epoch, so a sign-out
 * clears a stale failure without a reset write and a failure from a previous
 * sign-in stays hidden when the next session starts. A retry, and any
 * `syncUser` result, tags its outcome with the epoch it started under, so a
 * completion from an earlier session cannot update the current one.
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
  // The current session: its lifecycle and a monotonic epoch. The epoch is
  // adjusted during render (the documented pattern for state derived from a
  // changing input) so entering a new lifecycle - including a later sign-in -
  // advances it and never reuses a previous session's key.
  const [session, setSession] = useState<{
    lifecycle: Lifecycle;
    epoch: number;
  }>({ lifecycle: "out", epoch: 0 });
  if (session.lifecycle !== lifecycle) {
    setSession({ lifecycle, epoch: session.epoch + 1 });
  }
  const [sync, setSync] = useState<{ epoch: number; status: SyncState }>({
    epoch: 0,
    status: "idle",
  });
  // A status is visible only while it belongs to the current session.
  const status = sync.epoch === session.epoch ? sync.status : "idle";

  useEffect(() => {
    if (lifecycle !== "in") return;
    const epoch = session.epoch;
    let cancelled = false;
    // Handle both outcomes so a failure never becomes an unhandled rejection.
    // A stale result (older epoch) is dropped rather than overwriting a newer
    // session's status.
    syncUser({}).then(
      () => {
        if (!cancelled) {
          setSync((prev) =>
            epoch >= prev.epoch ? { epoch, status: "idle" } : prev,
          );
        }
      },
      () => {
        if (!cancelled) {
          setSync((prev) =>
            epoch >= prev.epoch ? { epoch, status: "failed" } : prev,
          );
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [lifecycle, session.epoch, syncUser]);

  const retry = () => {
    // Tag the outcome with the session it started under: a completion that
    // lands after the lifecycle changed is ignored by the epoch comparison.
    const epoch = session.epoch;
    setSync((prev) =>
      epoch >= prev.epoch ? { epoch, status: "retrying" } : prev,
    );
    syncUser({}).then(
      () =>
        setSync((prev) =>
          epoch >= prev.epoch ? { epoch, status: "idle" } : prev,
        ),
      () =>
        setSync((prev) =>
          epoch >= prev.epoch ? { epoch, status: "failed" } : prev,
        ),
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
