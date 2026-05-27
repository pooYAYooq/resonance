"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useConvexAuth } from "convex/react";

/**
 * Auth-aware call-to-action buttons for the blog hero.
 *
 * Shows "Write a post" when authenticated, "Sign in to write" otherwise.
 */
export function HeroActions() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 mt-8">
        <div className="h-10 w-32 bg-muted/50 rounded-md animate-pulse" />
      </div>
    );
  }

  return (
    <div className="mt-8">
      {isAuthenticated ? (
        <Button asChild>
          <Link href="/create">Write a post</Link>
        </Button>
      ) : (
        <Button asChild>
          <Link href="/auth/login">Sign in to write</Link>
        </Button>
      )}
    </div>
  );
}
