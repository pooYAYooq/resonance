"use client";

import { NotificationBell } from "@/components/web/NotificationBell";
import { AccountMenu } from "@/components/web/AccountMenu";

export function WorkspaceUtilities({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <NotificationBell />
      <AccountMenu presentation="workspace" onNavigate={onNavigate} />
    </div>
  );
}
