"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useConvexAuth } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { DashboardSectionNav } from "./DashboardSectionNav";
import { buildAuthHref, getCurrentReturnTo } from "@/lib/auth-return";

const sectionTitles = {
  "/dashboard": "Overview",
  "/dashboard/drafts": "Drafts",
  "/dashboard/published": "Published",
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
      router.push(buildAuthHref("/auth/login", getCurrentReturnTo()));
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
      <header className="mb-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Your workspace
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
            {getSectionTitle(pathname)}
          </h1>
        </div>
      </header>
      <DashboardSectionNav />
      {children}
    </div>
  );
}
