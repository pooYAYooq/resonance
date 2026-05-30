"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useConvexAuth } from "convex/react";
import { cn } from "@/lib/utils";

/**
 * Auth-aware call-to-action button.
 *
 * Shows "Write a post" when authenticated, "Get Started" otherwise.
 * Used across the landing page hero, CTA section, and blog hero.
 */
export function AuthCTA({ className }: { className?: string }) {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="h-10 w-32 bg-muted/50 rounded-md animate-pulse" />
      </div>
    );
  }

  return (
    <div className={cn(className)}>
      {isAuthenticated ? (
        <Button asChild>
          <Link href="/create">Write a post</Link>
        </Button>
      ) : (
        <Button asChild>
          <Link href="/auth/login">Get Started</Link>
        </Button>
      )}
    </div>
  );
}
