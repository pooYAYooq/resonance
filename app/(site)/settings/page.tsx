"use client";

import { useEffect } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ThemePreferenceControl } from "@/components/web/ThemePreferenceControl";
import { signOutUser } from "@/components/web/account-actions";
import { buildAuthHref, getCurrentReturnTo } from "@/lib/auth-return";

export default function SettingsRoute() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const currentUser = useQuery(
    api.users.getCurrentUser,
    !isLoading && isAuthenticated ? {} : "skip",
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(buildAuthHref("/auth/login", getCurrentReturnTo()));
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated || !currentUser) {
    return (
      <div
        className="flex justify-center py-12"
        role="status"
        aria-label="Loading settings"
      >
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 py-12">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Configure how Resonance looks and manage your account access.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-medium">Appearance</h2>
        </CardHeader>
        <CardContent>
          <ThemePreferenceControl />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-medium">Account</h2>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Signed-in account</p>
            <p className="text-sm text-muted-foreground">{currentUser.email}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => signOutUser(router)}
          >
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
