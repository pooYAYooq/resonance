"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  isWorkspacePathActive,
  readingNavigation,
  writingNavigation,
} from "./workspace-navigation";
import { WorkspaceUtilities } from "./WorkspaceUtilities";

export function WorkspaceNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Workspace navigation" className="flex flex-col gap-6">
      <WorkspaceNavigationGroup
        title="Writing"
        items={writingNavigation}
        pathname={pathname}
        onNavigate={onNavigate}
      />
      <WorkspaceNavigationGroup
        title="Reading"
        items={readingNavigation}
        pathname={pathname}
        onNavigate={onNavigate}
      />
    </nav>
  );
}

function WorkspaceNavigationGroup({
  title,
  items,
  pathname,
  onNavigate,
}: {
  title: string;
  items: readonly { label: string; href: string }[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {items.map(({ href, label }) => {
        const active = isWorkspacePathActive(pathname, href);

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

export function WorkspaceSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-background lg:flex lg:flex-col">
      <div className="p-5">
        <Link href="/dashboard" className="text-xl font-extrabold">
          RESONANCE
        </Link>
      </div>
      <div className="flex-1 px-3">
        <WorkspaceNavigation />
      </div>
      <div className="border-t p-4">
        <WorkspaceUtilities />
      </div>
    </aside>
  );
}
