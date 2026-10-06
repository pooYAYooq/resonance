"use client";

import Link from "next/link";
import { AppNavigation } from "@/components/web/MobileNavMenu";

export function WorkspaceNavigation({ onNavigate }: { onNavigate?: () => void }) {
  return <AppNavigation isAuthenticated onNavigate={onNavigate} />;
}

export function WorkspaceSidebar() {
  return (
    <aside className="hidden w-72 shrink-0 border-r bg-background md:sticky md:top-0 md:flex md:h-dvh md:flex-col">
      <div className="px-7 py-5">
        <Link href="/dashboard" className="text-xl font-extrabold">
          RESONANCE
        </Link>
      </div>
      <WorkspaceNavigation />
    </aside>
  );
}
