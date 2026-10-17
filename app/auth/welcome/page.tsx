"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buildAuthHref, getSafeReturnTo } from "@/lib/auth-return";
import { Loader2 } from "lucide-react";

/**
 * The one-time welcome shown after signup or login. It names the generated
 * username and points at where it can be changed, then remembers the
 * dismissal on the account so it is not shown again.
 */
export default function WelcomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <WelcomeContent />
    </Suspense>
  );
}

function WelcomeContent() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"));
  const dismissWelcome = useMutation(api.welcome.dismissWelcome);
  const state = useQuery(
    api.welcome.getWelcomeState,
    !isLoading && isAuthenticated ? {} : "skip",
  );
  const dismissed = state?.dismissed === true;

  // Leaving for the destination is a side effect, so it runs after render
  // rather than during it. It covers an account that dismissed the welcome on
  // another device or in an earlier session.
  useEffect(() => {
    if (dismissed) {
      router.replace(returnTo);
    }
  }, [dismissed, returnTo, router]);

  if (isLoading || !isAuthenticated || state === undefined) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === null) {
    return (
      <div className="text-center">
        <p className="text-muted-foreground">Sign in to continue.</p>
        <Button asChild className="mt-4">
          <Link href={buildAuthHref("/auth/login", returnTo)}>Sign in</Link>
        </Button>
      </div>
    );
  }

  if (dismissed) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /**
   * Dismisses the welcome and then navigates. Dismissal is best effort: a
   * failed write must not strand the account on this page or be reported as a
   * success, so the rejection is swallowed and navigation still happens.
   */
  async function dismissThen(navigate: () => void) {
    try {
      await dismissWelcome({});
    } catch {
      // Intentionally ignored; the user still leaves the welcome.
    } finally {
      navigate();
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Welcome to Resonance
        </h1>
        <p className="text-muted-foreground">
          We are glad you are here. Your username is
        </p>
        <p className="text-lg font-semibold">{state.username}</p>
        <p className="text-sm text-muted-foreground">
          Make yourself at home. You can choose your own username anytime in
          Edit profile.
        </p>
        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
          <Button
            type="button"
            className="cursor-pointer"
            onClick={() => void dismissThen(() => router.replace(returnTo))}
          >
            Start exploring
          </Button>
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            onClick={() => void dismissThen(() => router.push("/profile/edit"))}
          >
            Choose my username
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
