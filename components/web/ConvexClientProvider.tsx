"use client";

import { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { authClient } from "@/lib/auth-client";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { AuthSync } from "./AuthSync";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!, {
  // Optionally pause queries until the user is authenticated
  expectAuth: true,
});

export function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ConvexBetterAuthProvider
      client={convex}
      authClient={authClient}
    >
      {/* AuthSync triggers api.users.syncUser on every sign-in.
          It must be inside ConvexBetterAuthProvider so useConvexAuth works. */}
      <AuthSync>
        {children}
      </AuthSync>
    </ConvexBetterAuthProvider>
  );
}
