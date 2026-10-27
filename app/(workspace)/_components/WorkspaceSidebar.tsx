"use client";

import Link from "next/link";
import { useId, useState, useSyncExternalStore } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AppNavigation } from "@/components/web/MobileNavMenu";
import { cn } from "@/lib/utils";

const SIDEBAR_STORAGE_KEY = "resonance:workspace-sidebar";
const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

function readSidebarPreference(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "collapsed";
  } catch {
    return false;
  }
}

export function WorkspaceNavigation({
  onNavigateAction,
  collapsed = false,
}: {
  onNavigateAction?: () => void;
  collapsed?: boolean;
}) {
  return (
    <AppNavigation
      isAuthenticated
      onNavigateAction={onNavigateAction}
      collapsed={collapsed}
    />
  );
}

export function WorkspaceSidebar() {
  const [collapsedPreference, setCollapsedPreference] = useState(
    readSidebarPreference,
  );
  // Keep the server and initial hydration render expanded before restoring it.
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    clientSnapshot,
    serverSnapshot,
  );
  const collapsed = hydrated && collapsedPreference;
  const navigationId = useId();
  const toggleLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";

  function toggleSidebar() {
    const nextCollapsed = !collapsed;
    setCollapsedPreference(nextCollapsed);

    try {
      window.localStorage.setItem(
        SIDEBAR_STORAGE_KEY,
        nextCollapsed ? "collapsed" : "expanded",
      );
    } catch {
      // The in-memory toggle still works when browser storage is unavailable.
    }
  }

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        aria-label="Workspace sidebar"
        data-state={collapsed ? "collapsed" : "expanded"}
        className={cn(
          "hidden shrink-0 border-r bg-background transition-[width] duration-200 ease-in-out motion-reduce:transition-none md:sticky md:top-0 md:flex md:h-dvh md:flex-col",
          collapsed ? "w-20" : "w-72",
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center gap-2 py-4",
            collapsed ? "flex-col px-3" : "justify-between px-4",
          )}
        >
          <Link
            href="/dashboard"
            aria-label="Resonance dashboard"
            className="flex h-11 items-center rounded-md px-2 text-xl font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {collapsed ? "R" : "RESONANCE"}
          </Link>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label={toggleLabel}
                aria-expanded={!collapsed}
                aria-controls={navigationId}
                onClick={toggleSidebar}
              >
                {collapsed ? (
                  <PanelLeftOpen aria-hidden="true" />
                ) : (
                  <PanelLeftClose aria-hidden="true" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {toggleLabel}
            </TooltipContent>
          </Tooltip>
        </div>
        <div id={navigationId} className="flex min-h-0 flex-1 flex-col">
          <WorkspaceNavigation collapsed={collapsed} />
        </div>
      </aside>
    </TooltipProvider>
  );
}
