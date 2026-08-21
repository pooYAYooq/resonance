"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { useConvexAuth } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardSectionNav } from "./DashboardSectionNav";

const sectionTitles = {
  "/dashboard": "Overview",
  "/dashboard/drafts": "Drafts",
  "/dashboard/published": "Published",
  "/dashboard/saved": "Saved",
} as const;

function getSectionTitle(pathname: string) {
  return sectionTitles[pathname as keyof typeof sectionTitles] ?? "Overview";
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div
        className="flex justify-center py-12"
        role="status"
        aria-label="Loading dashboard"
      >
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="py-10">
      <header className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Your workspace
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
            {getSectionTitle(pathname)}
          </h1>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/create">
            <Plus />
            New Post
          </Link>
        </Button>
      </header>
      <DashboardSectionNav />
      {children}
    </div>
  );
}
