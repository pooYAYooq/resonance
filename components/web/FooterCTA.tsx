"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useConvexAuth } from "convex/react";
import { PenLine } from "lucide-react";

/**
 * Auth-aware CTA card for the Footer.
 *
 * Shows "Write a post" when authenticated, "Get Started" otherwise.
 * Wrapped in the same gradient card treatment used by the original Footer CTA.
 */
export function FooterCTA() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="md:max-w-xs w-full">
        <div className="rounded-xs border border-primary/10 bg-gradient-to-tr from-muted/5 via-muted/5 to-primary/2 p-6">
          <div className="h-4 w-24 bg-muted/50 rounded-md animate-pulse mb-3" />
          <div className="h-3 w-full bg-muted/50 rounded-md animate-pulse mb-2" />
          <div className="h-3 w-5/6 bg-muted/50 rounded-md animate-pulse mb-4" />
          <div className="h-8 w-24 bg-muted/50 rounded-md animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="md:max-w-xs w-full">
      <div className="rounded-xs border border-primary/10 bg-gradient-to-tr from-muted/5 via-muted/5 to-primary/2 p-6">
        <div className="flex items-center gap-2 mb-3">
          <PenLine className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            {isAuthenticated ? "Start Writing" : "Join the Community"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          {isAuthenticated
            ? "Have something to share? Publish your first post and reach a community of readers."
            : "Sign up to start writing, commenting, and engaging with thoughtful content."}
        </p>
        <Button asChild size="sm">
          <Link href={isAuthenticated ? "/create" : "/auth/login"}>
            {isAuthenticated ? "Write a post" : "Get Started"}
          </Link>
        </Button>
      </div>
    </div>
  );
}
