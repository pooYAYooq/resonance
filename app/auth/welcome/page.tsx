"use client";

import { Suspense, useEffect, useState } from "react";
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

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function SignInPrompt({ returnTo }: { returnTo: string }) {
  return (
    <div className="text-center">
      <p className="text-muted-foreground">Sign in to continue.</p>
      <Button asChild className="mt-4">
        <Link href={buildAuthHref("/auth/login", returnTo)}>Sign in</Link>
      </Button>
    </div>
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

  // The destination the visitor chose from this page, set before the dismissal
  // is written. While it is set, the effect below must not redirect: the local
  // exit already navigates, and the account reporting `dismissed` as the write
  // lands must not override that choice.
  const [exitDestination, setExitDestination] = useState<string | null>(null);

  // Leaving for the destination is a side effect, so it runs after render
  // rather than during it. It covers an account that dismissed the welcome on
  // another device or in an earlier session, but never a dismissal this page
  // is currently performing.
  useEffect(() => {
    if (dismissed && exitDestination === null) {
      router.replace(returnTo);
    }
  }, [dismissed, exitDestination, returnTo, router]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  // A settled signed-out visitor, including one whose session just expired,
  // is offered the sign-in route instead of waiting on a query that is skipped
  // while unauthenticated.
  if (!isAuthenticated) {
    return <SignInPrompt returnTo={returnTo} />;
  }

  if (state === undefined) {
    return <LoadingSpinner />;
  }

  if (state === null) {
    return <SignInPrompt returnTo={returnTo} />;
  }

  if (dismissed) {
    return <LoadingSpinner />;
  }

  /**
   * Dismisses the welcome and then navigates. Dismissal is best effort: a
   * failed write must not strand the account on this page or be reported as a
   * success, so the rejection is swallowed and navigation still happens.
   */
  async function dismissThen(destination: string, navigate: () => void) {
    setExitDestination(destination);
    try {
      await dismissWelcome({});
    } catch {
      // Intentionally ignored; the user still leaves the welcome.
    } finally {
      navigate();
    }
  }

  const exitPending = exitDestination !== null;

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
            disabled={exitPending}
            onClick={() =>
              void dismissThen(returnTo, () => router.replace(returnTo))
            }
          >
            Start exploring
          </Button>
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={exitPending}
            onClick={() =>
              void dismissThen("/profile/edit", () =>
                router.push("/profile/edit"),
              )
            }
          >
            Choose my username
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
