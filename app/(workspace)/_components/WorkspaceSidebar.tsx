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
import { AccountMenu } from "@/components/web/AccountMenu";
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
      workspaceMode
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
          collapsed ? "w-[54px]" : "w-[312px]",
        )}
      >
        <div
          className={cn(
            "group/sidebar-header relative flex shrink-0 items-center gap-2 overflow-hidden py-4",
            collapsed ? "flex-col px-3" : "justify-between pl-[11px] pr-4",
          )}
        >
          <Link
            href="/dashboard"
            aria-label="Resonance dashboard"
            className={cn(
              "flex h-11 items-center rounded-md px-2 text-xl font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              collapsed &&
                "group-hover/sidebar-header:opacity-0 group-has-[button:focus-visible]/sidebar-header:opacity-0 [@media(hover:none)]:invisible",
            )}
          >
            {collapsed ? "R" : "RESONANCE"}
          </Link>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "size-11",
                  collapsed &&
                    "pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 opacity-0 group-hover/sidebar-header:pointer-events-auto group-hover/sidebar-header:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100",
                )}
                aria-label={toggleLabel}
                aria-expanded={!collapsed}
                aria-controls={navigationId}
                onClick={toggleSidebar}
              >
                {collapsed ? (
                  <PanelLeftOpen className="size-5" aria-hidden="true" />
                ) : (
                  <PanelLeftClose className="size-5" aria-hidden="true" />
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
        <div className="shrink-0 p-2">
          <AccountMenu presentation="workspace" collapsed={collapsed} />
        </div>
      </aside>
    </TooltipProvider>
  );
}
