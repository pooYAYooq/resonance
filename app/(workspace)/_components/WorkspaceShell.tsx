"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useConvexAuth } from "convex/react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { buildAuthHref, getCurrentReturnTo } from "@/lib/auth-return";
import { WorkspaceMobileDrawer } from "./WorkspaceMobileDrawer";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(buildAuthHref("/auth/login", getCurrentReturnTo()));
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex justify-center py-12" role="status" aria-label="Loading workspace">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <WorkspaceSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center border-b px-4 py-3 lg:hidden">
          <WorkspaceMobileDrawer />
          <span className="ml-2 text-lg font-extrabold">RESONANCE</span>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
