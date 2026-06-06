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
 * access to the auth state. It does not render any UI — it only runs
 * a side effect and passes children through.
 */

"use client";

import { useEffect } from "react";
import { useConvexAuth } from "convex/react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

interface AuthSyncProps {
  children: React.ReactNode;
}

export function AuthSync({ children }: AuthSyncProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const syncUser = useMutation(api.users.syncUser);

  // Sync app-level user record after every sign-in. The catch() suppresses
  // errors because the user might already exist or the mutation might race
  // with a concurrent sync. `syncUser` is idempotent, so races are safe.
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      syncUser({}).catch(() => {
        // Intentionally suppressed — syncUser is idempotent and races are harmless.
      });
    }
  }, [isAuthenticated, isLoading, syncUser]);

  return <>{children}</>;
}
