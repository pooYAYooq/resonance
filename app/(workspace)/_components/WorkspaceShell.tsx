"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useConvexAuth } from "convex/react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { buildAuthHref, getCurrentReturnTo } from "@/lib/auth-return";
import { Navbar } from "@/components/web/Navbar";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { WorkspacePreviewProvider } from "./WorkspacePreviewContext";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(buildAuthHref("/auth/login", getCurrentReturnTo()));
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div
        className="flex justify-center py-12"
        role="status"
        aria-label="Loading workspace"
      >
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <WorkspacePreviewProvider value={{ isPreview, setIsPreview }}>
      <div className={isPreview ? "min-h-screen" : "flex min-h-screen"}>
        {!isPreview && <WorkspaceSidebar />}
        <div className="flex min-w-0 flex-1 flex-col">
          {!isPreview && (
            <div className="sticky top-0 z-20 md:hidden">
              <Navbar />
            </div>
          )}
          <main className="flex flex-1 flex-col">{children}</main>
        </div>
      </div>
    </WorkspacePreviewProvider>
  );
}
